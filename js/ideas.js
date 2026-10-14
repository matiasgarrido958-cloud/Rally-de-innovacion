// Banco de ideas → Filtro rápido → Benchmark → Ficha → Validación → Elegida.
// Fase 1 (filtro): tipo de propuesta, semáforo de factibilidad en WORK_HOURS y
// preguntas del filtro. Fase 2 (benchmark): qué se hace en el mundo, investigado
// por el equipo con sus propias fuentes e IA.
// Igual que el flujo de Fast Check: cada idea avanza de a una etapa cumpliendo
// requisitos; retroceder siempre se puede; descartar guarda el motivo.

const IDEA_STAGES = [
    { id: 'banco', label: 'Banco de ideas', color: 'var(--k-s1)', hint: 'Lluvia de ideas: cada idea entra con un ID, una línea, tema y beneficiario directo. Sin evaluar todavía.' },
    { id: 'filtro', label: 'Filtro rápido', color: 'var(--k-s2)', hint: `Fase 1 en dos capas: Gemini responde lo que se deduce del texto y el equipo lo que la IA no puede saber; sale el semáforo en ${L.WORK_HOURS} h. Si falla, se descarta.` },
    { id: 'benchmark', label: 'Benchmark', color: 'var(--k-t3)', hint: 'Fase 2: qué se está haciendo en el mundo. El equipo investiga (con IA y fuentes propias) y decide si la idea tiene diferenciación.' },
    { id: 'ficha', label: 'Ficha de idea', color: 'var(--k-s3)', hint: 'Ficha a–k para cada idea que sigue viva.' },
    { id: 'validacion', label: 'Validación', color: 'var(--k-s4)', hint: 'Entrevista, encuesta corta o mentor, y puntaje 1–5 según los criterios del jurado.' },
    { id: 'elegida', label: 'Elegida', color: 'var(--k-s5)', hint: 'La idea con la que el equipo va al reporte y al pitch.' }
];
const IDEA_DISCARDED = { id: 'descartada', label: 'Descartadas', color: 'var(--k-neutral)', hint: 'Ideas que no siguieron, con su motivo. Se pueden restaurar.' };
const IDEA_ALL = [...IDEA_STAGES, IDEA_DISCARDED];

// Campos de la ficha (sección 5). required = necesario para pasar a Validación.
const FICHA_FIELDS = [
    { id: 'a_desafio', label: 'a) Desafío que resuelve', required: true, rows: 2 },
    { id: 'b_problema', label: 'b) Problema (en 2 frases)', required: true, rows: 2 },
    { id: 'c_beneficiario', label: 'c) Beneficiario directo y cómo lo validamos', required: true, rows: 2 },
    { id: 'd_solucion', label: 'd) Solución (qué es y cómo funciona)', required: true, rows: 3 },
    { id: 'e_innovacion', label: 'e) Componente innovador / disruptivo', required: true, rows: 2 },
    { group: 'f) Modelo económico', fields: [
        { id: 'f_costo_inicial', label: 'Costo inicial', required: true, input: true },
        { id: 'f_costo_recurrente', label: 'Costo recurrente', input: true },
        { id: 'f_quien_paga', label: 'Quién paga / cómo se financia', required: true, rows: 2 },
        { id: 'f_alternativas', label: 'Alternativas existentes y por qué esta es más accesible', rows: 2 }
    ] },
    { group: 'g) Impacto y sustentabilidad', fields: [
        { id: 'g_efecto', label: 'Efecto en la comunidad o el medioambiente', required: true, rows: 2 },
        { id: 'g_sostenibilidad', label: 'Cómo se mantiene en el tiempo sin el equipo', required: true, rows: 2 }
    ] },
    { id: 'h_viabilidad', label: 'h) Viabilidad técnica', required: true, rows: 2 },
    { id: 'i_riesgos', label: 'i) Riesgos y supuestos a validar', rows: 2 },
    { id: 'j_recursos', label: 'j) Recursos necesarios', rows: 2 },
    { id: 'k_fuentes', label: 'k) Evidencia / fuentes (APA)', rows: 3, hint: 'Incluye las citas de uso de IA: las bases lo exigen.' }
];
const FICHA_FLAT = FICHA_FIELDS.flatMap(f => f.group ? f.fields : [f]);

let ideaTab = 'banco';
let ideaSearch = '';
let draft = null;

function ideas() {
    return byKind('idea');
}

function blankIdeaData() {
    const data = { title: '', name: '', theme: '', beneficiary: '', owner: '', notes: '', status: 'banco',
        filter: {}, feasibility: {}, offering: '', benchmark: { refs: [], research: [], consolidated: '', trend: '', differentiation: '', notes: '', verdict: '' },
        plan_done: {}, validations: [], scores: {}, discard_reason: '', discarded_from: '' };
    FICHA_FLAT.forEach(f => { data[f.id] = ''; });
    return data;
}

function ideaData(item) {
    const data = { ...blankIdeaData(), ...item.data };
    if (!Array.isArray(data.validations)) data.validations = [];
    if (typeof data.filter !== 'object' || !data.filter) data.filter = {};
    if (typeof data.scores !== 'object' || !data.scores) data.scores = {};
    if (typeof data.feasibility !== 'object' || !data.feasibility) data.feasibility = {};
    if (typeof data.plan_done !== 'object' || !data.plan_done) data.plan_done = {};
    data.benchmark = { ...blankIdeaData().benchmark, ...(data.benchmark || {}) };
    if (!Array.isArray(data.benchmark.refs)) data.benchmark.refs = [];
    if (!Array.isArray(data.benchmark.research)) data.benchmark.research = [];
    if (typeof data.ai_filter !== 'object') data.ai_filter = null;
    if (typeof data.ai_set !== 'object' || !data.ai_set) data.ai_set = {};
    return data;
}

function ideaStageIndex(status) {
    return IDEA_STAGES.findIndex(s => s.id === status);
}

function nextIdeaId() {
    const max = ideas().reduce((m, i) => Math.max(m, Number((i.id.match(/^I-(\d+)$/) || [])[1] || 0)), 0);
    return `I-${String(max + 1).padStart(2, '0')}`;
}

