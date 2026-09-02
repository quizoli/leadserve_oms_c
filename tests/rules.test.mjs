// Firestore security-rules unit tests for LEADSERVE OMS.
// Run via: npm run test:rules  (starts the Firestore emulator, loads firestore.rules)
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, setDoc, getDoc } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "leadserve-oms-test",
  firestore: { rules: readFileSync("firestore.rules", "utf8") },
});

let pass = 0, fail = 0;
async function check(name, promise) {
  try { await promise; console.log(`  ✓ ${name}`); pass++; }
  catch (e) { console.error(`  ✗ ${name}\n      ${e.message}`); fail++; }
}

const unauth = env.unauthenticatedContext().firestore();
const user = env.authenticatedContext("user1").firestore();

// helper to seed docs bypassing rules (simulates LEADSERVE/Admin SDK / other users)
async function seed(fn) { await env.withSecurityRulesDisabled(async (c) => fn(c.firestore())); }

console.log("A. Baseline (no entitlement doc = fail-open)");
await check("unauthenticated CANNOT read patients", assertFails(getDoc(doc(unauth, "patients/p1"))));
await check("signed-in CAN write core: patients", assertSucceeds(setDoc(doc(user, "patients/p1"), { name: "Test" })));
await check("signed-in CAN write core: oms_slips", assertSucceeds(setDoc(doc(user, "oms_slips/s1"), { total: 100 })));
await check("signed-in CAN write add-on (fail-open): prescriptions", assertSucceeds(setDoc(doc(user, "prescriptions/rx1"), { ts: 1 })));
await check("signed-in CAN write add-on (fail-open): inventory_medicines", assertSucceeds(setDoc(doc(user, "inventory_medicines/m1"), { qty: 5 })));

console.log("B. Entitlement doc disables prescription + philhealth");
await seed(async (db) => setDoc(doc(db, "settings/entitlement"), { modules: { prescription: false, philhealth: false, inventory: true, procurement: true } }));
await check("prescription DISABLED -> write DENIED", assertFails(setDoc(doc(user, "prescriptions/rx2"), { ts: 2 })));
await check("philhealth DISABLED -> cf4 write DENIED", assertFails(setDoc(doc(user, "cf4/c1"), { x: 1 })));
await check("inventory ENABLED -> write ALLOWED", assertSucceeds(setDoc(doc(user, "inventory_medicines/m2"), { qty: 9 })));
await check("procurement ENABLED -> proc_pr write ALLOWED", assertSucceeds(setDoc(doc(user, "proc_pr/pr1"), { x: 1 })));
await check("core still writable while some modules off: visits", assertSucceeds(setDoc(doc(user, "visits/v1"), { pid: "p1" })));

console.log("C. Entitlement doc is locked to clients");
await check("client CANNOT write settings/entitlement", assertFails(setDoc(doc(user, "settings/entitlement"), { modules: { prescription: true } })));
await check("client CAN read settings/entitlement", assertSucceeds(getDoc(doc(user, "settings/entitlement"))));
await check("client CAN write other settings docs (e.g. clinic)", assertSucceeds(setDoc(doc(user, "settings/clinic"), { physicians: ["Dr A"] })));

console.log("D. Deactivated user is blocked");
await seed(async (db) => setDoc(doc(db, "oms_users/badu"), { status: "inactive" }));
const badUser = env.authenticatedContext("badu").firestore();
await check("deactivated user CANNOT write patients", assertFails(setDoc(doc(badUser, "patients/p9"), { name: "x" })));

await env.cleanup();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
