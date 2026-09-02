class MSNHeader extends HTMLElement {
    connectedCallback() {
        // 1. Smart Path Resolver (Prevents broken logos on VS Code Live Server vs Firebase)
        const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
        const inModule = window.location.pathname.includes('/modules/');
        const basePath = isLocal ? (inModule ? '../../' : './') : '/';

        const config = window.OMS_CONFIG || {};
        const onLeadserveLanding = /\/leadserve(?:\.html|\/|$)/i.test(window.location.pathname || '');
        const configuredLogo = config.isLeadserveMode && onLeadserveLanding
            ? (config.appLogoPath || 'assets/leadserve-logo.png')
            : (config.logoPath || 'assets/logo.png');
        const tenantAwareUrl = typeof window.withTenantParams === 'function'
            ? window.withTenantParams
            : (href) => href;
        const logoPath = basePath === '/' ? '/' + configuredLogo : basePath + configuredLogo;
        const homePath = tenantAwareUrl(basePath === '/' ? '/index.html' : basePath + 'index.html');
        const landingPath = tenantAwareUrl(basePath === '/' ? '/leadserve.html' : basePath + 'leadserve.html');
        const logoutPath = config.isLeadserveMode ? landingPath : homePath;
        const landingLink = config.isLeadserveMode
            ? `<a href="${landingPath}" data-leadserve-landing="1" data-tenant-decorated="1" style="background:transparent; color:#111827; border:1px solid rgba(17,24,39,0.2); padding:6px 18px; border-radius:99px; font-size:13px; font-weight:600; text-decoration:none; transition:background 0.2s; display:inline-block;">Landing</a>`
            : '';

        // 2. Pull Clinic Info from config.js (Falls back to default if missing)
        const clinicName = config.isLeadserveMode ? (config.appName || "LEADSERVE OMS") : (config.clinicName || "LEADSERVE OMS");
        const clinicAddress = config.clinicAddress || "Demo City, Philippines";
        const clinicContact = config.clinicContact || "Contact: Contact details available at the clinic • Physician: Attending Ophthalmologist";

        // 3. The HTML & Styling (Clean White Apple-Style Theme)
        this.innerHTML = `
        <header class="noprint" style="background: rgba(255, 255, 255, 0.96); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(17, 24, 39, 0.08); color: #111827; padding:12px 24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; position:sticky; top:0; z-index:999; box-shadow:0 2px 10px rgba(0,0,0,0.05); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <div style="display:flex; align-items:center; gap:16px;">
                <img src="${logoPath}" alt="Logo" style="height:72px; width:72px; object-fit:contain; border-radius:8px; padding:4px; display:block !important;">
                <div>
                    <div style="font-size:18px; font-weight:bold; margin-bottom:2px; letter-spacing:-0.2px; color:#111827;">${clinicName}</div>
                    <div style="font-size:12px; line-height:1.4; color:#4b5563;">${clinicAddress}</div>
                    <div style="font-size:12px; line-height:1.4; color:#4b5563;">${clinicContact}</div>
                </div>
            </div>
            <div class="noprint" style="display:flex; gap:12px; align-items:center;">
                <button id="msn-logout-btn" style="background:transparent; color:#111827; border:1px solid rgba(17,24,39,0.2); padding:6px 18px; border-radius:99px; font-size:13px; font-weight:600; cursor:pointer; transition:background 0.2s;">Logout</button>
                <a href="${homePath}" style="background:transparent; color:#111827; border:1px solid rgba(17,24,39,0.2); padding:6px 18px; border-radius:99px; font-size:13px; font-weight:600; text-decoration:none; transition:background 0.2s; display:inline-block;">Home</a>
                ${landingLink}
            </div>
        </header>
        `;

        // 4. Initialize Buttons and Security
        this.setupInteractions(logoutPath);
        this.setupIdleTimeout(logoutPath);
    }

    setupInteractions(homePath) {
        const logoutBtn = this.querySelector('#msn-logout-btn');
        const homeBtn = this.querySelector('a');

        // Add dark hover effects for the light background
        if (logoutBtn) {
            logoutBtn.addEventListener('mouseover', () => logoutBtn.style.background = 'rgba(17,24,39,0.05)');
            logoutBtn.addEventListener('mouseout', () => logoutBtn.style.background = 'transparent');
            logoutBtn.addEventListener('click', () => this.executeLogout(homePath));
        }
        if (homeBtn) {
            homeBtn.addEventListener('mouseover', () => homeBtn.style.background = 'rgba(17,24,39,0.05)');
            homeBtn.addEventListener('mouseout', () => homeBtn.style.background = 'transparent');
        }
    }

    executeLogout(homePath) {
        if (window.firebase && firebase.auth) {
            firebase.auth().signOut().then(() => {
                // Route user back to the login/index page
                window.location.href = homePath;
            }).catch(err => console.error("Logout Error:", err));
        }
    }

    // UPDATED IDLE TIMER LOGIC
    setupIdleTimeout(homePath) {
        let idleTimer;

        const resetTimer = () => {
            // 1. explicitly kill old timer
            if (idleTimer) {
                clearTimeout(idleTimer);
            }

            // Only start the countdown if Firebase is loaded and a user is logged in
            if (window.firebase && firebase.auth && firebase.auth().currentUser) {
                // 180,000 milliseconds = 3 minutes
                idleTimer = setTimeout(() => {
                    alert("You have been logged out due to inactivity.");
                    this.executeLogout(homePath);
                }, 180000);
            }
        };

        // Added standard 'scroll' and 'touchstart' to catch mobile/trackpad usage
        const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'wheel', 'touchstart', 'touchmove', 'MSPointerMove'];
        events.forEach(e => document.addEventListener(e, resetTimer, { passive: true }));

        // Track authentication state cleanly
        if (window.firebase && firebase.auth) {
            firebase.auth().onAuthStateChanged(user => {
                if (user) {
                    resetTimer();
                } else {
                    if (idleTimer) clearTimeout(idleTimer);
                }
            });
        }
    }
}

// Register the custom element
customElements.define('msn-header', MSNHeader);