// Promedio 1–5 de los criterios del jurado (null si falta alguno).
function ideaScore(data) {
    const values = L.CRITERIA.map(c => Number(data.scores[c.id])).filter(v => v >= 1 && v <= 5);
    if (!values.length) return null;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

function filterFailures(data) {
    return L.QUICK_FILTER.filter(q => data.filter[q.id] === 'no');
}

// Semáforo de factibilidad: { points, max, answered, level: 'verde'|'amarillo'|'rojo'|null }.
const FEASIBILITY_VALUES = { si: 2, medio: 1, no: 0 };
const FEASIBILITY_LEVELS = {
    verde: { id: 'verde', label: 'Verde', color: 'var(--k-good)' },
    amarillo: { id: 'amarillo', label: 'Amarillo', color: 'var(--k-s4)' },
    rojo: { id: 'rojo', label: 'Rojo', color: 'var(--k-bad)' }
};

function feasibility(data) {
    const answers = L.FEASIBILITY.map(q => data.feasibility[q.id]).filter(v => v in FEASIBILITY_VALUES);
    const points = answers.reduce((sum, v) => sum + FEASIBILITY_VALUES[v], 0);
    const answered = answers.length;
    let level = null;
    if (answered === L.FEASIBILITY.length) {
        level = points >= L.FEASIBILITY_GREEN ? 'verde' : points >= L.FEASIBILITY_YELLOW ? 'amarillo' : 'rojo';
    }
    return { points, max: L.FEASIBILITY.length * 2, answered, level };
}

// Plan de trabajo según el tipo (mixto = producto + servicio).
function workPlan(offering) {
    if (offering === 'mixto') return [...L.WORK_PLANS.producto, ...L.WORK_PLANS.servicio];
    return L.WORK_PLANS[offering] || [];
}

function benchmarkRefsDone(data) {
    return data.benchmark.refs.filter(r => String(r.name || '').trim() && String(r.difference || '').trim()).length;
}

// --- Filtro rápido, capa IA (Gemini, Edge Function) ---
// Gemini responde las preguntas que se deducen del texto y llena esos campos del
// filtro (marcados con 🤖, editables); el equipo responde el resto. El veredicto sale
// de una regla fija: un "no" en una pregunta clave = No pasa; un "sin datos" o un "no"
// en otra = Dudosa.

const TRIAGE = L.AI_TRIAGE;
const TRIAGE_VALUES = {
    si: { label: 'Sí', color: 'var(--k-good)' }, no: { label: 'No', color: 'var(--k-bad)' },
    medio: { label: 'A medias', color: 'var(--k-s4)' }, sin_datos: { label: 'Sin datos', color: 'var(--k-neutral)' },
    producto: { label: 'Producto', color: 'var(--k-t3)' }, servicio: { label: 'Servicio', color: 'var(--k-t1)' },
    mixto: { label: 'Producto + servicio', color: 'var(--k-t2)' }
};
let triageRun = null; // { done, total } mientras se evalúa en lote
let lastEvaluation = null; // { id, text } aviso "evaluación lista" en la ventana abierta

function clockTime(iso) {
    return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
}

// Texto que dice si el veredicto cambió respecto de la evaluación anterior.
function verdictChange(before, after) {
    const label = id => findOption(TRIAGE.VERDICTS, id).label;
    if (!before) return `quedó en ${label(after)}`;
    return before === after ? `sigue en ${label(after)} (sin cambios)` : `cambió de ${label(before)} a ${label(after)}`;
}

// Lo que recibe la IA: solo lo que el equipo escribió en la idea.
function triageInput(data) {
    return {
        idea: data.title || '', nombre: data.name || '',
        tema: data.theme ? findOption(L.THEMES, data.theme).label : '',
        beneficiario: data.beneficiary || '', notas: data.notes || ''
    };
}

function triageHash(data) {
    let h = 0;
    for (const c of JSON.stringify(triageInput(data))) h = (h * 31 + c.charCodeAt(0)) | 0;
    return String(h);
}

function triageVerdict(answers) {
    const value = q => (answers[q.id] || {}).valor;
    if (TRIAGE.QUESTIONS.some(q => q.key && value(q) === 'no')) return 'no_pasa';
    if (TRIAGE.QUESTIONS.some(q => ['sin_datos', 'no'].includes(value(q)))) return 'dudosa';
    return 'pasa';
}

function triageStale(data) {
    return Boolean(data.ai_filter && data.ai_filter.hash !== triageHash(data));
}

function needsTriage(data) {
    return data.status === 'filtro' && String(data.title || '').trim() && (!data.ai_filter || !data.ai_filter.applied || triageStale(data));
}

function triageRank(data) {
    const f = data.ai_filter;
    return f ? TRIAGE.VERDICTS.findIndex(v => v.id === f.verdict) : TRIAGE.VERDICTS.length;
}

function triageChip(data) {
    const f = data.ai_filter;
    if (!f) return '';
    const v = findOption(TRIAGE.VERDICTS, f.verdict);
    const stale = triageStale(data);
    return `<span class="chip" style="--c:${v.color}" title="${stale ? 'La idea cambió desde la evaluación: vuelve a evaluarla' : 'Filtro rápido, capa IA'}">🤖 ${escapeHtml(v.label)}${stale ? ' ⟳' : ''}</span>`;
}

// ¿Este campo del filtro tiene hoy el valor que puso Gemini?
function aiOwned(data, path) {
    return Boolean(data.ai_set && data.ai_set[path] && getPath(data, path) === data.ai_set[path]);
}

// Llena los campos del filtro con las respuestas de Gemini, sin pisar lo que el
// equipo respondió o corrigió. "Sin datos" deja el campo vacío para el equipo.
function applyTriage(data, answers) {
    const set = { ...(data.ai_set || {}) };
    TRIAGE.QUESTIONS.filter(q => q.apply).forEach(q => {
        const current = getPath(data, q.apply);
        if (current && current !== set[q.apply]) {
            delete set[q.apply];
            return;
        }
        const value = (answers[q.id] || {}).valor;
        if (!value || value === 'sin_datos') {
            if (current) setPath(data, q.apply, '');
            delete set[q.apply];
            return;
        }
        setPath(data, q.apply, value);
        set[q.apply] = value;
    });
    data.ai_set = set;
}

// Errores pasajeros de Gemini: servidor saturado o límite por minuto.
function isTransient(error) {
    return [429, 502, 503, 504].includes(error.status) && /\b(429|503|504)\b|UNAVAILABLE|high demand|límite/i.test(error.message);
}

async function callTriage(body) {
    const delays = TRIAGE.RETRY_DELAYS_MS || [];
    for (let attempt = 0; ; attempt++) {
        try {
            return await supabaseFunction(TRIAGE.FUNCTION, body, false, TRIAGE.TIMEOUT_MS || 0);
        } catch (error) {
            if (attempt >= delays.length || !isTransient(error)) throw error;
            const detail = (error.message.match(/\(([^()]*:\s*\d{3}[^()]*)\)/) || [])[1];
            showToast(`⏳ Gemini está saturado${detail ? ` (${detail})` : ''}: reintento ${attempt + 1} de ${delays.length} en ${Math.round(delays[attempt] / 1000)} s…`, 'warning', delays[attempt]);
            await new Promise(r => setTimeout(r, delays[attempt]));
        }
    }
}

async function evaluateIdea(item) {
    const data = ideaData(item);
    const result = await callTriage({
        idea: triageInput(data),
        questions: TRIAGE.QUESTIONS.map(({ id, label, help, options }) => ({ id, label, help, options }))
    });
    const answers = result.answers || {};
    // Se guarda sobre la versión más reciente, por si alguien la editó mientras tanto.
    const fresh = JSON.parse(JSON.stringify(ideaData(getItem(item.id) || item)));
    fresh.ai_filter = {
        answers, falta: result.falta || '', resumen: result.resumen || '', model: result.model || '',
        verdict: triageVerdict(answers), hash: triageHash(data), at: new Date().toISOString(), applied: true
    };
    applyTriage(fresh, answers);
    await saveItem({ ...(getItem(item.id) || item), data: fresh }, { rerender: false });
    return fresh;
}

async function runTriage() {
    if (triageRun) return;
    if (LOCAL_MODE) return showToast('La capa IA necesita Supabase: no funciona en modo local', 'warning');
    const pending = ideas().filter(i => needsTriage(ideaData(i)));
    if (!pending.length) return showToast('No hay ideas nuevas ni cambiadas por evaluar', 'warning');
    triageRun = { done: 0, total: pending.length };
    render();
    let error = null;
    let changed = 0;
    const counts = {};
    for (const [n, item] of pending.entries()) {
        // Pausa entre consultas para no pasar el límite por minuto del nivel gratuito.
        if (n) await new Promise(r => setTimeout(r, TRIAGE.DELAY_MS));
        try {
            const before = (ideaData(getItem(item.id) || item).ai_filter || {}).verdict;
            const after = (await evaluateIdea(item)).ai_filter.verdict;
            if (before && before !== after) changed++;
            counts[after] = (counts[after] || 0) + 1;
            triageRun.done++;
        } catch (e) {
            error = e;
            break;
        }
        requestRender();
    }
    const { done, total } = triageRun;
    triageRun = null;
    requestRender();
    if (error) showToast(`❌ ${error.message} (${done} de ${total} evaluadas; esas quedan guardadas)`, 'error', 9000);
    else {
        const summary = TRIAGE.VERDICTS.filter(v => counts[v.id]).map(v => `${counts[v.id]} ${v.label}`).join(', ');
        showToast(`✓ Evaluación lista (${clockTime(new Date().toISOString())}): ${total} idea(s) · ${summary}${changed ? ` · ${changed} cambiaron de veredicto` : ''}`, 'success', 7000);
    }
}

// Banco → Filtro: todas las ideas que ya tienen idea, tema y beneficiario.
function sendableIdeas() {
    return ideas().filter(i => {
        const d = ideaData(i);
        return d.status === 'banco' && !ideaRequirements(d, 'filtro').length;
    });
}

async function sendToFilter() {
    const list = sendableIdeas();
    for (const item of list) await saveItem({ ...item, data: { ...item.data, status: 'filtro' } }, { rerender: false });
    ideaTab = 'filtro';
    render();
    showToast(`✓ ${list.length} idea(s) al Filtro rápido`);
}

// Filtro: las que Gemini marcó "No pasa" (y no cambiaron después).
function rejectedIdeas() {
    return ideas().filter(i => {
        const d = ideaData(i);
        return d.status === 'filtro' && d.ai_filter && d.ai_filter.verdict === 'no_pasa' && !triageStale(d);
    });
}

function triageDiscardReason(data) {
    const failed = TRIAGE.QUESTIONS.filter(q => q.key && (data.ai_filter.answers[q.id] || {}).valor === 'no');
    return failed.map(q => q.discard || q.label).join('; ') + ' (filtro rápido, capa IA)';
}

async function discardRejected() {
    const list = rejectedIdeas();
    if (!list.length || !confirm(`¿Descartar ${list.length} idea(s) marcadas «No pasa»? Quedan en Descartadas con su motivo y se pueden restaurar.`)) return;
    for (const item of list) {
        const d = ideaData(item);
        await saveItem({ ...item, data: { ...item.data, status: 'descartada', discarded_from: 'filtro', discard_reason: triageDiscardReason(d) } }, { rerender: false });
    }
    render();
    showToast(`✓ ${list.length} idea(s) descartadas`);
}

function triageBar(all) {
    if (ideaTab === 'banco') {
        const sendable = sendableIdeas().length;
        const waiting = all.filter(x => x.data.status === 'banco').length - sendable;
        return `
            <div class="ai-bar">
                <div class="ai-bar-text">
                    <strong>Lluvia de ideas</strong>
                    <span class="form-hint">Anoten todo sin evaluar: idea, tema y beneficiario. Al terminar, mándenlas al Filtro rápido, donde Gemini hace el primer descarte.${waiting ? ` ${waiting} idea(s) aún sin tema o beneficiario.` : ''}</span>
                </div>
                <div class="ai-actions">
                    <button class="btn btn-accent" data-action="send-to-filter" ${sendable ? '' : 'disabled'}>Mandar ${sendable} al Filtro →</button>
                </div>
            </div>`;
    }
    if (ideaTab !== 'filtro') return '';
    const inFilter = all.filter(x => x.data.status === 'filtro');
    const pending = inFilter.filter(x => needsTriage(x.data)).length;
    const counts = TRIAGE.VERDICTS.map(v => chip({ ...v, label: `${v.label}: ${inFilter.filter(x => x.data.ai_filter && x.data.ai_filter.verdict === v.id).length}` }));
    const rejected = rejectedIdeas().length;
    const label = triageRun ? `Evaluando ${Math.min(triageRun.done + 1, triageRun.total)} de ${triageRun.total}…` : `🤖 Evaluar con Gemini (${pending})`;
    return `
        <div class="ai-bar">
            <div class="ai-bar-text">
                <strong>1 · Capa IA → 2 · Capa equipo</strong>
                <span class="form-hint">${LOCAL_MODE ? 'La capa IA necesita Supabase: en modo local respondan todo a mano.' : 'Gemini responde lo que se deduce del texto y lo deja marcado con 🤖 (se puede corregir). Luego el equipo responde solo sus preguntas en las ideas que siguen.'}</span>
                <div class="card-tags">${counts.join('')}</div>
            </div>
            <div class="ai-actions">
                ${rejected ? `<button class="btn btn-ghost danger" data-action="ai-discard">Descartar ${rejected} «No pasa»</button>` : ''}
                <button class="btn btn-accent" data-action="ai-triage" ${LOCAL_MODE || triageRun || !pending ? 'disabled' : ''}>${label}</button>
            </div>
        </div>`;
}

function ideaRequirements(data, target) {
    const missing = [];
    const empty = v => !String(v || '').trim();
    switch (target) {
        case 'filtro':
            if (empty(data.title)) missing.push('Escribe la idea en una línea.');
            if (!data.theme) missing.push('Elige el tema.');
            if (empty(data.beneficiary)) missing.push('Indica el beneficiario directo.');
            break;
        case 'benchmark': {
            if (!data.offering) missing.push('Indica si es producto, servicio o ambos.');
            const f = feasibility(data);
            if (f.answered < L.FEASIBILITY.length) missing.push(`Responde el semáforo de factibilidad (faltan ${L.FEASIBILITY.length - f.answered}).`);
            else if (f.level === 'rojo') missing.push(`Semáforo rojo (${f.points}/${f.max}): no alcanza en ${L.WORK_HOURS} h. Ajústala o descártala.`);
            const unanswered = L.QUICK_FILTER.filter(q => !data.filter[q.id]).length;
            if (unanswered) missing.push(`Responde el filtro rápido (faltan ${unanswered}).`);
            const failed = filterFailures(data);
            if (failed.length) missing.push(`Falla el filtro (${failed.length}): descártala con el motivo correspondiente.`);
            break;
        }
        case 'ficha': {
            const refs = benchmarkRefsDone(data);
            if (refs < L.BENCHMARK_MIN_REFS) missing.push(`Registra al menos ${L.BENCHMARK_MIN_REFS} referentes con nombre y diferencia (hay ${refs}).`);
            if (empty(data.benchmark.differentiation)) missing.push('Escribe qué diferencia a nuestra idea de lo que existe.');
            if (data.benchmark.verdict !== 'seguir') {
                missing.push(data.benchmark.verdict === 'descartar' ? 'El benchmark dice descartar: descártala.'
                    : data.benchmark.verdict === 'pivotar' ? 'El benchmark dice ajustar la idea: ajústala y vuelve a decidir.'
                    : 'Decide con el benchmark: seguir, ajustar o descartar.');
            }
            break;
        }
        case 'validacion':
            FICHA_FLAT.filter(f => f.required && empty(data[f.id])).forEach(f => missing.push(`Completa ${f.label.replace(/^[a-k]\) /, '')}.`));
            break;
        case 'elegida': {
            const done = data.validations.filter(v => (v.finding || '').trim()).length;
            if (!done) missing.push('Registra al menos una validación con su hallazgo.');
            const unscored = L.CRITERIA.filter(c => !data.scores[c.id]).length;
            if (unscored) missing.push(`Puntúa todos los criterios (faltan ${unscored}).`);
            break;
        }
    }
    return missing;
}

function ideaWarnings(item, data) {
    const warnings = [];
    const stage = ideaStageIndex(data.status);
    if (data.theme === 'reciclaje') warnings.push('Reciclaje: ya ganaron Hojabeta y The Last Resort. ¿Cuál es nuestro ángulo distinto?');
    const ficha = ideaStageIndex('ficha');
    if (stage >= ficha && !String(data.k_fuentes || '').trim()) warnings.push('Sin fuentes APA todavía (k): el reporte las exige, incluidas las de IA.');
    if (stage >= ficha && !String(data.i_riesgos || '').trim()) warnings.push('Sin riesgos ni supuestos anotados (i).');
    const otherChosen = ideas().filter(i => i.id !== item.id && i.data.status === 'elegida');
    if (otherChosen.length && stage >= ideaStageIndex('validacion')) warnings.push(`Ya hay otra idea elegida: ${otherChosen.map(i => i.id).join(', ')}.`);
    return warnings;
}

// --- Tablero ---

function ideaCard(item) {
    const data = ideaData(item);
    const stage = findOption(IDEA_ALL, data.status);
    const theme = findOption(L.THEMES, data.theme);
    const score = ideaScore(data);
    const f = feasibility(data);
    const offering = data.offering ? findOption(L.OFFERING_TYPES, data.offering) : null;
    let progress = '';
    if (data.status === 'descartada') {
        progress = `<div class="card-progress muted">Motivo: ${escapeHtml(data.discard_reason || 'sin motivo')}</div>`;
    } else if (data.status !== 'elegida') {
        const next = IDEA_STAGES[ideaStageIndex(data.status) + 1];
        const missing = ideaRequirements(data, next.id);
        progress = missing.length
            ? `<div class="card-progress" title="${escapeHtml(missing.join('\n'))}">Faltan ${missing.length} para pasar a ${escapeHtml(next.label)}</div>`
            : `<div class="card-progress ready">✓ Lista para pasar a ${escapeHtml(next.label)}</div>`;
    }
    return `
        <article class="card" data-idea="${escapeHtml(item.id)}" tabindex="0" style="--stage:${stage.color}">
            ${data.status === 'descartada' ? `<button class="card-delete" data-action="delete-idea" data-id="${escapeHtml(item.id)}" aria-label="Eliminar definitivamente" title="Eliminar definitivamente"><svg><use href="#i-trash"/></svg></button>` : ''}
            <div class="card-top">
                <span class="card-id">${escapeHtml(item.id)}</span>
                ${score !== null ? `<span class="chip outline score" title="Promedio de los criterios del jurado">★ ${score}</span>` : ''}
            </div>
            <div class="card-title ${data.title ? '' : 'untitled'}">${escapeHtml(data.name || data.title) || 'Sin título'}</div>
            ${data.name && data.title ? `<div class="card-sub">${escapeHtml(data.title)}</div>` : ''}
            <div class="card-tags">
                ${data.theme ? chip(theme) : ''}
                ${offering ? `<span class="chip" style="--c:${offering.color}" title="${escapeHtml(offering.hint)}">${offering.icon} ${escapeHtml(offering.label)}</span>` : ''}
                ${f.level ? `<span class="chip" style="--c:${FEASIBILITY_LEVELS[f.level].color}" title="Semáforo de factibilidad en ${L.WORK_HOURS} h">● ${FEASIBILITY_LEVELS[f.level].label} ${f.points}/${f.max}</span>` : ''}
                ${data.status === 'filtro' || data.status === 'benchmark' ? triageChip(data) : ''}
                ${data.beneficiary ? `<span class="chip outline" title="Beneficiario directo">👥 ${escapeHtml(data.beneficiary)}</span>` : ''}
            </div>
            ${progress}
            <div class="card-foot">
                <span class="avatar sm">${escapeHtml(initials(data.owner || '?'))}</span>
                <span><strong>${escapeHtml(data.owner || 'Sin responsable')}</strong> · ${escapeHtml(timeAgo(item.updated_at))}</span>
            </div>
        </article>`;
}

function renderIdeasView() {
    const all = ideas().map(i => ({ item: i, data: ideaData(i) }));
    const q = ideaSearch;
    const filtered = all.filter(({ item, data }) => data.status === ideaTab &&
        (!q || `${item.id} ${data.title} ${data.name} ${data.beneficiary} ${data.owner} ${findOption(L.THEMES, data.theme).label}`.toLowerCase().includes(q)));
    if (ideaTab === 'filtro') {
        filtered.sort((a, b) => (triageRank(a.data) - triageRank(b.data)) || (feasibility(b.data).points - feasibility(a.data).points));
    }
    if (ideaTab === 'benchmark') {
        filtered.sort((a, b) => feasibility(b.data).points - feasibility(a.data).points);
    }
    if (ideaTab === 'validacion' || ideaTab === 'elegida') {
        filtered.sort((a, b) => (ideaScore(b.data) ?? -1) - (ideaScore(a.data) ?? -1));
    }
    const current = findOption(IDEA_ALL, ideaTab);
    const discardedCount = all.filter(x => x.data.status === 'descartada').length;
    return `
        <div class="page-head">
            <div>
                <h1>Ideas</h1>
                <p>${all.length - discardedCount} activas · ${all.filter(x => x.data.status === 'elegida').length} elegida(s) · ${discardedCount} descartadas</p>
            </div>
            <div class="page-head-actions">
                <label class="search">
                    <svg><use href="#i-search"/></svg>
                    <input type="search" id="ideaSearch" placeholder="Buscar idea, tema, beneficiario…" aria-label="Buscar" value="${escapeHtml(ideaSearch)}">
                </label>
                <button class="btn btn-accent" data-action="new-idea"><svg><use href="#i-plus"/></svg>Nueva idea</button>
            </div>
        </div>
        <nav class="pipeline" aria-label="Etapas de las ideas">
            ${IDEA_STAGES.map((s, i) => `
                <button class="stage ${s.id === ideaTab ? 'active' : ''}" data-action="idea-tab" data-status="${s.id}" style="--stage:${s.color}" aria-pressed="${s.id === ideaTab}">
                    <div class="stage-step"><span class="stage-dot"></span>Etapa ${i + 1}</div>
                    <div class="stage-label">${s.label}</div>
                    <div class="stage-count">${all.filter(x => x.data.status === s.id).length}</div>
                </button>`).join('')}
        </nav>
        <div class="board-bar">
            <p class="stage-hint"><strong>${escapeHtml(current.label)}:</strong> ${escapeHtml(current.hint)}</p>
            <button class="discard-tab ${ideaTab === 'descartada' ? 'active' : ''}" data-action="idea-tab" data-status="descartada" aria-pressed="${ideaTab === 'descartada'}">
                <svg><use href="#i-archive"/></svg>Descartadas (${discardedCount})
            </button>
        </div>
        ${triageBar(all)}
        <div class="grid">
            ${filtered.length ? filtered.map(x => ideaCard(x.item)).join('') : `
                <div class="empty">
                    <div class="empty-icon">💡</div>
                    <strong>${q ? 'Sin resultados' : 'No hay ideas en esta etapa'}</strong>
                    ${ideaTab === 'banco' && !q ? 'Agrega la primera con «Nueva idea».' : ''}
                </div>`}
        </div>`;
}

// --- Modal de la idea ---

function field(path, label, value, { textarea = false, rows = 2, placeholder = '', hint = '', required = false, list = '' } = {}) {
    const control = textarea
        ? `<textarea class="form-textarea small" rows="${rows}" data-draft="${path}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>`
        : `<input class="form-input" data-draft="${path}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${list ? `list="${list}"` : ''}>`;
    return `<div class="form-group"><label class="form-label">${escapeHtml(label)}${required ? ' <span class="req-star">*</span>' : ''}${hint ? `<span class="form-hint inline">${escapeHtml(hint)}</span>` : ''}</label>${control}</div>`;
}

function pills(path, options, selected) {
    return `<div class="pills">${options.map(o => `
        <label class="pill" style="--c:${o.color || 'var(--k-s1)'}">
            <input type="radio" name="${path}" data-draft="${path}" value="${escapeHtml(o.id)}" ${o.id === selected ? 'checked' : ''}>
            <span>${escapeHtml(o.label)}</span>
        </label>`).join('')}</div>`;
}

function fold(title, open, body, done = false, key = '') {
    return `<details class="fold" ${key ? `data-fold="${key}"` : ''} ${open ? 'open' : ''}><summary class="section-title">${escapeHtml(title)}${done ? ' <span class="fold-done">✓</span>' : ''}</summary><div class="section">${body}</div></details>`;
}

function sectionIdea(d, open) {
    return fold('1 · Idea', open, `
        ${field('title', 'Idea (1 línea)', d.title, { required: true, placeholder: 'Qué es, en una frase' })}
        <div class="row-2">
            ${field('name', 'Nombre (opcional)', d.name, { placeholder: 'Nombre de fantasía' })}
            ${field('owner', 'Responsable', d.owner, { list: 'people' })}
        </div>
        <div class="form-group"><label class="form-label">Tema <span class="req-star">*</span></label>${pills('theme', L.THEMES, d.theme)}</div>
        ${field('beneficiary', 'Beneficiario directo', d.beneficiary, { required: true, placeholder: 'Quién, específicamente' })}
        ${field('notes', 'Notas / desafío, ONG o empresa', d.notes, { textarea: true })}
    `, ideaRequirements(d, 'filtro').length === 0, 'idea');
}

// Opciones de cada campo del filtro, según dónde se guarda.
function filterOptions(path) {
    if (path === 'offering') return L.OFFERING_TYPES.map(o => ({ ...o, label: `${o.icon} ${o.label}` }));
    if (path.startsWith('feasibility.')) return [{ id: 'si', label: 'Sí', color: 'var(--k-good)' }, { id: 'medio', label: 'A medias', color: 'var(--k-s4)' }, { id: 'no', label: 'No', color: 'var(--k-bad)' }];
    return [{ id: 'si', label: 'Sí', color: 'var(--k-good)' }, { id: 'no', label: 'No', color: 'var(--k-bad)' }];
}

function filterRow(d, path, label, hint = '') {
    return `
        <div class="filter-row">
            <span>${escapeHtml(label)}${hint ? `<span class="form-hint">${hint}</span>` : ''}</span>
            ${pills(path, filterOptions(path), getPath(d, path))}
        </div>`;
}

function sectionFilter(d, open) {
    const f = d.ai_filter;
    const stale = triageStale(d);
    const applied = new Set(TRIAGE.QUESTIONS.filter(q => q.apply).map(q => q.apply));
    // Capa IA: preguntas que Gemini responde (las sin campo, como "problema", solo informan).
    const aiRows = TRIAGE.QUESTIONS.map(q => {
        const a = f ? f.answers[q.id] || {} : {};
        if (!q.apply) {
            const val = TRIAGE_VALUES[a.valor] || { label: 'Sin evaluar', color: 'var(--k-neutral)' };
            return `<div class="filter-row"><span>${escapeHtml(q.label)}${a.motivo ? `<span class="form-hint">🤖 ${escapeHtml(a.motivo)}</span>` : ''}</span>${chip(val)}</div>`;
        }
        let hint = '';
        if (aiOwned(d, q.apply)) hint = `🤖 ${escapeHtml(a.motivo || 'Respondido por Gemini')}`;
        else if (f && a.valor === 'sin_datos') hint = `🤖 Sin datos: ${escapeHtml(a.motivo || 'la idea no lo dice')}. Respóndanlo ustedes.`;
        else if (getPath(d, q.apply) && d.ai_set && f) hint = '👥 Respondido por el equipo';
        return filterRow(d, q.apply, q.label, hint);
    }).join('');
    // Capa equipo: lo que la IA no puede saber.
    const teamRows = [
        ...L.FEASIBILITY.filter(q => !applied.has(`feasibility.${q.id}`)).map(q => filterRow(d, `feasibility.${q.id}`, q.label)),
        ...L.QUICK_FILTER.filter(q => !applied.has(`filter.${q.id}`)).map(q => filterRow(d, `filter.${q.id}`, q.label))
    ].join('');
    const offering = d.offering ? findOption(L.OFFERING_TYPES, d.offering) : null;
    const verdict = f ? findOption(TRIAGE.VERDICTS, f.verdict) : null;
    return fold('2 · Filtro rápido (fase 1)', open, `
        <div class="subgroup">
            <div class="subgroup-title">1 · Capa IA ${verdict ? chip(verdict) : ''}</div>
            ${lastEvaluation && lastEvaluation.id === currentEditingId ? `<div class="req ok">${escapeHtml(lastEvaluation.text)}</div>` : ''}
            ${f ? `<p class="form-hint">${escapeHtml(f.resumen)} · Evaluada a las ${escapeHtml(clockTime(f.at))} (${escapeHtml(timeAgo(f.at))}) con ${escapeHtml(f.model)}. Lo marcado con 🤖 lo respondió Gemini: corríjanlo si no corresponde.</p>`
                : `<p class="form-hint">${LOCAL_MODE ? 'En modo local no hay IA: respondan estas preguntas a mano.' : 'Todavía no se evalúa con Gemini. También se pueden responder a mano.'}</p>`}
            ${stale ? '<div class="req warn">La idea cambió desde la evaluación: vuelve a evaluarla.</div>' : ''}
            ${aiRows}
            ${offering ? `<p class="form-hint">${escapeHtml(offering.hint)}</p>` : ''}
            ${f && f.falta ? `<p class="form-hint"><strong>Falta:</strong> ${escapeHtml(f.falta)}</p>` : ''}
            <div class="ai-actions">
                <button type="button" class="btn btn-ghost" data-modal-action="ai-eval" ${LOCAL_MODE || !String(d.title || '').trim() ? 'disabled' : ''}>🤖 ${f ? 'Evaluar de nuevo' : 'Evaluar con Gemini'}</button>
            </div>
        </div>
        <div class="subgroup">
            <div class="subgroup-title">2 · Capa equipo <span id="feasBadge">${feasibilityBadge(d)}</span></div>
            <p class="form-hint">Lo que la IA no puede saber. El semáforo de factibilidad en ${L.WORK_HOURS} h sale de estas respuestas y de la demo.</p>
            ${teamRows}
        </div>
    `, ideaRequirements(d, 'benchmark').length === 0, 'filtro');
}

function feasibilityBadge(d) {
    const f = feasibility(d);
    if (!f.level) return `<span class="form-hint">${f.answered}/${L.FEASIBILITY.length} respondidas</span>`;
    return chip({ ...FEASIBILITY_LEVELS[f.level], label: `${FEASIBILITY_LEVELS[f.level].label} · ${f.points}/${f.max}` });
}

// --- Benchmark (fase 2) ---

function benchmarkIdeaLines(d) {
    const offering = d.offering ? findOption(L.OFFERING_TYPES, d.offering).label : 'por definir';
    return [
        ['Idea', d.title], ['Nombre', d.name], ['Tema', d.theme ? findOption(L.THEMES, d.theme).label : ''],
        ['Tipo', offering], ['Beneficiario directo', d.beneficiary], ['Notas / desafío', d.notes]
    ].filter(([, v]) => String(v || '').trim()).map(([k, v]) => `- ${k}: ${v}`).join('\n');
}

const REFS_BLOCK = `REFERENTES
Nombre | País | Enlace | Qué hace | Diferencia con nuestra idea`;

// Prompt para el modo investigador (Claude, ChatGPT, Gemini o Perplexity).
function benchmarkPrompt(d) {
    return `Actúa como analista de vigilancia tecnológica y de mercado. Investiga en profundidad, con búsqueda web y fuentes reales, para hacer el benchmark de una idea de un equipo universitario de ingeniería que compite en el Rally Latinoamericano de Innovación 2026 (28 horas, sede Santiago de Chile).

IDEA
${benchmarkIdeaLines(d)}

QUÉ NECESITO
1. Soluciones existentes: entre 5 y 8 soluciones parecidas en el mundo (empresas, startups, proyectos públicos, ONG, investigación o patentes). Primero Chile y Latinoamérica, luego las internacionales más relevantes. Para cada una: nombre, país, enlace oficial, qué hace, estado (activa, piloto o cerrada) y en qué se diferencia de nuestra idea.
2. Tendencia: ¿el tema está en crecimiento, estable o en baja? Justifica con datos con año y fuente (mercado, inversión, políticas públicas, publicaciones).
3. Diferenciación: ¿qué podría hacer única a nuestra idea frente a lo que existe (precio, público, tecnología, contexto chileno, modelo de negocio)? Sé crítico: si ya existe algo igual, dilo claramente.
4. Contexto en Chile: normativa, actores, programas de financiamiento y datos públicos que sirvan para justificar el impacto.
5. Riesgos principales para implementarla en Chile.

REGLAS
- No inventes empresas, enlaces, cifras ni citas. Si no encuentras algo, escribe "no encontrado".
- Cada dato con su fuente. Marca con (verificar) lo que no pudiste confirmar en una fuente primaria.
- Responde en español.

FORMATO DE SALIDA
Secciones 1 a 5 con título, luego las fuentes en APA 7. Al final, este bloque exacto, con una fila por solución, separando con | y sin tabla de markdown:
${REFS_BLOCK}`;
}

// Prompt para depurar en Claude o ChatGPT Pro lo que respondieron todas las IA.
function consolidationPrompt(d) {
    const research = d.benchmark.research.filter(r => String(r.text || '').trim());
    return `Tengo los resultados de benchmark de ${research.length} herramienta(s) de IA para la misma idea. Depúralos como un analista crítico.

IDEA
${benchmarkIdeaLines(d)}

TAREAS
1. Une los referentes repetidos (mismo nombre o misma empresa) y descarta los que no sean comparables con nuestra idea.
2. Marca con (verificar) los referentes o enlaces que aparecen en un solo resultado, que no traen enlace o que se contradicen entre resultados. No agregues referentes que no estén en los resultados.
3. Tendencia del tema: elige una (en crecimiento, estable, en baja o sin datos) y justifícala con los datos de los resultados.
4. Diferenciación: en máximo 3 frases, qué distingue a nuestra idea de lo que existe. Si algún referente ya hace lo mismo, dilo.
5. Recomendación: seguir, ajustar la idea o descartar, con el motivo en una frase.
6. Fuentes en APA 7, incluida una cita por cada herramienta de IA usada.

FORMATO DE SALIDA
Secciones 1 a 6 con título. Al final, este bloque exacto, con una fila por referente ordenada del más parecido al menos parecido, separando con | y sin tabla de markdown:
${REFS_BLOCK}

RESULTADOS
${research.map(r => `=== ${r.ai || 'IA'} ===\n${String(r.text).trim()}`).join('\n\n')}`;
}

// Lee las filas "Nombre | País | Enlace | Qué hace | Diferencia" (también de una tabla markdown).
function parseRefs(text) {
    const clean = v => v.replace(/\*\*/g, '').replace(/^\[([^\]]*)\]\([^)]*\)$/, '$1').trim();
    const refs = [];
    String(text || '').split('\n').forEach(raw => {
        const cells = raw.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
        if (cells.length < 5) return;
        let name = clean(cells[0]);
        if (!name || /^:?-{2,}/.test(name) || /^nombre$/i.test(name)) return;
        // Lo que la IA marcó para verificar queda marcado en el nombre.
        if (/verificar/i.test(raw) && !/verificar/i.test(name)) name += ' (verificar)';
        const url = (cells[2].match(/https?:\/\/[^\s)\]>]+/) || [''])[0];
        refs.push({ name, country: clean(cells[1]), url, what: clean(cells[3]), difference: clean(cells.slice(4).join(' | ')) });
    });
    return refs;
}

