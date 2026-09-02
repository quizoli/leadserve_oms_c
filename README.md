# LEADSERVE OMS — Shell (leadserve_oms_c)

De-identified, config-driven shell of the clinic OMS, seeded from a copy of GWELC on 2026-09-02.
**Live clinics (LCELC/GWELC/MSN) are untouched — this is a separate copy.**

## What this is
One codebase, many clinics. A clinic is a **config profile** in `public/config.js` (`TENANTS`),
never a code fork. The landing page (`public/index.html`) is the **shell**: core modules are
baked in; add-on modules are **pluggable** — shown/hidden by the tenant's `modules` manifest.

- **Core (always on):** Administration/Settings, Patient Registration, Booking & Consultation
  (charge slip + POS are invoked inside Consultation).
- **Add-ons (per tenant `modules` flag):** Prescription, Inventory, Procurement, Reports,
  PhilHealth *(WIP)*, HR *(delivered via PMC-HRIS)*.

## Done in this pass
- Copied from GWELC; removed `.git` (init your own repo).
- **Safety:** `.firebaserc` default → `leadserve-oms-dev` placeholder; live Firebase creds in
  `config.js` replaced with non-functional placeholders (shell cannot touch live data).
- Deleted dead dated backups (index0414/0427/0506/0520, module *index0*/index1 files, header0520)
  and `migrate.html` (a gwelc-specific one-off migration tool).
- Rebranded `config.js`: neutral `demo` tenant with `clinicType`, `providerMode`, `physicians`,
  and a pluggable `modules` manifest.
- Swept ALL clinic-identity strings (name/address/logo/titles/emails) across html/js/css → LEADSERVE/demo.
- Stripped real staff PII from `assets/auth-guard.js` and `modules/settings/index.html`.
- Wired physician dropdowns (charge-slip, consultation) to `OMS_CONFIG.physicians`.
- Made landing tiles config-driven (`data-module` + gating script).

## ROADMAP / status
- [x] **Live Firebase project** — `leadserve-oms` (Firestore STANDARD, `asia-southeast1`), config wired.
- [x] **Deployed** — https://leadserve-oms.web.app
- [x] **Config-driven letterheads** — reports/prescription/registration/CF4 render the tenant's
      identity via `applyClinicIdentity()` (`[data-clinic]` elements + reusable helper).
- [x] **Deep-link module guard** — `config.js` `moduleGuard()` blocks disabled add-on pages by URL.
- [x] **v2 server-enforced entitlement** — `firestore.rules` gates add-on collections by the
      `settings/entitlement` doc (read-only to clients). Emulator tests: `npm run test:rules` (14/14).
- [ ] **Activate enforcement** — create the `settings/entitlement` doc in the live project
      (console or Admin SDK), e.g. `{ modules: { inventory:true, procurement:true, prescription:true,
      reports:true, philhealth:false, hr:false } }`. Rules are fail-open until it exists.
- [ ] **Single source of truth** — have `config.js` READ `settings/entitlement` from Firestore
      instead of hardcoding `modules` (so tiles/guard and rules agree).
- [ ] **Multi-tenant proof** — prove `tenantPath` mode serves two clinics with isolated data.
- [ ] **Review `modules/reports/index.html:129`** — Laoag-region heuristic leftover from LCELC.
- [ ] Verify `leadserve.html` (umbrella landing) branding + tenant switching.

### Dev tooling
`package.json` + `tests/` are dev-only (rules tests); not part of the hosted app (only `public/` is deployed).
Requires Java for the Firestore emulator (`brew install openjdk`).

See the full architecture write-up (`LEADSERVE-architecture.md`) for the two-track plan.
