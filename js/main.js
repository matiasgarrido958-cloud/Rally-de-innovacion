// Arranque: sesión, navegación y eventos globales.

function showLogin(message = '') {
    connected = false;
    items = [];
    currentEditingId = null;
    hasUnsavedChanges = false;
    document.getElementById('modal').classList.remove('open');
    document.getElementById('appScreen').hidden = true;
    document.getElementById('loginScreen').hidden = false;
    const errorBox = document.getElementById('loginError');
    errorBox.textContent = message;
    errorBox.hidden = !message;
    const emailInput = document.getElementById('loginEmail');
    document.getElementById('loginEmailGroup').hidden = Boolean(TEAM_EMAIL);
    emailInput.required = !TEAM_EMAIL;
    if (TEAM_EMAIL) emailInput.value = TEAM_EMAIL;
    document.getElementById(TEAM_EMAIL ? 'loginPassword' : 'loginEmail').focus();
}

function showApp() {
    document.getElementById('loginScreen').hidden = true;
    document.getElementById('appScreen').hidden = false;
    document.getElementById('localBanner').hidden = !LOCAL_MODE;
    document.getElementById('btnLogout').hidden = LOCAL_MODE;
    currentView = (location.hash || '#inicio').slice(1);
    if (!VIEWS.some(v => v.id === currentView)) currentView = 'inicio';
    renderUser();
    loadItems();
}

// Si la sesión expiró o fue revocada, vuelve al login. Devuelve true si lo manejó.
function handleAuthError(error) {
    if (!(error instanceof AuthError)) return false;
    clearCache();
    showLogin('Tu sesión expiró. Vuelve a iniciar sesión.');
    return true;
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = document.getElementById('btnLogin');
    const errorBox = document.getElementById('loginError');
    button.disabled = true;
    errorBox.hidden = true;
    try {
        const email = TEAM_EMAIL || document.getElementById('loginEmail').value.trim();
        await signIn(email, document.getElementById('loginPassword').value);
        document.getElementById('loginPassword').value = '';
        showApp();
    } catch (error) {
        console.error('Login error:', error);
        errorBox.textContent = error instanceof AuthError && error.status === 400
            ? (TEAM_EMAIL ? 'Contraseña incorrecta.' : 'Correo o contraseña incorrectos.')
            : `No se pudo iniciar sesión: ${error.message}`;
        errorBox.hidden = false;
    } finally {
        button.disabled = false;
    }
});

document.getElementById('btnLogout').addEventListener('click', async () => {
    if (hasUnsavedChanges && !confirm('¿Descartar cambios sin guardar?')) return;
    await signOut();
    clearCache();
    showLogin();
});

document.getElementById('userChip').addEventListener('click', askEditorName);

// Navegación entre secciones (también con enlaces #vista).
document.getElementById('views').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-view]');
    if (tab) goToView(tab.dataset.view);
});
window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (id && id !== currentView) goToView(id);
});

// --- Modo claro / oscuro ---
// Por defecto sigue al sistema; el botón lo fija en este navegador.
function effectiveTheme() {
    const forced = document.documentElement.dataset.theme;
    if (forced) return forced;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

document.getElementById('btnTheme').addEventListener('click', () => {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('rally-theme', next); } catch (e) { /* sin storage */ }
});

// El reloj y la cuenta regresiva se actualizan solos cada 30 s.
setInterval(() => {
    renderClock();
    const countdown = document.getElementById('countdown');
    if (countdown) countdown.innerHTML = countdownHtml();
}, 30000);

window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges || pendingWrites) e.preventDefault();
});

setupInlineEditing();

if (LOCAL_MODE || currentUserEmail()) showApp();
else showLogin();