function importRefs() {
    const b = draft.benchmark;
    const source = String(b.consolidated || '').trim() || b.research.map(r => r.text || '').join('\n');
    const found = parseRefs(source);
    if (!found.length) {
        showToast('No encontré el bloque REFERENTES: pega la respuesta completa, con las filas separadas por |', 'warning', 6000);
        return;
    }
    const key = name => String(name || '').replace(/\(verificar\)/i, '').trim().toLowerCase();
    const known = new Set(b.refs.map(r => key(r.name)).filter(Boolean));
    const fresh = found.filter(r => !known.has(key(r.name)) && known.add(key(r.name)));
    // Las filas vacías que agregó el equipo se reemplazan por las importadas.
    b.refs = b.refs.filter(r => Object.values(r).some(v => String(v || '').trim())).concat(fresh);
    hasUnsavedChanges = true;
    renderModalBody();
    showToast(fresh.length ? `✓ ${fresh.length} referente(s) importados: verifiquen los enlaces` : 'Esos referentes ya estaban registrados', fresh.length ? 'success' : 'warning');
}

function researchRow(r, index) {
    return `
        <div class="vsrc">
            <div class="vsrc-head">
                <select class="form-input research-ai" data-draft="benchmark.research.${index}.ai" aria-label="IA">
                    ${L.BENCHMARK_AIS.map(a => `<option ${a === r.ai ? 'selected' : ''}>${escapeHtml(a)}</option>`).join('')}
                </select>
                <button type="button" class="row-remove" data-modal-action="remove-research" data-index="${index}" aria-label="Quitar">×</button>
            </div>
            <textarea class="form-textarea small" rows="4" data-draft="benchmark.research.${index}.text" placeholder="Pega aquí la respuesta completa de esta IA">${escapeHtml(r.text || '')}</textarea>
        </div>`;
}

