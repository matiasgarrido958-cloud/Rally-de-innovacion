// Núcleo del workspace: datos, sincronización con Supabase, utilidades y
// edición en línea. Las vistas están en js/ideas.js y js/vistas.js; el arranque
// (sesión y eventos globales) en js/main.js.
const { TABLE, SYNC_INTERVAL_MS, TEAM_EMAIL, SUPABASE_URL } = window.APP_CONFIG;
const L = window.LINEAMIENTOS;
const LOCAL_MODE = !SUPABASE_URL;
const CACHE_KEY = 'rally-items';
const NAME_KEY = 'rally-editor-name';

// Cada elemento del workspace es una fila de rally_items: { id, kind, data, position, updated_by, updated_at }.
let items = [];
// Solo se sincroniza con Supabase si la carga inicial funcionó; si no, la
// tabla vacía de Supabase reemplazaría lo que hay en el cache local.
let connected = false;
let pendingWrites = 0;
let lastSyncAt = null;
let currentView = 'inicio';
// Edición de ideas en el modal (js/ideas.js).
let currentEditingId = null;
let hasUnsavedChanges = false;

// Vistas registradas por js/ideas.js y js/vistas.js:
// { id, label, order, render(), actions?, onInput?, badge? }.
const VIEWS = [];
function registerView(view) {
    VIEWS.push(view);
    VIEWS.sort((a, b) => a.order - b.order);
}

// --- Utilidades ---

function showToast(msg, type = 'success', durationMs = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    document.getElementById('toasts').appendChild(toast);
    setTimeout(() => toast.remove(), durationMs);
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML.replace(/"/g, '&quot;');
}

function findOption(list, id) {
    return list.find(o => o.id === id) || { id, label: id || '—', color: 'var(--k-neutral)' };
}

function chip(option, extraClass = '') {
    return `<span class="chip ${extraClass}" style="--c:${option.color || 'var(--k-neutral)'}"><span class="dot"></span>${escapeHtml(option.label)}</span>`;
}

function initials(name) {
    return String(name || '?').trim().charAt(0).toUpperCase() || '?';
}

function samePerson(a, b) {
    const norm = s => String(s || '').trim().toLowerCase();
    return norm(a) && norm(a) === norm(b);
}

function randomId(prefix) {
    return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setPath(obj, path, value) {
    const keys = path.split('.');
    let o = obj;
    for (const k of keys.slice(0, -1)) {
        if (typeof o[k] !== 'object' || o[k] === null) o[k] = {};
        o = o[k];
    }
    o[keys[keys.length - 1]] = value;
}

function timeAgo(value) {
    if (!value) return 'nunca';
    const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
    const seconds = Math.round((date - Date.now()) / 1000);
    if (Number.isNaN(seconds)) return '';
    const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
    }
    return 'hace un momento';
}

// --- Hora del Rally (todo en hora de Chile, America/Santiago) ---

const CHILE_TZ = 'America/Santiago';

function chileParts(date) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: CHILE_TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).formatToParts(date);
    return Object.fromEntries(parts.map(p => [p.type, p.value]));
}

// 'YYYY-MM-DDTHH:MM' en hora Chile → Date. Funciona con o sin horario de verano.
function chileToDate(local) {
    const guess = new Date(`${local}:00Z`);
    if (Number.isNaN(guess.getTime())) return null;
    const p = chileParts(guess);
    const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - guess.getTime();
    return new Date(guess.getTime() - offset);
}

function formatChile(date, { withDay = true } = {}) {
    if (!date) return '';
    const p = chileParts(date);
    return withDay ? `${p.hour}:${p.minute} ${p.day}/${p.month}` : `${p.hour}:${p.minute}`;
}

function h0Date() {
    return chileToDate(general().h0 || L.H0_DEFAULT) || chileToDate(L.H0_DEFAULT);
}

function hourToDate(h) {
    return new Date(h0Date().getTime() + Number(h) * 3600000);
}

// Hora actual del Rally (H decimal; negativa antes de la apertura).
function currentH() {
    return (Date.now() - h0Date().getTime()) / 3600000;
}

