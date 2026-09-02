# LEADSERVE OMS Migration Plan

This plan keeps the current GWELC production app intact while building LEADSERVE OMS as a parallel multi-clinic workspace.

## Target Architecture

LEADSERVE uses one central Firebase project first: the existing GWELC Firebase project.

Clinic data is separated by Firestore path:

```text
clinics/{clinicId}/patients/{patientId}
clinics/{clinicId}/appts/{apptId}
clinics/{clinicId}/visits/{visitId}
clinics/{clinicId}/prescriptions/{prescriptionId}
clinics/{clinicId}/inventory_medicines/{itemId}
clinics/{clinicId}/settings/{settingId}
```

Global platform data stays outside clinic paths:

```text
clinics/{clinicId}
users/{uid}
clinicMemberships/{membershipId}
leadserve_audit/{eventId}
```

## First Two Tenants

```text
clinics/gwelc
clinics/msn
```

Future clinics should be added as new documents under `clinics/{clinicId}` and then assigned to users through `users/{uid}.clinicIds` or `clinicMemberships`.

## User Flow

1. User opens `/leadserve.html`.
2. User logs in with Firebase Auth.
3. App loads the clinics assigned to that user.
4. User chooses a clinic.
5. Existing GWELC module pages open with:

```text
?leadserve=1&tenant={clinicId}
```

In LEADSERVE mode, normal calls like:

```js
db.collection("patients")
```

are redirected to:

```text
clinics/{clinicId}/patients
```

The normal `/index.html` GWELC baseline still uses the existing flat collections.

## Migration Order

1. Keep the current GWELC production app on flat collections.
2. Create seed clinic records:

```text
clinics/gwelc
clinics/msn
```

3. Copy GWELC flat collections into `clinics/gwelc/{collectionName}`.
4. Test `/leadserve.html`, choose GWELC, and verify patient search, appointments, visits, prescriptions, reports, inventory, HR, and settings.
5. Copy MSN collections into `clinics/msn/{collectionName}`.
6. Test `/leadserve.html`, choose MSN, and verify the same module checklist.
7. Add Firestore Security Rules so authenticated users can only read/write clinic paths for clinics they are assigned to.
8. Add two more clinics by creating new `clinics/{clinicId}` docs and running the same migration process.

## Collections To Migrate First

Start with the clinical workflow:

```text
patients
appts
visits
files
prescriptions
settings
```

Then migrate business modules:

```text
charge_slips
inventory_medicines
inventory_eyeglasses
inventory_clinic_supplies
inventory_office_it
procurement_*
hr_*
philhealth_*
```

Exact collection names should be confirmed from Firestore before running the copy.

## Safety Rules

- Do not change the live GWELC flat collections during initial LEADSERVE testing.
- Do not deploy migrated data until the clinic chooser and module paths are verified.
- Do not put legacy app folders inside `public/`.
- Keep `legacy/`, `.firebase/`, `node_modules/`, and `.DS_Store` ignored by Git.
