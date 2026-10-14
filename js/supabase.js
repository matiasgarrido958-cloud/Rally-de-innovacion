// Cliente mínimo para la API REST de Supabase (PostgREST + Auth), sin dependencias.
// Mismo cliente que Fast Check INNEXA, con upsert para la tabla genérica rally_items.
const SESSION_KEY = 'rally-session';

class AuthError extends Error {}

let session = loadSession();

function loadSession() {
    try {
        const stored = localStorage.getItem(SESSION_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        return null;
    }
}

function storeSession(data) {
    session = data ? {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at || Math.floor(Date.now() / 1000) + data.expires_in,
        email: data.user ? data.user.email : (session && session.email)
    } : null;
    try {
        if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        else localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* sin storage */ }
}

function currentUserEmail() {
    return session ? session.email : null;
}

function errorDetail(text) {
    try {
        const json = JSON.parse(text);
        return [json.message || json.msg || json.error_description, json.hint].filter(Boolean).join(' — ') || text;
    } catch (e) {
        return text;
    }
}

async function authRequest(path, body, accessToken = null) {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
    const headers = { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
        method: 'POST', headers, body: JSON.stringify(body || {})
    });
    const text = await response.text();
    if (!response.ok) {
        const error = new AuthError(errorDetail(text));
        error.status = response.status;
        throw error;
    }
    return text ? JSON.parse(text) : null;
}

async function signIn(email, password) {
    storeSession(await authRequest('token?grant_type=password', { email, password }));
}

async function signOut() {
    const token = session && session.access_token;
    storeSession(null);
    if (token) await authRequest('logout', {}, token).catch(() => {});
}

async function refreshSession() {
    if (!session) throw new AuthError('Sin sesión');
    try {
        storeSession(await authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token }));
    } catch (error) {
        // Solo una respuesta del servidor invalida la sesión; un fallo de red no.
        if (error instanceof AuthError) storeSession(null);
        throw error;
    }
}

async function getAccessToken() {
    if (!session) throw new AuthError('Sin sesión');
    if (session.expires_at - 60 < Date.now() / 1000) await refreshSession();
    return session.access_token;
}

async function supabaseCall(method, endpoint, body = null, { prefer = '', retried = false } = {}) {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${await getAccessToken()}`,
        // Sin esto, POST/PATCH responden 201/204 sin cuerpo.
        'Prefer': ['return=representation', prefer].filter(Boolean).join(',')
    };

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    if (response.status === 401 && !retried) {
        await refreshSession();
        return supabaseCall(method, endpoint, body, { prefer, retried: true });
    }
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        const error = response.status === 401
            ? new AuthError(errorDetail(text))
            : new Error(`HTTP ${response.status}: ${errorDetail(text)}`);
        console.error('Supabase error:', error);
        throw error;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

// Inserta o reemplaza filas por id (una o varias).
function supabaseUpsert(table, rows) {
    return supabaseCall('POST', `${table}?on_conflict=id`, rows, { prefer: 'resolution=merge-duplicates' });
}

function supabaseDelete(table, id) {
    return supabaseCall('DELETE', `${table}?id=eq.${encodeURIComponent(id)}`);
}
