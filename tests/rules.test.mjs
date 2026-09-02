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

console.log("E. Multi-tenant isolation (tenantPath: clinics/{tid}/...)");
// Provision two clinics with one member each (LEADSERVE would do this via Admin SDK).
await seed(async (db) => {
  await setDoc(doc(db, "clinics/clinicA/members/userA"), { role: "admin" });
  await setDoc(doc(db, "clinics/clinicB/members/userB"), { role: "admin" });
  // clinic A has prescription disabled, inventory enabled
  await setDoc(doc(db, "clinics/clinicA/settings/entitlement"), { modules: { prescription: false, inventory: true } });
});
const A = env.authenticatedContext("userA").firestore();
const B = env.authenticatedContext("userB").firestore();
const C = env.authenticatedContext("userC").firestore(); // member of nothing

await check("member A CAN write own clinic data (clinics/clinicA/patients)", assertSucceeds(setDoc(doc(A, "clinics/clinicA/patients/p1"), { name: "A patient" })));
await check("member A CAN read own clinic data", assertSucceeds(getDoc(doc(A, "clinics/clinicA/patients/p1"))));
await check("member A CANNOT read OTHER clinic data (clinics/clinicB)", assertFails(getDoc(doc(A, "clinics/clinicB/patients/x"))));
await check("member A CANNOT write OTHER clinic data (clinics/clinicB)", assertFails(setDoc(doc(A, "clinics/clinicB/patients/x"), { name: "hax" })));
await check("member B CAN write own clinic (clinics/clinicB)", assertSucceeds(setDoc(doc(B, "clinics/clinicB/visits/v1"), { pid: "p" })));
await check("member B CANNOT touch clinic A", assertFails(setDoc(doc(B, "clinics/clinicA/patients/p2"), { name: "hax" })));
await check("non-member C CANNOT read clinic A", assertFails(getDoc(doc(C, "clinics/clinicA/patients/p1"))));
await check("non-member C CANNOT read clinic B", assertFails(getDoc(doc(C, "clinics/clinicB/visits/v1"))));

console.log("F. Per-clinic module entitlement + provisioning locks");
await check("clinic A prescription DISABLED -> write DENIED", assertFails(setDoc(doc(A, "clinics/clinicA/prescriptions/rx1"), { ts: 1 })));
await check("clinic A inventory ENABLED -> write ALLOWED", assertSucceeds(setDoc(doc(A, "clinics/clinicA/inventory_medicines/m1"), { qty: 3 })));
await check("member CANNOT add clinic members (provisioning locked)", assertFails(setDoc(doc(A, "clinics/clinicA/members/intruder"), { role: "admin" })));
await check("member CANNOT edit clinic entitlement (locked)", assertFails(setDoc(doc(A, "clinics/clinicA/settings/entitlement"), { modules: { prescription: true } })));
await check("member CANNOT write clinic profile doc (locked)", assertFails(setDoc(doc(A, "clinics/clinicA"), { name: "renamed" })));

await env.cleanup();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
