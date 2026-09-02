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

## ROADMAP / next steps
1. **Create a real `leadserve-oms-dev` Firebase project** (Singapore region) and paste its web-app
   config into `config.js` → `DEMO_FIREBASE`. Required before the shell can run/demo.
2. **Server-enforced entitlement (the key security work).** Current `firestore.rules` is
   `allow read, write: if request.auth != null` — wide open. Replace with rules that enforce
   per-tenant isolation and per-module access. Tile hiding + `auth-guard` are convenience only.
3. **Gate module pages themselves** by `modules` (deep-link protection), not just the tiles.
4. **Config-drive the letterheads:** `modules/reports/index.html` and `modules/prescription/index.html`
   still render demo clinic name/address as static text — pull from `OMS_CONFIG`.
5. **Review `modules/reports/index.html:129`** — a Laoag-region address heuristic
   (`norte/laoag/batac/paoay`) leftover from LCELC; generalize or make config-driven.
6. Verify `leadserve.html` (umbrella landing) branding and multi-tenant switching.

See the full architecture write-up (`LEADSERVE-architecture.md`) for the two-track plan.