function formatDuration(ms) {
    const total = Math.max(0, Math.round(ms / 60000));
    const d = Math.floor(total / 1440);
    const h = Math.floor((total % 1440) / 60);
    const m = total % 60;
    if (d) return `${d} d ${h} h`;
    if (h) return `${h} h ${String(m).padStart(2, '0')} min`;
    return `${m} min`;
}

// --- Acceso a los datos ---

function byKind(kind) {
    return items.filter(i => i.kind === kind).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

function getItem(id) {
    return items.find(i => i.id === id) || null;
}

function makeItem(id, kind, data = {}, position = 0) {
    return { id, kind, data, position, updated_by: editorName(), updated_at: new Date().toISOString() };
}

// Ajustes (kind 'setting', id 'set:<clave>').
function setting(key) {
    const item = getItem(`set:${key}`);
    return item ? item.data : {};
}

function general() {
    return setting('general');
}

function isChecked(checkId) {
    const item = getItem(`chk:${checkId}`);
    return Boolean(item && item.data.checked);
}

function checkInfo(checkId) {
    const item = getItem(`chk:${checkId}`);
    return item && item.data.checked ? item.data : null;
}

function members() {
    return byKind('member').filter(m => (m.data.name || '').trim());
}

function peopleNames() {
    const names = new Set(members().map(m => m.data.name.trim()));
    byKind('task').forEach(t => t.data.owner && names.add(t.data.owner.trim()));
    byKind('idea').forEach(i => i.data.owner && names.add(i.data.owner.trim()));
    return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
}

function peopleDatalist() {
    return `<datalist id="people">${peopleNames().map(n => `<option value="${escapeHtml(n)}">`).join('')}</datalist>`;
}

// --- Cache local y modo local ---

function saveCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(items)); } catch (e) { /* sin storage */ }
}

function clearCache() {
    try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* sin storage */ }
}

