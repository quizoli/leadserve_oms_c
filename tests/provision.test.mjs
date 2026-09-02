// End-to-end test: provision a clinic with the control-plane script (Admin SDK),
// then verify the provisioned admin gets access under the real security rules and
// a stranger does not. Run via: npm run test:provision
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { provisionClinic } from "../scripts/provision-clinic.mjs";

const PROJECT = "leadserve-oms";
let pass = 0, fail = 0;
async function check(name, promise) {
  try { await promise; console.log(`  ✓ ${name}`); pass++; }
  catch (e) { console.error(`  ✗ ${name}\n      ${e.message}`); fail++; }
}
async function expect(name, fn) { await check(name, (async () => { if (!(await fn())) throw new Error("assertion failed"); })()); }

// --- Control plane: provision via Admin SDK (bypasses rules) ---
initializeApp({ projectId: PROJECT });
const adminDb = getFirestore();

console.log("Provision a clinic (Admin SDK control-plane script)");
const res = await provisionClinic(adminDb, {
  id: "clinicX", name: "Clinic X Eye Center", type: "eye", plan: "standard",
  adminUid: "adminX", adminEmail: "admin@clinicx.ph",
});
await expect("standard plan -> prescription on, philhealth off", () => res.modules.prescription === true && res.modules.philhealth === false);
await expect("clinic profile doc created", async () => (await adminDb.doc("clinics/clinicX").get()).exists);
await expect("first-admin membership created (role=admin)", async () => {
  const s = await adminDb.doc("clinics/clinicX/members/adminX").get();
  return s.exists && s.data().role === "admin";
});
await expect("entitlement doc created from plan", async () => {
  const m = (await adminDb.doc("clinics/clinicX/settings/entitlement").get()).data().modules;
  return m.prescription === true && m.philhealth === false;
});
await expect("reverse index users/{uid}.clinicIds includes the clinic", async () => {
  const d = (await adminDb.doc("clinics/clinicX/settings/entitlement").get()) && (await adminDb.doc("users/adminX").get());
  return (d.data().clinicIds || []).includes("clinicX");
});

// --- Rules: the provisioned admin now has access; strangers do not ---
console.log("Provisioned admin gets access under the security rules");
const env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { rules: readFileSync("firestore.rules", "utf8") } });
const admin = env.authenticatedContext("adminX").firestore();
const stranger = env.authenticatedContext("nobody").firestore();

await check("provisioned admin CAN read own clinic", assertSucceeds(getDoc(doc(admin, "clinics/clinicX/patients/p1"))));
await check("provisioned admin CAN write enabled module (prescriptions)", assertSucceeds(setDoc(doc(admin, "clinics/clinicX/prescriptions/rx1"), { ts: 1 })));
await check("provisioned admin CANNOT write disabled module (cf4/philhealth)", assertFails(setDoc(doc(admin, "clinics/clinicX/cf4/c1"), { x: 1 })));
await check("stranger CANNOT read the clinic", assertFails(getDoc(doc(stranger, "clinics/clinicX/patients/p1"))));
await check("provisioned admin CANNOT self-edit entitlement (still locked)", assertFails(setDoc(doc(admin, "clinics/clinicX/settings/entitlement"), { modules: { philhealth: true } })));

await env.cleanup();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