function benchmarkRefRow(r, index) {
    return `
        <div class="vsrc">
            <div class="vsrc-head">
                <span class="vsrc-num">Referente ${index + 1}</span>
                <button type="button" class="row-remove" data-modal-action="remove-ref" data-index="${index}" aria-label="Quitar">×</button>
            </div>
            <div class="row-2">
                ${field(`benchmark.refs.${index}.name`, 'Nombre', r.name || '', { placeholder: 'Empresa, startup o proyecto', required: true })}
                ${field(`benchmark.refs.${index}.country`, 'País', r.country || '', { placeholder: 'Chile, México, España…' })}
            </div>
            ${field(`benchmark.refs.${index}.url`, 'Enlace', r.url || '', { placeholder: 'https://…' })}
            ${field(`benchmark.refs.${index}.what`, 'Qué hace', r.what || '', { textarea: true })}
            ${field(`benchmark.refs.${index}.difference`, 'Diferencia con nuestra idea', r.difference || '', { textarea: true, required: true })}
        </div>`;
}

function sectionBenchmark(d, open) {
    const b = d.benchmark;
    return fold('3 · Benchmark (fase 2)', open, `
        <p class="form-hint">Investiguen qué se está haciendo en el mundo con el modo investigador de cada IA (Claude, ChatGPT, Gemini, Perplexity)
            y sus propias fuentes. <strong>Verifiquen cada enlace</strong> antes de dejarlo: las IA inventan referencias.
            Lo que usen va con cita APA en (k), incluido el uso de IA.</p>
        <div class="subgroup">
            <div class="subgroup-title">Paso 1 · Investigar</div>
            <p class="form-hint">Copien el prompt y péguenlo en el modo investigador de cada IA.</p>
            <div class="ai-actions"><button type="button" class="btn btn-ghost" data-modal-action="copy-prompt">📋 Copiar prompt de investigación</button></div>
            <textarea class="form-textarea small prompt-box" id="promptBox" rows="6" readonly hidden></textarea>
        </div>
        <div class="subgroup">
            <div class="subgroup-title">Paso 2 · Respuestas de las IA</div>
            <div class="rows">${b.research.map(researchRow).join('')}</div>
            <button type="button" class="btn btn-ghost btn-add" data-modal-action="add-research"><svg><use href="#i-plus"/></svg>Agregar respuesta de una IA</button>
        </div>
        <div class="subgroup">
            <div class="subgroup-title">Paso 3 · Depurar e importar</div>
            <p class="form-hint">Copien el prompt de depuración (junta todas las respuestas) y péguenlo en Claude o ChatGPT Pro.
                Peguen el resultado abajo e importen los referentes. Sin depuración, se importan desde las respuestas del paso 2.</p>
            <div class="ai-actions"><button type="button" class="btn btn-ghost" data-modal-action="copy-consolidation">📋 Copiar prompt para depurar</button></div>
            <textarea class="form-textarea small prompt-box" id="consolidationBox" rows="6" readonly hidden></textarea>
            ${field('benchmark.consolidated', 'Resultado depurado', b.consolidated, { textarea: true, rows: 4, placeholder: 'Pega aquí la respuesta de la depuración' })}
            <div class="ai-actions"><button type="button" class="btn btn-ghost" data-modal-action="import-refs">⬇ Importar referentes</button></div>
        </div>
        <div class="rows">${b.refs.map(benchmarkRefRow).join('')}</div>
        <button type="button" class="btn btn-ghost btn-add" data-modal-action="add-ref"><svg><use href="#i-plus"/></svg>Agregar referente</button>
        <div class="form-group"><label class="form-label">Tendencia del tema</label>${pills('benchmark.trend', L.BENCHMARK_TRENDS, b.trend)}</div>
        ${field('benchmark.differentiation', 'Qué nos diferencia de lo que existe', b.differentiation, { textarea: true, required: true, placeholder: 'Precio, público, tecnología, contexto chileno…' })}
        ${field('benchmark.notes', 'Notas de la investigación', b.notes, { textarea: true, rows: 3, placeholder: 'Hallazgos, cifras, riesgos, fuentes por citar' })}
        <div class="form-group"><label class="form-label">Decisión <span class="req-star">*</span></label>${pills('benchmark.verdict', L.BENCHMARK_VERDICTS, b.verdict)}</div>
    `, ideaRequirements(d, 'ficha').length === 0, 'benchmark');
}