function readCache() {
    try {
        const stored = localStorage.getItem(CACHE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        return null;
    }
}

// Contenido inicial del workspace (sale de js/lineamientos.js).
function seedItems() {
    const seed = [];
    L.TASKS.forEach((t, i) => seed.push(makeItem(t.id, 'task', {
        title: t.title, deliverable: t.deliverable, hour: t.hour, note: t.note || '', owner: '', status: 'pendiente'
    }, i)));
    L.DECISIONS.forEach((d, i) => seed.push(makeItem(d.id, 'decision', {
        title: d.title, options: d.options, decision: '', date: ''
    }, i)));
    L.MEMBERS.forEach((m, i) => seed.push(makeItem(`M-${String(i + 1).padStart(2, '0')}`, 'member', {
        name: m.name, career: m.career, role: m.role, role2: m.role2 || '', availability: '',
        profile: 'estudiante', engineering: Boolean(m.engineering), woman: false, leader: Boolean(m.leader), registered: false
    }, i)));
    seed.push(makeItem('set:general', 'setting', { team_name: '', h0: L.H0_DEFAULT }));
    return seed;
}

// --- Carga y guardado ---

async function loadItems() {
    if (LOCAL_MODE) {
        items = readCache() || seedItems();
        connected = true;
        saveCache();
        render();
        return;
    }
    try {
        const data = await supabaseCall('GET', `${TABLE}?order=id`);
        if (Array.isArray(data) && data.length > 0) {
            items = data;
        } else {
            items = seedItems();
            await supabaseUpsert(TABLE, items);
            showToast('✓ Workspace inicializado en Supabase con las tareas y decisiones base', 'success', 5000);
        }
        connected = true;
        lastSyncAt = new Date();
        saveCache();
    } catch (error) {
        connected = false;
        if (handleAuthError(error)) return;
        console.error('Error loading from Supabase:', error);
        showToast(`⚠️ Error conectando a Supabase, usando cache local. Detalle: ${error.message}`, 'warning', 15000);
        items = readCache() || seedItems();
    }
    render();
}

// ¿Hay alguien escribiendo en un campo de la página? Entonces no se repinta,
// para no perder el foco ni lo que se está escribiendo.
function isTyping() {
    const el = document.activeElement;
    return Boolean(el && el.closest && el.closest('#content') && el.matches('input, textarea, select'));
}

let renderPending = false;
function requestRender() {
    if (isTyping()) renderPending = true;
    else render();
}

// Sincronización con Supabase (polling). Se pausa mientras se edita una idea,
// mientras alguien escribe en un campo o mientras hay escrituras en curso.
setInterval(async () => {
    if (LOCAL_MODE || !connected || currentEditingId || pendingWrites || isTyping()) return;
    try {
        const data = await supabaseCall('GET', `${TABLE}?order=id`);
        if (!Array.isArray(data) || pendingWrites) return;
        lastSyncAt = new Date();
        if (JSON.stringify(items) !== JSON.stringify(data)) {
            items = data;
            saveCache();
            render();
            showToast('🔄 Sincronizado', 'success', 1500);
        }
        renderSyncInfo();
    } catch (error) {
        if (handleAuthError(error)) return;
        console.error('Sync error:', error);
    }
}, SYNC_INTERVAL_MS);

function upsertLocal(item) {
    const index = items.findIndex(i => i.id === item.id);
    if (index >= 0) items[index] = item;
    else items.push(item);
}

// Guarda un elemento (local al tiro y luego en Supabase). Devuelve true si quedó guardado.
async function saveItem(item, { rerender = true } = {}) {
    item.updated_by = editorName();
    item.updated_at = new Date().toISOString();
    upsertLocal(item);
    saveCache();
    if (rerender) requestRender();
    if (LOCAL_MODE) return true;
    pendingWrites++;
    try {
        await supabaseUpsert(TABLE, [item]);
        return true;
    } catch (error) {
        if (!handleAuthError(error)) showToast(`❌ No se pudo guardar en Supabase: ${error.message}`, 'error', 8000);
        return false;
    } finally {
        pendingWrites--;
    }
}

async function deleteItem(id) {
    items = items.filter(i => i.id !== id);
    saveCache();
    requestRender();
    if (LOCAL_MODE) return true;
    pendingWrites++;
    try {
        await supabaseDelete(TABLE, id);
        return true;
    } catch (error) {
        if (!handleAuthError(error)) showToast(`❌ No se pudo eliminar: ${error.message}`, 'error', 8000);
        return false;
    } finally {
        pendingWrites--;
    }
}

// Actualiza uno o más campos de un elemento (lo crea si no existe).
function updateFields(id, kind, fields, options) {
    const current = getItem(id);
    const item = current ? { ...current, data: JSON.parse(JSON.stringify(current.data)) } : makeItem(id, kind, {}, nextPosition(kind));
    for (const [path, value] of Object.entries(fields)) setPath(item.data, path, value);
    return saveItem(item, options);
}

function nextPosition(kind) {
    const list = byKind(kind);
    return list.length ? Math.max(...list.map(i => i.position)) + 1 : 0;
}

function setChecked(checkId, checked) {
    return updateFields(`chk:${checkId}`, 'check', {
        checked, by: checked ? editorName() : '', at: checked ? new Date().toISOString() : ''
    }, { rerender: false });
}

// --- Edición en línea ---
// Los campos de las vistas llevan data-id (elemento), data-kind y data-field
// (ruta dentro de data, p. ej. "blocks.gancho"). Se guardan al cambiar.
// data-check="<id>" marca una casilla de checklist.

function readControl(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.dataset.type === 'number') return el.value === '' ? null : Number(el.value);
    return el.value;
}

function setupInlineEditing() {
    const content = document.getElementById('content');
    content.addEventListener('change', (e) => {
        const el = e.target;
        if (el.dataset.check) setChecked(el.dataset.check, el.checked);
        else if (el.dataset.field && el.dataset.id) updateFields(el.dataset.id, el.dataset.kind || 'setting', { [el.dataset.field]: readControl(el) }, { rerender: false });
        else return;
        // Casillas y listas se repintan al tiro; los textos, al salir del campo.
        if (el.type === 'checkbox' || el.tagName === 'SELECT') {
            el.blur();
            render();
        } else {
            requestRender();
        }
    });
    // Al salir de los campos, aplica el repintado que quedó pendiente.
    content.addEventListener('focusout', () => {
        setTimeout(() => {
            if (renderPending && !isTyping()) {
                renderPending = false;
                render();
            }
        }, 0);
    });
    content.addEventListener('click', (e) => {
        const button = e.target.closest('[data-action]');
        if (!button) return;
        const view = VIEWS.find(v => v.id === currentView);
        if (view && view.actions && view.actions[button.dataset.action]) view.actions[button.dataset.action](button, e);
    });
    content.addEventListener('input', (e) => {
        const view = VIEWS.find(v => v.id === currentView);
        if (view && view.onInput) view.onInput(e.target);
    });
}

