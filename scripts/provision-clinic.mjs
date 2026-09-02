#!/usr/bin/env node
// LEADSERVE control-plane: provision a clinic tenant.
//
// Creates, for a new clinic (idempotent):
//   clinics/{id}                      -> clinic profile
//   clinics/{id}/members/{adminUid}   -> first admin membership
//   clinics/{id}/settings/entitlement -> modules for the chosen plan
//
// These are provisioning-locked in the security rules, so this runs with the
// Admin SDK (which bypasses rules). That is the whole point of a control plane.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
//   node scripts/provision-clinic.mjs \
//     --id=clinicA --name="Clinic A Eye Center" --type=eye \
//     --admin=admin@clinica.ph --plan=full
//
// Auth: uses GOOGLE_APPLICATION_CREDENTIALS (a service-account key) or, when the
// Firestore emulator is running (FIRESTORE_EMULATOR_HOST set), no key.
// The admin must already exist in Firebase Authentication (resolved by email),
// or pass --admin-uid=<uid> directly.

import { FieldValue } from "firebase-admin/firestore";

export const PLANS = {
  core:     { inventory: false, procurement: false, prescription: false, reports: false, philhealth: false, hr: false },
  standard: { inventory: true,  procurement: true,  prescription: true,  reports: true,  philhealth: false, hr: false },
  full:     { inventory: true,  procurement: true,  prescription: true,  reports: true,  philhealth: true,  hr: true  },
};

export function computeModules(plan = "standard", modulesOverride) {
  if (modulesOverride) {
    const on = new Set(String(modulesOverride).split(",").map((s) => s.trim()).filter(Boolean));
    return Object.fromEntries(Object.keys(PLANS.full).map((k) => [k, on.has(k)]));
  }
  const m = PLANS[plan];
  if (!m) throw new Error(`Unknown plan "${plan}". Use one of: ${Object.keys(PLANS).join(", ")}`);
  return m;
}

// Core provisioning: write clinic + first-admin membership + entitlement.
export async function provisionClinic(db, { id, name, type = "general", plan = "standard", modules, adminUid, adminEmail = null }) {
  if (!id || !name) throw new Error("id and name are required");
  if (!adminUid) throw new Error("adminUid is required");
  const mods = computeModules(plan, modules);

  const batch = db.batch();
  batch.set(db.doc(`clinics/${id}`), {
    clinicId: id, clinicName: name, clinicType: type, plan, createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.set(db.doc(`clinics/${id}/members/${adminUid}`), {
    role: "admin", email: adminEmail, addedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.set(db.doc(`clinics/${id}/settings/entitlement`), {
    plan, modules: mods, updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await batch.commit();
  return { id, plan, modules: mods, adminUid };
}

// ---------- CLI ----------
function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
    else if (a.startsWith("--")) out[a.slice(2)] = true;
  }
  return out;
}

async function main() {
  const { initializeApp, applicationDefault, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const { getAuth } = await import("firebase-admin/auth");
  const { readFileSync } = await import("node:fs");

  const args = parseArgs(process.argv);
  if (!args.id || !args.name) {
    console.error('Required: --id=<clinicId> --name="<Clinic Name>" [--type=eye|dental|lab|general] [--plan=core|standard|full] [--admin=email | --admin-uid=uid] [--modules=inventory,reports]');
    process.exit(2);
  }

  const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || "leadserve-oms";
  if (process.env.FIRESTORE_EMULATOR_HOST) initializeApp({ projectId });
  else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) initializeApp({ credential: cert(JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"))) });
  else initializeApp({ credential: applicationDefault() });

  let adminUid = args["admin-uid"];
  if (!adminUid) {
    if (!args.admin) throw new Error("Provide --admin=<email> or --admin-uid=<uid>");
    try { adminUid = (await getAuth().getUserByEmail(args.admin)).uid; }
    catch { throw new Error(`No Firebase Auth user for ${args.admin}. Create the admin account first (Console -> Authentication -> Add user), then re-run.`); }
  }

  const res = await provisionClinic(getFirestore(), {
    id: args.id, name: args.name, type: args.type, plan: args.plan || "standard",
    modules: args.modules, adminUid, adminEmail: args.admin || null,
  });
  console.log(`✓ Provisioned clinic "${res.id}" (${args.name})`);
  console.log(`  plan:    ${res.plan}`);
  console.log(`  modules: ${Object.entries(res.modules).filter(([, v]) => v).map(([k]) => k).join(", ") || "(core only)"}`);
  console.log(`  admin:   ${args.admin || adminUid} (uid ${adminUid})`);
}

// Run main() only when invoked directly (not when imported by tests).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error("✗ " + e.message); process.exit(1); });
}
