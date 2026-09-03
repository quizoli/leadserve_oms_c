// config.js
// LEADSERVE tenant-aware runtime configuration.
(function () {
    // LEADSERVE OMS project (leadserve-oms). Firestore: STANDARD, asia-southeast1.
    // A web-app apiKey is not a secret — security is enforced by Firestore rules.
    const DEMO_FIREBASE = {
        apiKey: "AIzaSyBeTubwCGQbcIcQGVLlpb168YoN8rT_vJ4",
        authDomain: "leadserve-oms.firebaseapp.com",
        projectId: "leadserve-oms",
        storageBucket: "leadserve-oms.firebasestorage.app",
        messagingSenderId: "1057028706385",
        appId: "1:1057028706385:web:4a2292a88c619ee40be870",
        measurementId: "G-3PVXJD9TJJ"
    };

    const LEADSERVE_FIREBASE = DEMO_FIREBASE;

    // A clinic is a config profile, never a code fork. Add a clinic by adding an
    // entry here. `clinicType` and `providerMode` drive UI/behavior; `modules`
    // is the pluggable manifest the landing shell reads to show/hide add-ons.
    // (NOTE: module visibility here is convenience only — real per-module
    // entitlement is enforced server-side in Firestore rules. See ROADMAP.)
    const TENANTS = {
        demo: {
            clinicId: "demo",
            clinicName: "LEADSERVE Demo Clinic",
            clinicShortName: "LEADSERVE",
            pageTitle: "LEADSERVE OMS",
            clinicType: "eye",          // eye | dental | lab | general
            providerMode: "multi",      // single | multi
            address: "Demo City, Philippines",
            contactInfo: "Reliable, customizable clinic management",
            physicianInfo: "Attending Physician",
            physicians: ["Attending Physician", "Dr. Demo One", "Dr. Demo Two"],
            // Bootstrap administrators for this clinic (full access, can manage users).
            // Per-clinic config so admins aren't hardcoded in JS. Additional admins can
            // also be granted via each user's oms_users profile (isAdmin / role: admin).
            adminEmails: ["olitun@me.com"],
            logoPath: "assets/logo.png",
            firebase: DEMO_FIREBASE,
            firestore: {
                // Keeps the clinic's root collections compatible with the source OMS.
                collectionMode: "legacyRoot"
            },
            // Pluggable modules. Core (registration, consultation, charge-slip,
            // pos, settings) is always on and cannot be disabled.
            modules: {
                inventory: true,
                procurement: true,
                prescription: true,
                reports: true,
                philhealth: false,   // WIP
                hr: false            // delivered via PMC-HRIS
            }
        }
    };

    const APP_CONFIG = {
        appName: "LEADSERVE OMS",
        appLogoPath: "assets/leadserve-logo.png",
        defaultTenantId: "demo",
        tenantQueryParam: "tenant",
        tenantStorageKey: "leadserve.activeTenantId",
        leadserveQueryParam: "leadserve",
        tenantPathRoot: "clinics",
        globalCollections: [
            "users",
            "clinics",
            "clinicMemberships",
            "oms_users",
            "tenant_users",
            "tenantMemberships",
            "leadserve_audit"
        ]
    };

    const params = new URLSearchParams(window.location.search || "");
    const path = window.location.pathname || "";
    const onLeadservePage = /\/leadserve(?:\.html|\/|$)/i.test(path);
    const leadserveRequested = onLeadservePage || params.get(APP_CONFIG.leadserveQueryParam) === "1";
    const requestedTenant = (params.get(APP_CONFIG.tenantQueryParam) || "").trim().toLowerCase();

    // ---- Brand: one umbrella product, verticals per tenant's clinicType ----
    // LEADSERVE Clinics is the platform. Each clinic (tenant) is set up with the
    // clinic type it operates as; the app adapts its clinical modules to that type.
    // One brand, not separate products. Ophthalmology ("eye") is just one type.
    const CLINIC_TYPES = {
        eye:     { label: "Eye Center",    vertical: "Ophthalmology",   icon: "👁️" },
        dental:  { label: "Dental Clinic", vertical: "Dentistry",       icon: "🦷" },
        lab:     { label: "Laboratory",    vertical: "Diagnostics",     icon: "🧪" },
        general: { label: "Clinic",        vertical: "General practice", icon: "🏥" },
    };
    APP_CONFIG.appName = "LEADSERVE CMS";
    APP_CONFIG.tagline = "Clinic Management System";
    window.LEADSERVE_CLINIC_TYPES = CLINIC_TYPES;

    function getStoredTenant() {
        try { return localStorage.getItem(APP_CONFIG.tenantStorageKey) || ""; }
        catch (e) { return ""; }
    }

    function setStoredTenant(tenantId) {
        try { if (tenantId) localStorage.setItem(APP_CONFIG.tenantStorageKey, tenantId); }
        catch (e) {}
    }

    // Minimal placeholder profile for a dynamically-provisioned clinic (one that
    // lives in Firestore under clinics/{id}, not in the static TENANTS registry).
    // Its identity + modules are filled from Firestore after Firebase is ready.
    function dynamicTenantProfile(id) {
        return {
            clinicId: id, clinicName: id, clinicShortName: id,
            pageTitle: APP_CONFIG.appName, address: "", contactInfo: "", physicianInfo: "",
            logoPath: "assets/logo.png", firebase: LEADSERVE_FIREBASE,
            firestore: { collectionMode: "tenantPath" },
            modules: undefined, dynamic: true,
        };
    }

    // A requested tenant is honored if it's a known static tenant OR we're in
    // leadserve (multi-tenant) mode — in which case it may be a dynamic clinic.
    const tenantId = (requestedTenant && (TENANTS[requestedTenant] || leadserveRequested))
        ? requestedTenant
        : leadserveRequested
            ? (getStoredTenant() || APP_CONFIG.defaultTenantId)
            : APP_CONFIG.defaultTenantId;

    if (leadserveRequested) setStoredTenant(tenantId);

    const activeTenant = TENANTS[tenantId] || dynamicTenantProfile(tenantId);
    const isLeadserveMode = Boolean(leadserveRequested);
    const appTitle = isLeadserveMode
        ? `${APP_CONFIG.appName} - ${activeTenant.clinicShortName || activeTenant.clinicName}`
        : activeTenant.pageTitle;

    const config = {
        ...activeTenant,
        appName: APP_CONFIG.appName,
        appTitle,
        tenantId,
        activeTenantId: tenantId,
        isLeadserveMode,
        firebase: isLeadserveMode ? LEADSERVE_FIREBASE : activeTenant.firebase,
        tenants: TENANTS,
        tenantApp: APP_CONFIG,
        appLogoPath: APP_CONFIG.appLogoPath,
        firestore: {
            ...(activeTenant.firestore || {}),
            collectionMode: isLeadserveMode ? "tenantPath" : ((activeTenant.firestore || {}).collectionMode || "legacyRoot"),
            tenantPathRoot: APP_CONFIG.tenantPathRoot
        },
        clinicAddress: activeTenant.address,
        clinicContact: `Contact: ${activeTenant.contactInfo} | Physician: ${activeTenant.physicianInfo}`
    };

    // Module entitlement guard: redirect out of any ADD-ON module page that is not
    // enabled for this tenant. Runs immediately (before render) so a disabled module
    // never flashes. Core modules always pass. This is CONVENIENCE gating — the real
    // enforcement is server-side in Firestore rules (see ROADMAP v2).
    (function moduleGuard() {
        const seg = (window.location.pathname.split("/modules/")[1] || "");
        const key = seg ? seg.split("/")[0].toLowerCase() : "";
        if (!key) return; // not a module page (landing, login, leadserve)
        const CORE = ["registration", "consultation", "charge-slip", "pos", "settings", "dental-chart"];
        if (CORE.indexOf(key) !== -1) return;
        const mods = activeTenant && activeTenant.modules;
        if (!mods) return; // dynamic tenant: modules load async -> applyServerEntitlement decides
        if (mods[key] !== true) {
            const depth = Math.max(0, window.location.pathname.split("/").length - 2);
            try { alert("This module is not enabled for your clinic."); } catch (e) {}
            window.location.replace("../".repeat(depth) + "index.html");
        }
    })();

    function landingUrl() {
        const depth = Math.max(0, window.location.pathname.split("/").length - 2);
        const prefix = depth > 0 ? "../".repeat(depth) : "";
        return prefix + "leadserve.html";
    }

    function tenantAwareUrl(href) {
        if (!config.isLeadserveMode || !href) return href;
        if (/^(https?:|mailto:|tel:|#)/i.test(href)) return href;

        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return href;

        url.searchParams.set(APP_CONFIG.leadserveQueryParam, "1");
        url.searchParams.set(APP_CONFIG.tenantQueryParam, config.tenantId);
        return url.pathname + url.search + url.hash;
    }

    function decorateTenantLinks(root) {
        if (!config.isLeadserveMode) return;
        const scope = root || document;

        scope.querySelectorAll("a[href]").forEach((link) => {
            const raw = link.getAttribute("href");
            if (!raw || link.dataset.tenantDecorated === "1") return;
            link.setAttribute("href", tenantAwareUrl(raw));
            link.dataset.tenantDecorated = "1";
        });

        scope.querySelectorAll("iframe[src]").forEach((frame) => {
            const raw = frame.getAttribute("src");
            if (!raw || frame.dataset.tenantDecorated === "1") return;
            frame.setAttribute("src", tenantAwareUrl(raw));
            frame.dataset.tenantDecorated = "1";
        });
    }

    function tenantCollectionPath(collectionPath) {
        const firestoreConfig = config.firestore || {};
        const collectionMode = firestoreConfig.collectionMode || "legacyRoot";
        if (collectionMode !== "tenantPath") return collectionPath;
        if (!collectionPath || typeof collectionPath !== "string") return collectionPath;
        if (collectionPath.indexOf("/") !== -1) return collectionPath;

        const globals = new Set(APP_CONFIG.globalCollections.concat(firestoreConfig.globalCollections || []));
        if (globals.has(collectionPath)) return collectionPath;

        const root = firestoreConfig.tenantPathRoot || APP_CONFIG.tenantPathRoot;
        return `${root}/${config.tenantId}/${collectionPath}`;
    }

    function initOMSFirestore(rawDb) {
        if (!rawDb || typeof rawDb.collection !== "function") return rawDb;
        if (rawDb.__omsTenantWrapped) {
            window.db = rawDb;
            return rawDb;
        }

        const nativeCollection = rawDb.collection.bind(rawDb);
        rawDb.collection = function (collectionPath) {
            return nativeCollection(tenantCollectionPath(collectionPath));
        };
        rawDb.__omsTenantWrapped = true;
        rawDb.__omsTenantId = config.tenantId;
        rawDb.__omsCollectionPath = tenantCollectionPath;
        window.db = rawDb;
        return rawDb;
    }

    // Fill any [data-clinic="KEY"] element from the active tenant config.
    // Reusable for print letterheads: call window.applyClinicIdentity(node)
    // after building dynamic content. Keys: name, shortName, address, contact, physician, appName.
    function applyClinicIdentity(root) {
        const scope = root || document;
        const map = {
            name: config.clinicName,
            shortName: config.clinicShortName || config.clinicName,
            address: config.address || "",
            contact: config.contactInfo || "",
            physician: config.physicianInfo || "",
            appName: config.appName
        };
        scope.querySelectorAll("[data-clinic]").forEach((el) => {
            const key = el.getAttribute("data-clinic");
            if (Object.prototype.hasOwnProperty.call(map, key) && map[key] != null) {
                el.textContent = map[key];
            }
        });
    }

    function applyBranding() {
        if (config.appTitle) document.title = config.appTitle;
        if (config.isLeadserveMode) {
            const icon = document.querySelector('link[rel="icon"]');
            if (icon) icon.href = config.appLogoPath;
        }

        const brandNames = document.querySelectorAll(".brand .name");
        brandNames.forEach((el) => {
            el.textContent = config.isLeadserveMode ? config.appName : config.pageTitle;
        });

        const metas = document.querySelectorAll(".brand .meta");
        if (metas.length >= 2) {
            if (config.isLeadserveMode) {
                metas[0].textContent = `Active clinic: ${config.clinicName}`;
                metas[1].innerHTML = `${config.address}<br>${config.contactInfo} &bull; ${config.physicianInfo}`;
            } else {
                metas[0].textContent = config.address;
                metas[1].innerHTML = `${config.contactInfo} &bull; ${config.physicianInfo}`;
            }
        }

        const depth = Math.max(0, window.location.pathname.split("/").length - 2);
        const prefix = depth > 0 ? "../".repeat(depth) : "";
        const logoPath = config.isLeadserveMode && onLeadservePage ? config.appLogoPath : config.logoPath;
        document.querySelectorAll('img[alt$="OMS"], img[alt$="OMS Logo"], img[alt="Logo"], img[src$="/assets/logo.png"], img[src="../../assets/logo.png"], img[src="assets/logo.png"]').forEach((img) => {
            img.src = prefix + logoPath;
            img.alt = config.clinicName;
            if (config.isLeadserveMode) {
                img.onerror = function () {
                    this.style.display = "none";
                };
            }
        });

        if (config.isLeadserveMode && !onLeadservePage) {
            document.querySelectorAll(".top-actions").forEach((actions) => {
                if (actions.querySelector("[data-leadserve-landing]")) return;
                const link = document.createElement("a");
                link.className = "btn home";
                link.href = landingUrl();
                link.textContent = "Landing";
                link.title = "Back to LEADSERVE landing";
                link.dataset.leadserveLanding = "1";
                link.dataset.tenantDecorated = "1";
                actions.appendChild(link);
            });
        }

        const footer = document.querySelector("footer");
        if (footer) {
            footer.innerHTML = config.isLeadserveMode
                ? `${config.appName} &bull; ${config.clinicName} &bull; ${config.address}`
                : `${config.clinicName} &bull; ${config.address} &bull; ${config.contactInfo}`;
        }

        if (config.isLeadserveMode) {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            const textNodes = [];
            while (walker.nextNode()) textNodes.push(walker.currentNode);
            textNodes.forEach((node) => {
                node.nodeValue = node.nodeValue
                    .replace(/\b(?:LEADSERVE|LCELC|MSN) OMS\b/g, config.appName);
            });
        }

        applyClinicIdentity(document);
        decorateTenantLinks(document);
    }

    // Single source of truth for entitlement: once Firebase is up, read the
    // server's settings/entitlement doc and reconcile the CLIENT with it — retile
    // the landing and redirect out of any now-disabled module page. The hardcoded
    // config.modules is only the pre-load default. Fail-open: if the doc is absent
    // or unreadable, keep the defaults. (The Firestore rules are the real gate;
    // this just keeps the UI honest.)
    // For a dynamic (Firestore-backed) clinic, load its profile (name/type/address)
    // from clinics/{tenantId} and re-apply branding. 'clinics' is a global collection,
    // so it is not tenant-prefixed by the firestore patch.
    async function loadTenantProfile() {
        try {
            if (!config.isLeadserveMode || !window.firebase || !firebase.firestore) return;
            const snap = await firebase.firestore().collection("clinics").doc(config.tenantId).get();
            if (!snap.exists) return;
            const d = snap.data() || {};
            if (d.clinicName) config.clinicName = d.clinicName;
            config.clinicShortName = d.clinicShortName || d.clinicName || config.clinicShortName;
            if (d.clinicType) config.clinicType = d.clinicType;
            if (d.address) { config.address = d.address; config.clinicAddress = d.address; }
            config.pageTitle = config.clinicName;
            Object.assign(window.OMS_CONFIG, {
                clinicName: config.clinicName, clinicShortName: config.clinicShortName,
                clinicType: config.clinicType, address: config.address, clinicAddress: config.clinicAddress,
            });
            document.title = `${APP_CONFIG.appName} - ${config.clinicShortName || config.clinicName}`;
            applyBranding();
            if (window.applyTileVisibility) window.applyTileVisibility(); // re-gate by clinicType
        } catch (e) { /* keep placeholder */ }
    }

    async function applyServerEntitlement() {
        try {
            if (!window.firebase || !firebase.firestore) return;
            const snap = await firebase.firestore().collection("settings").doc("entitlement").get();
            if (!snap.exists) return;
            const mods = (snap.data() || {}).modules;
            if (!mods || typeof mods !== "object") return;

            config.modules = Object.assign({}, config.modules, mods);
            window.OMS_CONFIG.modules = config.modules;

            if (window.applyTileVisibility) {
                window.applyTileVisibility(); // handles both entitlement + clinicType
            } else {
                document.querySelectorAll(".module-tile[data-module]").forEach((tile) => {
                    tile.style.display = config.modules[tile.getAttribute("data-module")] === true ? "" : "none";
                });
            }

            const seg = (window.location.pathname.split("/modules/")[1] || "");
            const key = seg ? seg.split("/")[0].toLowerCase() : "";
            const CORE = ["registration", "consultation", "charge-slip", "pos", "settings", "dental-chart"];
            if (key && CORE.indexOf(key) === -1 && config.modules[key] !== true) {
                const depth = Math.max(0, window.location.pathname.split("/").length - 2);
                window.location.replace("../".repeat(depth) + "index.html");
            }
        } catch (e) { /* fail-open */ }
    }

    function syncEntitlementWhenReady() {
        let tries = 0;
        const timer = setInterval(() => {
            if ((window.firebase && firebase.firestore) || tries > 100) {
                clearInterval(timer);
                loadTenantProfile().then(applyServerEntitlement);
            }
            tries++;
        }, 100);
    }

    window.OMS_TENANTS = TENANTS;
    window.OMS_CONFIG = config;
    window.OMS_ACTIVE_TENANT = activeTenant;
    window.withTenantParams = tenantAwareUrl;
    window.decorateTenantLinks = decorateTenantLinks;
    window.tenantCollectionPath = tenantCollectionPath;
    window.initOMSFirestore = initOMSFirestore;
    window.applyClinicIdentity = applyClinicIdentity;
    window.applyServerEntitlement = applyServerEntitlement;

    document.addEventListener("DOMContentLoaded", applyBranding);
    document.addEventListener("DOMContentLoaded", syncEntitlementWhenReady);
})();