// Fragmentos de formulario reutilizados por las vistas.
function inlineInput(item, field, { kind = item ? item.kind : 'setting', id = item.id, type = 'text', placeholder = '', list = '', cls = '' } = {}) {
    const value = getPath(item ? item.data : {}, field);
    return `<input class="form-input ${cls}" type="${type}" ${type === 'number' ? 'data-type="number"' : ''} data-id="${escapeHtml(id)}" data-kind="${kind}" data-field="${field}" value="${escapeHtml(value ?? '')}" placeholder="${escapeHtml(placeholder)}" ${list ? `list="${list}"` : ''}>`;
}

function inlineTextarea(item, field, { kind = item ? item.kind : 'setting', id = item.id, placeholder = '', rows = 3, cls = '' } = {}) {
    const value = getPath(item ? item.data : {}, field);
    return `<textarea class="form-textarea ${cls}" rows="${rows}" data-id="${escapeHtml(id)}" data-kind="${kind}" data-field="${field}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value ?? '')}</textarea>`;
}

function inlineSelect(item, field, options, { kind = item.kind, id = item.id, placeholder = '' } = {}) {
    const value = getPath(item.data, field) ?? '';
    return `<select class="form-select" data-id="${escapeHtml(id)}" data-kind="${kind}" data-field="${field}">
        ${placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : ''}
        ${options.map(o => `<option value="${escapeHtml(o.id)}" ${o.id === value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
    </select>`;
}

function inlineCheckbox(item, field, label = '') {
    return `<label class="check"><input type="checkbox" data-id="${escapeHtml(item.id)}" data-kind="${item.kind}" data-field="${field}" ${getPath(item.data, field) ? 'checked' : ''}>${label ? `<span>${escapeHtml(label)}</span>` : ''}</label>`;
}

// Casilla de checklist compartido (quién y cuándo la marcó).
function checkRow(entry, { disabled = false, autoValue = null } = {}) {
    if (autoValue !== null) {
        return `<div class="check auto ${autoValue ? 'ok' : 'no'}"><span class="auto-mark">${autoValue ? '✓' : '✗'}</span><span>${escapeHtml(entry.label)} <span class="form-hint inline">· automático (Equipo)</span></span></div>`;
    }
    const info = checkInfo(entry.id);
    return `<label class="check"><input type="checkbox" data-check="${entry.id}" ${info ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
        <span>${escapeHtml(entry.label)}${info ? ` <span class="form-hint inline">· ${escapeHtml(info.by || '')} ${escapeHtml(timeAgo(info.at))}</span>` : ''}</span></label>`;
}

function progressBar(done, total, color = 'var(--k-good)') {
    const pct = total ? Math.round((done / total) * 100) : 0;
    return `<div class="bar" style="--c:${color}"><span style="width:${pct}%"></span></div>`;
}

function reqBox(missing, okText, warnings = []) {
    const parts = [];
    if (missing.length) parts.push(`<div class="req missing"><strong>Falta:</strong><ul>${missing.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul></div>`);
    else if (okText) parts.push(`<div class="req ok">✓ ${escapeHtml(okText)}</div>`);
    if (warnings.length) parts.push(`<div class="req warn"><strong>Revisar:</strong><ul>${warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul></div>`);
    return parts.join('');
}

// --- Requisitos del equipo (sección 1), calculados desde la tabla Equipo ---

function teamRequirements() {
    const list = members();
    const n = list.length;
    const count = fn => list.filter(m => fn(m.data)).length;
    const leaders = list.filter(m => m.data.leader);
    const { min, max } = L.TEAM_SIZE;
    return [
        { id: 'size', label: `Equipo de ${min} a ${max} integrantes (hay ${n})`, ok: n >= min && n <= max },
        { id: 'engineering', label: 'Al menos 1 estudiante de ingeniería', ok: count(d => d.engineering && (d.profile || 'estudiante') === 'estudiante') >= 1 },
        { id: 'women', label: 'Al menos 1 integrante mujer', ok: count(d => d.woman) >= 1 },
        { id: 'graduates', label: 'Máximo 1 graduado/profesional y máximo 1 docente', ok: count(d => d.profile === 'graduado') <= 1 && count(d => d.profile === 'docente') <= 1 },
        { id: 'leader', label: 'Un líder, que no sea graduado/profesional ni docente', ok: leaders.length === 1 && (leaders[0].data.profile || 'estudiante') === 'estudiante' },
        { id: 'registered', label: 'Todos inscritos en la sede', ok: n > 0 && count(d => d.registered) === n }
    ];
}

// --- Vistas ---

function renderViewsNav() {
    document.getElementById('views').innerHTML = `<div class="views-inner">${VIEWS.map(v => `
        <button class="view-tab ${v.id === currentView ? 'active' : ''}" data-view="${v.id}" aria-pressed="${v.id === currentView}">
            ${escapeHtml(v.label)}${v.badge ? v.badge() : ''}
        </button>`).join('')}</div>`;
}

function renderSyncInfo() {
    const info = document.getElementById('syncInfo');
    if (!info) return;
    if (LOCAL_MODE) info.textContent = 'Modo local (sin Supabase)';
    else if (!connected) info.textContent = 'Sin conexión a Supabase · usando cache local';
    else info.textContent = `Sincronizado con Supabase cada ${SYNC_INTERVAL_MS / 1000} s${lastSyncAt ? ` · última ${formatChile(lastSyncAt, { withDay: false })}` : ''}`;
}

function render() {
    renderPending = false;
    const name = (general().team_name || '').trim();
    document.getElementById('brandName').textContent = name ? `Equipo ${name}` : 'Rally de Innovación 2026';
    renderViewsNav();
    const view = VIEWS.find(v => v.id === currentView) || VIEWS[0];
    const content = document.getElementById('content');
    const scroll = window.scrollY;
    content.innerHTML = view.render() + peopleDatalist();
    window.scrollTo(0, scroll);
    renderClock();
    renderSyncInfo();
}

function goToView(id) {
    if (!VIEWS.some(v => v.id === id)) id = 'inicio';
    currentView = id;
    if (location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
    render();
    window.scrollTo(0, 0);
}

// Reloj de la barra superior: H actual del Rally.
function renderClock() {
    const el = document.getElementById('clock');
    if (!el) return;
    const h = currentH();
    if (h < 0) el.textContent = `Apertura en ${formatDuration(-h * 3600000)}`;
    else if (h < L.DURATION_H) el.textContent = `H${Math.floor(h)} · cierre en ${formatDuration((L.DURATION_H - h) * 3600000)}`;
    else el.textContent = 'Rally cerrado';
    el.classList.toggle('live', h >= 0 && h < L.DURATION_H);
    el.classList.toggle('urgent', h >= L.WARN_H && h < L.DURATION_H);
}

// --- Quién edita ---
// La cuenta del equipo es compartida: cada navegador guarda el nombre de quien lo usa.

function editorName() {
    try {
        const stored = localStorage.getItem(NAME_KEY);
        if (stored) return stored;
    } catch (e) { /* sin storage */ }
    return TEAM_EMAIL || LOCAL_MODE ? 'Equipo' : (currentUserEmail() || 'Equipo');
}

function askEditorName() {
    const name = prompt('¿Con qué nombre firmas los cambios en este navegador?', editorName() === 'Equipo' ? '' : editorName());
    if (name === null) return;
    try {
        if (name.trim()) localStorage.setItem(NAME_KEY, name.trim());
        else localStorage.removeItem(NAME_KEY);
    } catch (e) { /* sin storage */ }
    renderUser();
}

function renderUser() {
    document.getElementById('userName').textContent = editorName();
    document.getElementById('userAvatar').textContent = initials(editorName());
}