async function evaluateOpenIdea() {
    if (!String(draft.title || '').trim()) return;
    // Se evalúa lo guardado: primero se guardan los cambios pendientes.
    if (hasUnsavedChanges || !getItem(currentEditingId)) await persistIdea('');
    showToast('🤖 Evaluando con Gemini…', 'success', 2000);
    const started = Date.now();
    const tick = () => {
        const button = document.querySelector('[data-modal-action="ai-eval"]');
        if (!button) return;
        button.disabled = true;
        button.textContent = `🤖 Evaluando… ${Math.round((Date.now() - started) / 1000)} s`;
    };
    tick();
    const timer = setInterval(tick, 1000);
    try {
        const id = currentEditingId;
        const before = draft.ai_filter ? draft.ai_filter.verdict : '';
        const result = await evaluateIdea(getItem(id));
        // Si cerraron o cambiaron de idea mientras tanto, solo se avisa.
        if (currentEditingId !== id) {
            showToast(`✓ ${id} evaluada: ${verdictChange(before, result.ai_filter.verdict)}`, 'success', 6000);
            return;
        }
        draft = result;
        hasUnsavedChanges = false;
        const text = `✓ Evaluación lista a las ${clockTime(draft.ai_filter.at)}: ${verdictChange(before, draft.ai_filter.verdict)} · ${draft.ai_filter.model}`;
        lastEvaluation = { id: currentEditingId, text };
        renderModalBody();
        showToast(text, 'success', 6000);
    } catch (e) {
        showToast(`❌ ${e.message}`, 'error', 8000);
        renderModalBody();
    } finally {
        clearInterval(timer);
    }
}

