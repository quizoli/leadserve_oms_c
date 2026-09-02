// auth-guard.js
(function () {
    // Admins come from the tenant config (config.js -> activeTenant.adminEmails);
    // additional admins can be granted per-user via oms_users profile (isAdmin/role).
    const ADMIN_EMAILS = (window.OMS_CONFIG && window.OMS_CONFIG.adminEmails) || [];
    const LEGACY_EMAIL_PERMISSIONS = {};

    function authRedirectUrl() {
        const config = window.OMS_CONFIG || {};
        if (config.isLeadserveMode) {
            const url = new URL('/leadserve.html', window.location.origin);
            if (config.tenantId) url.searchParams.set('tenant', config.tenantId);
            return url.pathname + url.search;
        }
        return '/login.html';
    }

    function waitForFirebase() {
        return new Promise((resolve) => {
            const started = Date.now();
            const timer = setInterval(() => {
                if (window.firebase && firebase.apps && firebase.auth && firebase.firestore) {
                    clearInterval(timer);
                    resolve(true);
                } else if (Date.now() - started > 10000) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, 50);
        });
    }

    async function currentUser() {
        await waitForFirebase();
        return new Promise((resolve) => {
            const unsub = firebase.auth().onAuthStateChanged((user) => {
                if (typeof unsub === "function") unsub();
                resolve(user || null);
            });
        });
    }

    async function findProfileByEmail(email) {
        if (!email) return null;
        try {
            const snap = await firebase.firestore()
                .collection("oms_users")
                .where("email", "==", email)
                .limit(1)
                .get();
            if (!snap.empty) return snap.docs[0].data() || null;
        } catch (err) {
            console.warn("Could not query oms_users profile by email:", err);
        }
        return null;
    }

    async function loadUserAccess(user) {
        if (!user) return { user: null, profile: null, isAdmin: false, permissions: {} };
        const email = String(user.email || "").toLowerCase();
        let profile = null;
        let isAdmin = ADMIN_EMAILS.includes(email);
        try {
            const snap = await firebase.firestore().collection("oms_users").doc(user.uid).get();
            if (snap.exists) {
                profile = snap.data() || {};
                isAdmin = isAdmin || profile.isAdmin === true || profile.role === "admin";
            }
        } catch (err) {
            console.warn("Could not read oms_users profile:", err);
        }
        if (!profile) {
            profile = await findProfileByEmail(email);
            if (profile) {
                isAdmin = isAdmin || profile.isAdmin === true || profile.role === "admin";
            }
        }
        const permissions = {
            ...(LEGACY_EMAIL_PERMISSIONS[email] || {}),
            ...((profile && profile.permissions) || {})
        };
        return { user, profile, isAdmin, permissions };
    }

    async function hasModuleAccess(moduleKey) {
        const user = await currentUser();
        const access = await loadUserAccess(user);
        if (!access.user) return false;
        if (access.isAdmin) return true;
        if (access.profile && access.profile.status === "inactive") return false;
        return access.permissions[moduleKey] === true;
    }

    async function requireModuleAccess(moduleKey, options = {}) {
        const allowed = await hasModuleAccess(moduleKey);
        if (allowed) return true;
        if (options.hideSelector) {
            document.querySelectorAll(options.hideSelector).forEach(el => el.classList.add("hidden"));
        }
        if (options.messageSelector) {
            const msg = document.querySelector(options.messageSelector);
            if (msg) {
                msg.classList.remove("hidden");
                msg.textContent = options.message || "You do not have access to this module.";
            }
        }
        if (options.redirect !== false) {
            window.location.href = options.redirectTo || "/index.html";
        }
        return false;
    }

    window.OMSAuth = {
        authRedirectUrl,
        currentUser,
        loadUserAccess,
        hasModuleAccess,
        requireModuleAccess
    };

    window.addEventListener('load', async () => {
        await waitForFirebase();
        if (!window.firebase || !firebase.auth) return;
        firebase.auth().onAuthStateChanged((user) => {
            if (!user) {
                console.warn("Unauthorized access detected. Redirecting to login...");
                window.location.href = authRedirectUrl();
            }
        });
    });
})();