// --- Plan de trabajo según el tipo ---

function sectionPlan(d, open) {
    const plan = workPlan(d.offering);
    if (!plan.length) return '';
    const offering = findOption(L.OFFERING_TYPES, d.offering);
    const done = plan.filter(p => d.plan_done[p.id]).length;
    return fold(`Plan de trabajo · ${offering.icon} ${offering.label} (${done}/${plan.length})`, open, `
        <p class="form-hint">Lo que hay que producir según el tipo de propuesta, dentro de las ${L.WORK_HOURS} h de trabajo. Se puede pasar al tablero de Tareas con responsable y hora.</p>
        ${plan.map(p => `
            <label class="plan-item">
                <input type="checkbox" data-draft="plan_done.${p.id}" ${d.plan_done[p.id] ? 'checked' : ''}>
                <span><strong>${escapeHtml(p.label)}</strong> <span class="form-hint inline">H${p.hour}</span><span class="form-hint">${escapeHtml(p.hint)}</span></span>
            </label>`).join('')}
        <div class="ai-actions">
            <button type="button" class="btn btn-ghost" data-modal-action="plan-tasks"><svg><use href="#i-plus"/></svg>Agregar al tablero de Tareas</button>
        </div>
    `, done === plan.length, 'plan');
}

async function addPlanTasks() {
    const plan = workPlan(draft.offering);
    const note = `Plan de ${currentEditingId}`;
    const existing = byKind('task').filter(t => t.data.note === note).map(t => t.data.plan_id);
    const pending = plan.filter(p => !existing.includes(p.id));
    if (!pending.length) {
        showToast('Las tareas de este plan ya están en el tablero', 'warning');
        return;
    }
    for (const p of pending) {
        await saveItem(makeItem(nextTaskId(), 'task', {
            title: `${currentEditingId} · ${p.label}`, deliverable: p.hint, owner: draft.owner || '',
            status: 'pendiente', hour: p.hour, note, plan_id: p.id
        }, nextPosition('task')), { rerender: false });
    }
    showToast(`✓ ${pending.length} tarea(s) agregadas al tablero`);
}

async function copyText(text, boxId) {
    const box = document.getElementById(boxId);
    box.value = text;
    try {
        await navigator.clipboard.writeText(text);
        showToast('✓ Prompt copiado: pégalo en la IA');
        box.hidden = true;
    } catch (e) {
        // Sin acceso al portapapeles: se muestra para copiarlo a mano.
        box.hidden = false;
        box.select();
        showToast('Copia el prompt desde el cuadro', 'warning');
    }
}

function sectionFicha(d, open) {
    const render = f => field(f.id, f.label, d[f.id], { textarea: !f.input, rows: f.rows || 2, required: f.required, hint: f.hint || '' });
    return fold('4 · Ficha de idea', open, FICHA_FIELDS.map(f => f.group
        ? `<div class="subgroup"><div class="subgroup-title">${escapeHtml(f.group)}</div>${f.fields.some(x => x.input) ? `<div class="row-2">${f.fields.filter(x => x.input).map(render).join('')}</div>` : ''}${f.fields.filter(x => !x.input).map(render).join('')}</div>`
        : render(f)).join(''), ideaRequirements(d, 'validacion').length === 0, 'ficha');
}

function validationRow(v, index) {
    return `
        <div class="vsrc">
            <div class="vsrc-head">
                <span class="vsrc-num">Validación ${index + 1}</span>
                <button type="button" class="row-remove" data-modal-action="remove-validation" data-index="${index}" aria-label="Quitar">×</button>
            </div>
            <div class="row-2">
                <div class="form-group"><label class="form-label">Tipo</label>
                    <select class="form-select" data-draft="validations.${index}.type">
                        ${L.VALIDATION_TYPES.map(t => `<option ${t === v.type ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
                    </select>
                </div>
                ${field(`validations.${index}.who`, 'Con quién', v.who || '', { placeholder: 'Persona, grupo o fuente' })}
            </div>
            ${field(`validations.${index}.finding`, 'Hallazgo', v.finding || '', { textarea: true, placeholder: 'Qué aprendimos y qué cambia en la idea' })}
        </div>`;
}

function sectionValidation(d, open) {
    const score = ideaScore(d);
    return fold('5 · Validación y puntaje', open, `
        <div class="rows">${d.validations.map(validationRow).join('')}</div>
        <button type="button" class="btn btn-ghost btn-add" data-modal-action="add-validation"><svg><use href="#i-plus"/></svg>Agregar validación</button>
        <div class="subgroup">
            <div class="subgroup-title">Puntaje 1–5 por criterio del jurado ${score !== null ? `<span class="score-big">★ ${score}</span>` : ''}</div>
            ${L.CRITERIA.map(c => `
                <div class="filter-row">
                    <span>${escapeHtml(c.label)}</span>
                    ${pills(`scores.${c.id}`, [1, 2, 3, 4, 5].map(n => ({ id: String(n), label: String(n), color: 'var(--k-s4)' })), String(d.scores[c.id] || ''))}
                </div>`).join('')}
        </div>
    `, ideaRequirements(d, 'elegida').length === 0, 'validacion');
}

function renderModalBody() {
    const d = draft;
    const stage = Math.max(0, ideaStageIndex(d.status));
    const discarded = d.status === 'descartada';
    const reached = discarded ? Math.max(0, ideaStageIndex(d.discarded_from)) : stage;
    const sections = [sectionIdea, sectionFilter, sectionBenchmark, sectionFicha, sectionValidation];
    const openIndex = Math.min(reached, sections.length - 1);
    const body = document.getElementById('modalBody');
    // Al repintar se conservan las secciones abiertas y la posición del scroll.
    const scroll = body.scrollTop;
    const openKeys = [...body.querySelectorAll('details[data-fold]')].map(el => [el.dataset.fold, el.open]);
    body.innerHTML = `
        ${discarded ? `<div class="req warn"><strong>Descartada</strong> desde ${escapeHtml(findOption(IDEA_STAGES, d.discarded_from).label)}: ${escapeHtml(d.discard_reason || 'sin motivo')}</div>` : ''}
        <div class="discard-panel" id="discardPanel" hidden>
            <div class="form-group"><label class="form-label" for="discardChoice">Motivo del descarte</label>
                <select class="form-select" id="discardChoice">
                    ${L.DISCARD_REASONS.map(r => `<option>${escapeHtml(r)}</option>`).join('')}
                </select>
            </div>
            <input class="form-input" id="discardDetail" placeholder="Detalle (opcional)">
            <div class="discard-actions">
                <button type="button" class="btn btn-ghost" data-modal-action="discard-cancel">Cancelar</button>
                <button type="button" class="btn btn-danger" data-modal-action="discard-confirm">Descartar</button>
            </div>
        </div>
        <div class="req-box" id="reqBox"></div>
        ${sections.slice(0, reached + 1).map((fn, i) => fn(d, i === openIndex)).join('')}
        ${reached >= 1 ? sectionPlan(d, false) : ''}`;
    openKeys.forEach(([key, open]) => {
        const el = body.querySelector(`details[data-fold="${key}"]`);
        if (el) el.open = open;
    });
    body.scrollTop = scroll;
    updateRequirementsBox();
}

function updateRequirementsBox() {
    const box = document.getElementById('reqBox');
    if (!box || !draft) return;
    const item = getItem(currentEditingId) || { id: currentEditingId };
    if (draft.status === 'descartada' || draft.status === 'elegida') {
        box.innerHTML = reqBox([], '', ideaWarnings(item, draft));
        return;
    }
    const next = IDEA_STAGES[ideaStageIndex(draft.status) + 1];
    const failed = filterFailures(draft);
    const warnings = ideaWarnings(item, draft);
    if (failed.length) warnings.unshift(`Falla el filtro rápido: ${failed.map(q => q.label).join(' ')} Descártala.`);
    if (feasibility(draft).level === 'rojo') warnings.unshift(`Semáforo rojo: con lo que hay no alcanza en ${L.WORK_HOURS} h de trabajo.`);
    box.innerHTML = reqBox(ideaRequirements(draft, next.id), `Lista para pasar a ${next.label}.`, warnings);
    const advance = document.querySelector('[data-modal-action="advance"]');
    if (advance) advance.classList.toggle('ready', ideaRequirements(draft, next.id).length === 0);
}

function renderModalFooter() {
    const d = draft;
    const footer = document.getElementById('modalFooter');
    if (d.status === 'descartada') {
        footer.innerHTML = `
            <div class="footer-left"><button class="btn btn-ghost danger" data-modal-action="delete">Eliminar definitivamente</button></div>
            <div class="footer-right"><button class="btn btn-ghost" data-modal-action="close">Cerrar</button><button class="btn btn-primary" data-modal-action="restore">Restaurar</button></div>`;
        return;
    }
    const i = ideaStageIndex(d.status);
    const prev = IDEA_STAGES[i - 1];
    const next = IDEA_STAGES[i + 1];
    footer.innerHTML = `
        <div class="footer-left">
            <button class="btn btn-ghost danger" data-modal-action="discard">Descartar</button>
            ${prev ? `<button class="btn btn-ghost" data-modal-action="back">← ${escapeHtml(prev.label)}</button>` : ''}
        </div>
        <div class="footer-right">
            ${next ? `<button class="btn btn-ghost btn-advance" style="--stage:${next.color}" data-modal-action="advance">${escapeHtml(next.label)} →</button>` : ''}
            <button class="btn btn-primary" data-modal-action="save">Guardar</button>
        </div>`;
}

function renderModalHeader() {
    const stage = findOption(IDEA_ALL, draft.status);
    document.getElementById('modalEyebrow').innerHTML = `<span>${escapeHtml(currentEditingId)}</span>${chip(stage)}`;
    document.getElementById('modalTitle').textContent = draft.name || draft.title || 'Nueva idea';
}

function openIdea(id) {
    const item = getItem(id);
    currentEditingId = id;
    draft = JSON.parse(JSON.stringify(item ? ideaData(item) : blankIdeaData()));
    hasUnsavedChanges = !item;
    document.getElementById('modalBody').innerHTML = '';
    renderModalHeader();
    renderModalBody();
    renderModalFooter();
    document.getElementById('modal').classList.add('open');
    const first = document.querySelector('#modalBody details[open] [data-draft]');
    if (first && !item) first.focus();
}

function closeIdea(force = false) {
    if (!force && hasUnsavedChanges && !confirm('¿Cerrar sin guardar los cambios?')) return;
    document.getElementById('modal').classList.remove('open');
    currentEditingId = null;
    lastEvaluation = null;
    draft = null;
    hasUnsavedChanges = false;
    render();
}

async function persistIdea(message) {
    const existing = getItem(currentEditingId);
    const item = existing ? { ...existing, data: draft } : makeItem(currentEditingId, 'idea', draft, nextPosition('idea'));
    const ok = await saveItem({ ...item, data: JSON.parse(JSON.stringify(draft)) }, { rerender: false });
    hasUnsavedChanges = false;
    if (ok && message) showToast(message);
    return ok;
}

async function moveIdea(direction) {
    const i = ideaStageIndex(draft.status);
    if (direction === 'advance') {
        const next = IDEA_STAGES[i + 1];
        const missing = ideaRequirements(draft, next.id);
        if (missing.length) {
            showToast(`Faltan ${missing.length} requisito(s) para pasar a ${next.label}`, 'warning');
            document.getElementById('modalBody').scrollTop = 0;
            return;
        }
        draft.status = next.id;
    } else {
        draft.status = IDEA_STAGES[i - 1].id;
    }
    await persistIdea(`✓ ${currentEditingId} → ${findOption(IDEA_STAGES, draft.status).label}`);
    ideaTab = draft.status;
    closeIdea(true);
}

function handleModalAction(action, el) {
    switch (action) {
        case 'save': return persistIdea('✓ Idea guardada').then(() => closeIdea(true));
        case 'close': return closeIdea();
        case 'advance': return moveIdea('advance');
        case 'back': return moveIdea('back');
        case 'add-validation':
            draft.validations.push({ type: L.VALIDATION_TYPES[0], who: '', finding: '' });
            hasUnsavedChanges = true;
            return renderModalBody();
        case 'add-ref':
            draft.benchmark.refs.push({ name: '', country: '', url: '', what: '', difference: '' });
            hasUnsavedChanges = true;
            return renderModalBody();
        case 'remove-ref':
            draft.benchmark.refs.splice(Number(el.dataset.index), 1);
            hasUnsavedChanges = true;
            return renderModalBody();
        case 'copy-prompt': return copyText(benchmarkPrompt(draft), 'promptBox');
        case 'copy-consolidation':
            if (!draft.benchmark.research.some(r => String(r.text || '').trim())) {
                return showToast('Primero peguen en el paso 2 la respuesta de al menos una IA', 'warning');
            }
            return copyText(consolidationPrompt(draft), 'consolidationBox');
        case 'import-refs': return importRefs();
        case 'add-research':
            draft.benchmark.research.push({ ai: L.BENCHMARK_AIS[draft.benchmark.research.length] || L.BENCHMARK_AIS[0], text: '' });
            hasUnsavedChanges = true;
            return renderModalBody();
        case 'remove-research':
            draft.benchmark.research.splice(Number(el.dataset.index), 1);
            hasUnsavedChanges = true;
            return renderModalBody();
        case 'ai-eval': return evaluateOpenIdea();
        case 'plan-tasks': return addPlanTasks();
        case 'remove-validation':
            draft.validations.splice(Number(el.dataset.index), 1);
            hasUnsavedChanges = true;
            return renderModalBody();
        case 'discard': {
            const panel = document.getElementById('discardPanel');
            panel.hidden = false;
            // Si falla el filtro, propone el motivo que corresponde.
            const failed = filterFailures(draft)[0];
            const map = { beneficiario: 0, prototipo: 1, economica: 2, reporte: 3 };
            const choice = document.getElementById('discardChoice');
            if (failed) choice.selectedIndex = map[failed.id];
            else if (feasibility(draft).level === 'rojo') choice.selectedIndex = 4;
            else if (draft.benchmark.verdict === 'descartar') choice.selectedIndex = 5;
            document.getElementById('modalBody').scrollTop = 0;
            return;
        }
        case 'discard-cancel':
            document.getElementById('discardPanel').hidden = true;
            return;
        case 'discard-confirm': {
            const reason = document.getElementById('discardChoice').value;
            const detail = document.getElementById('discardDetail').value.trim();
            draft.discarded_from = draft.status;
            draft.discard_reason = detail ? `${reason}: ${detail}` : reason;
            draft.status = 'descartada';
            return persistIdea(`${currentEditingId} descartada`).then(() => closeIdea(true));
        }
        case 'restore':
            draft.status = draft.discarded_from || 'banco';
            draft.discard_reason = '';
            draft.discarded_from = '';
            ideaTab = draft.status;
            return persistIdea(`✓ ${currentEditingId} restaurada`).then(() => closeIdea(true));
        case 'delete': return deleteIdea(currentEditingId);
    }
}

async function deleteIdea(id) {
    if (!confirm(`¿Eliminar definitivamente ${id}? No se puede deshacer.`)) return;
    if (currentEditingId === id) closeIdea(true);
    if (await deleteItem(id)) showToast(`${id} eliminada`);
}

function setupIdeaModal() {
    const body = document.getElementById('modalBody');
    const onEdit = (e) => {
        const el = e.target;
        if (!el.dataset.draft || !draft) return;
        if (el.type === 'radio' && !el.checked) return;
        setPath(draft, el.dataset.draft, el.type === 'checkbox' ? el.checked : el.value);
        hasUnsavedChanges = true;
        if (el.dataset.draft === 'title' || el.dataset.draft === 'name') renderModalHeader();
        // El tipo cambia el plan de trabajo; las respuestas del semáforo, su resultado.
        if (el.dataset.draft === 'offering' || el.dataset.draft.startsWith('plan_done.')) return renderModalBody();
        if (draft.ai_set && el.dataset.draft in draft.ai_set) return renderModalBody();
        if (el.dataset.draft.startsWith('feasibility.')) document.getElementById('feasBadge').innerHTML = feasibilityBadge(draft);
        updateRequirementsBox();
    };
    body.addEventListener('input', onEdit);
    body.addEventListener('change', onEdit);
    body.addEventListener('click', (e) => {
        const button = e.target.closest('[data-modal-action]');
        if (button) handleModalAction(button.dataset.modalAction, button);
    });
    document.getElementById('modalFooter').addEventListener('click', (e) => {
        const button = e.target.closest('[data-modal-action]');
        if (button) handleModalAction(button.dataset.modalAction, button);
    });
    document.getElementById('modal').addEventListener('click', (e) => {
        if (e.target.id === 'modal') closeIdea();
    });
    document.getElementById('btnCloseModal').addEventListener('click', () => closeIdea());
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && currentEditingId) closeIdea();
    });
}

registerView({
    id: 'ideas',
    label: 'Ideas',
    order: 4,
    badge: () => {
        const n = ideas().filter(i => i.data.status !== 'descartada').length;
        return n ? `<span class="badge">${n}</span>` : '';
    },
    render: renderIdeasView,
    onInput(el) {
        if (el.id !== 'ideaSearch') return;
        ideaSearch = el.value.trim().toLowerCase();
        const grid = document.querySelector('#content .grid');
        // Repinta solo las tarjetas para no perder el foco del buscador.
        const tmp = document.createElement('div');
        tmp.innerHTML = renderIdeasView();
        grid.replaceWith(tmp.querySelector('.grid'));
    },
    actions: {
        'new-idea': () => {
            ideaTab = 'banco';
            openIdea(nextIdeaId());
        },
        'idea-tab': (el) => {
            ideaTab = el.dataset.status;
            render();
        },
        'delete-idea': (el, e) => {
            e.stopPropagation();
            deleteIdea(el.dataset.id);
        },
        'ai-triage': () => runTriage(),
        'ai-discard': () => discardRejected(),
        'send-to-filter': () => sendToFilter()
    }
});

// Abrir una tarjeta (clic o Enter), en cualquier vista que muestre tarjetas de ideas.
document.getElementById('content').addEventListener('click', (e) => {
    if (e.target.closest('[data-action]')) return;
    const card = e.target.closest('[data-idea]');
    if (card) openIdea(card.dataset.idea);
});
document.getElementById('content').addEventListener('keydown', (e) => {
    const card = e.target.closest('[data-idea]');
    if (card && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        openIdea(card.dataset.idea);
    }
});
setupIdeaModal();
