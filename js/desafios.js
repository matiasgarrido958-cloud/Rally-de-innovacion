// Desafíos → Problemas → Ideas de solución.
// 1. Los desafíos se cargan el día de la apertura (H0).
// 2. Para cada desafío el equipo plantea problemas o cuellos de botella: quién lo
//    sufre, a cuántos impacta y cómo lo abordaremos, antes de pensar la solución.
//    Gemini revisa si están alineados con el desafío y bien planteados (punto 1 de IA).
// 3. De cada problema salen ideas de solución, que entran al Banco de ideas; ahí
//    el Filtro rápido revisa si la solución ataca ese problema (punto 2 de IA).
//
// Se guardan en rally_items con kind 'setting' (la tabla no admite otros tipos sin
// migración) e ids 'set:des:DS-01' y 'set:pro:P-01'.

const DES_PREFIX = 'set:des:';
const PRO_PREFIX = 'set:pro:';
const PCHECK = L.PROBLEM_CHECK;
let problemRun = null; // { done, total, started } mientras se revisa en lote

function shortId(item) {
    return item.id.split(':').pop();
}

function byPrefix(prefix) {
    return items.filter(i => i.id.startsWith(prefix))
        .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id, undefined, { numeric: true }));
}

function challenges() {
    return byPrefix(DES_PREFIX);
}

function problems(challengeId = null) {
    const list = byPrefix(PRO_PREFIX);
    return challengeId ? list.filter(p => p.data.desafio_id === challengeId) : list;
}

function challengeById(id) {
    return id ? getItem(`${DES_PREFIX}${id}`) : null;
}

function problemById(id) {
    return id ? getItem(`${PRO_PREFIX}${id}`) : null;
}

function nextShortId(prefix, letter) {
    const re = new RegExp(`^${letter}-(\\d+)$`);
    const max = byPrefix(prefix).reduce((m, i) => Math.max(m, Number((shortId(i).match(re) || [])[1] || 0)), 0);
    return `${letter}-${String(max + 1).padStart(2, '0')}`;
}

function challengeText(c) {
    if (!c) return '';
    const d = c.data;
    return [d.title, d.org ? `(${d.org})` : '', d.description ? `— ${d.description}` : ''].filter(Boolean).join(' ');
}

function problemText(p) {
    if (!p) return '';
    return [p.data.text, p.data.affected ? `Lo sufre: ${p.data.affected}.` : '', p.data.reach ? `A cuántos impacta: ${p.data.reach}.` : ''].filter(Boolean).join(' ');
}

// Desafío y problema de una idea: el problema vinculado o, si no hay, lo escrito en la ficha (a y b).
function ideaContext(data) {
    const p = problemById(data.problem_id);
    const c = p ? challengeById(p.data.desafio_id) : null;
    return {
        problem: p, challenge: c,
        desafio: c ? challengeText(c) : String(data.a_desafio || ''),
        problema: p ? problemText(p) : String(data.b_problema || '')
    };
}

// Copia el desafío, el problema y el beneficiario del problema elegido a la idea
// (son los campos a y b de la ficha; el beneficiario y el tema solo si están vacíos).
function applyProblemLink(data) {
    const p = problemById(data.problem_id);
    if (!p) return;
    const c = challengeById(p.data.desafio_id);
    data.a_desafio = c ? challengeText(c) : data.a_desafio;
    data.b_problema = p.data.text || data.b_problema;
    data.b_alcance = p.data.reach || data.b_alcance;
    data.b_abordaje = p.data.approach || data.b_abordaje;
    if (!String(data.beneficiary || '').trim() && p.data.affected) data.beneficiary = p.data.affected;
    if (!data.theme && c && c.data.theme) data.theme = c.data.theme;
}

function newIdeaForProblem(problemId) {
    const p = problemById(problemId);
    if (!p) return;
    const v = (p.data.check || {}).verdict;
    if (v !== 'ok' && !confirm(v
        ? `Gemini marcó ${problemId} como «${findOption(PCHECK.VERDICTS, v).label}». ¿Proponer una solución igual?`
        : `${problemId} todavía no se revisa con Gemini. ¿Proponer una solución igual?`)) return;
    ideaTab = 'banco';
    goToView('ideas');
    openIdea(nextIdeaId());
    draft.problem_id = problemId;
    applyProblemLink(draft);
    renderModalHeader();
    renderModalBody();
}

// --- Punto 1 de IA: ¿el problema está alineado con el desafío y bien planteado? ---

function textHash(value) {
    let h = 0;
    for (const c of JSON.stringify(value)) h = (h * 31 + c.charCodeAt(0)) | 0;
    return String(h);
}

function problemInput(p) {
    const c = challengeById(p.data.desafio_id);
    return {
        desafio: challengeText(c),
        problema: p.data.text || '',
        quien_lo_sufre: p.data.affected || '',
        a_cuantos_impacta: p.data.reach || '',
        evidencia: p.data.evidence || '',
        como_lo_abordaremos: p.data.approach || ''
    };
}

function problemVerdict(answers) {
    const value = q => (answers[q.id] || {}).valor;
    if (value({ id: 'alineado' }) === 'no') return 'no_alineado';
    if (PCHECK.QUESTIONS.some(q => q.key && ['no', 'sin_datos', 'parcial'].includes(value(q)))) return 'revisar';
    return 'ok';
}

function problemOutdated(p) {
    const check = p.data.check;
    if (!check) return '';
    if (check.hash !== textHash(problemInput(p))) return 'El problema o su desafío cambió desde la revisión: vuelve a revisarlo.';
    if (check.rules !== textHash(PCHECK.QUESTIONS)) return 'Las reglas de la revisión cambiaron: vuelve a revisarlo.';
    return '';
}

function needsProblemCheck(p) {
    return String(p.data.text || '').trim() && (!p.data.check || problemOutdated(p));
}

async function checkProblem(p, retry = true) {
    const input = problemInput(p);
    const result = await callTriage({
        idea: input,
        questions: PCHECK.QUESTIONS.map(({ id, label, help, options }) => ({ id, label, help, options }))
    }, retry);
    const answers = result.answers || {};
    const fresh = getItem(p.id) || p;
    const check = {
        answers, falta: result.falta || '', model: result.model || '', verdict: problemVerdict(answers),
        hash: textHash(input), rules: textHash(PCHECK.QUESTIONS), at: new Date().toISOString()
    };
    await saveItem({ ...fresh, data: { ...fresh.data, check } }, { rerender: false });
    return check;
}

async function checkOneProblem(id) {
    if (LOCAL_MODE) return showToast('La revisión con IA necesita Supabase: no funciona en modo local', 'warning');
    const p = problemById(id);
    if (!p || !String(p.data.text || '').trim()) return showToast('Escribe primero el problema', 'warning');
    const before = (p.data.check || {}).verdict;
    showToast(`🤖 Revisando ${id} con Gemini…`, 'success', 2000);
    try {
        const check = await checkProblem(p);
        const label = v => findOption(PCHECK.VERDICTS, v).label;
        const change = !before ? `quedó ${label(check.verdict)}` : before === check.verdict ? `sigue ${label(check.verdict)} (sin cambios)` : `cambió de ${label(before)} a ${label(check.verdict)}`;
        render();
        showToast(`✓ Revisión lista a las ${clockTime(check.at)}: ${id} ${change} · ${check.model}`, 'success', 6000);
    } catch (e) {
        showToast(`❌ ${e.message}`, 'error', 8000);
    }
}

async function runProblemChecks() {
    if (problemRun) return;
    if (LOCAL_MODE) return showToast('La revisión con IA necesita Supabase: no funciona en modo local', 'warning');
    const pending = problems().filter(needsProblemCheck);
    if (!pending.length) return showToast('No hay problemas nuevos ni cambiados por revisar', 'warning');
    problemRun = { done: 0, total: pending.length, started: Date.now() };
    const timer = setInterval(requestRender, 1000);
    render();
    let failed = 0;
    let streak = 0;
    let stopped = null;
    for (const [n, p] of pending.entries()) {
        if (n) await new Promise(r => setTimeout(r, L.AI_TRIAGE.DELAY_MS));
        try {
            await checkProblem(getItem(p.id) || p, false);
            streak = 0;
        } catch (e) {
            failed++;
            streak++;
            if (e instanceof AuthError || e.status === 401 || streak >= 3) {
                stopped = e;
                problemRun.done++;
                break;
            }
        }
        problemRun.done++;
        requestRender();
    }
    clearInterval(timer);
    const { done, total, started } = problemRun;
    problemRun = null;
    requestRender();
    const took = shortDuration(Date.now() - started);
    if (stopped) showToast(`❌ Se detuvo tras ${streak} fallo(s) seguidos: ${stopped.message.replace(/\.$/, '')}. Revisados ${done - failed} de ${total} en ${took}.`, 'error', 12000);
    else if (failed) showToast(`⚠ Revisión lista en ${took}: ${done - failed} de ${total}; ${failed} fallaron, vuelve a apretar para reintentarlos.`, 'warning', 10000);
    else showToast(`✓ Revisión lista (${clockTime(new Date().toISOString())}) en ${took}: ${total} problema(s)`, 'success', 8000);
}

// --- Vista ---

function problemCheckHtml(p) {
    const check = p.data.check;
    if (!check) return '<p class="form-hint">Sin revisar con Gemini.</p>';
    const outdated = problemOutdated(p);
    const v = findOption(PCHECK.VERDICTS, check.verdict);
    const rows = PCHECK.QUESTIONS.map(q => {
        const a = check.answers[q.id] || {};
        const val = TRIAGE_VALUES[a.valor] || (a.valor === 'parcial' ? { label: 'Parcial', color: 'var(--k-s4)' } : { label: a.valor || '—', color: 'var(--k-neutral)' });
        return `<div class="filter-row"><span>${escapeHtml(q.label)}${a.motivo ? `<span class="form-hint">🤖 ${escapeHtml(a.motivo)}</span>` : ''}</span>${chip(val)}</div>`;
    }).join('');
    return `
        <details class="fold problem-check">
            <summary class="section-title">🤖 ${chip(v)} ${outdated ? '⟳' : ''} <span class="form-hint inline">${escapeHtml(clockTime(check.at))} · ${escapeHtml(check.model)}</span></summary>
            <div class="section">
                ${outdated ? `<div class="req warn">${escapeHtml(outdated)}</div>` : ''}
                ${rows}
                ${check.falta ? `<p class="form-hint"><strong>Falta:</strong> ${escapeHtml(check.falta)}</p>` : ''}
            </div>
        </details>`;
}

function problemBlock(p) {
    const id = shortId(p);
    const linked = ideas().filter(i => i.data.problem_id === id && i.data.status !== 'descartada').length;
    const kind = { kind: 'setting' };
    return `
        <div class="vsrc problem">
            <div class="vsrc-head">
                <span class="vsrc-num">${escapeHtml(id)} · Problema</span>
                <button class="row-remove" data-action="delete-problem" data-id="${escapeHtml(id)}" aria-label="Eliminar problema">×</button>
            </div>
            ${inlineTextarea(p, 'text', { ...kind, rows: 2, cls: 'small', placeholder: 'Qué falla o qué cuesta, dónde y a quién (el cuello de botella, no la solución)' })}
            <div class="row-2">
                <div class="form-group"><label class="form-label">Quién lo sufre</label>${inlineInput(p, 'affected', { ...kind, placeholder: 'Grupo concreto de personas u organizaciones' })}</div>
                <div class="form-group"><label class="form-label">A cuántos impacta</label>${inlineInput(p, 'reach', { ...kind, placeholder: 'Cifra y fuente: 12.000 hogares en Maipú (INE 2024)' })}</div>
            </div>
            <div class="form-group"><label class="form-label">Dato o evidencia</label>${inlineInput(p, 'evidence', { ...kind, placeholder: 'Cifra, estudio, fuente u observación de que el problema existe' })}</div>
            <div class="form-group"><label class="form-label">Cómo lo abordaremos</label>${inlineTextarea(p, 'approach', { ...kind, rows: 2, cls: 'small', placeholder: 'Qué parte del problema atacamos (una causa, una etapa o un grupo) y por qué. Todavía no la solución.' })}</div>
            ${problemCheckHtml(p)}
            <div class="ai-actions">
                <button class="btn btn-ghost" data-action="check-problem" data-id="${escapeHtml(id)}" ${LOCAL_MODE ? 'disabled' : ''}>🤖 ${p.data.check ? 'Revisar de nuevo' : 'Revisar con Gemini'}</button>
                <button class="btn btn-ghost" data-action="idea-for-problem" data-id="${escapeHtml(id)}"><svg><use href="#i-plus"/></svg>Idea de solución${linked ? ` (${linked} en curso)` : ''}</button>
            </div>
        </div>`;
}

function challengeBlock(c) {
    const id = shortId(c);
    const list = problems(id);
    const kind = { kind: 'setting' };
    return `
        <section class="panel challenge">
            <div class="panel-head">
                <h2><span class="mono">${escapeHtml(id)}</span> ${escapeHtml(c.data.title || 'Desafío sin título')}</h2>
                <button class="row-remove" data-action="delete-challenge" data-id="${escapeHtml(id)}" aria-label="Eliminar desafío">×</button>
            </div>
            <div class="row-2">
                <div class="form-group"><label class="form-label">Desafío</label>${inlineInput(c, 'title', { ...kind, placeholder: 'Título del desafío, como viene en las bases' })}</div>
                <div class="form-group"><label class="form-label">ONG o empresa</label>${inlineInput(c, 'org', { ...kind, placeholder: 'Quién lo propone' })}</div>
            </div>
            <div class="form-group"><label class="form-label">Descripción</label>${inlineTextarea(c, 'description', { ...kind, rows: 3, cls: 'small', placeholder: 'Pega aquí el texto del desafío' })}</div>
            <div class="form-group"><label class="form-label">Tema</label>${inlineSelect(c, 'theme', L.THEMES, { kind: 'setting', placeholder: 'Sin tema' })}</div>
            <div class="rows">${list.map(problemBlock).join('')}</div>
            <button class="btn btn-ghost btn-add" data-action="add-problem" data-id="${escapeHtml(id)}"><svg><use href="#i-plus"/></svg>Agregar problema o cuello de botella</button>
        </section>`;
}

function renderDesafios() {
    const list = challenges();
    const all = problems();
    const pending = all.filter(needsProblemCheck).length;
    const counts = PCHECK.VERDICTS.map(v => chip({ ...v, label: `${v.label}: ${all.filter(p => p.data.check && p.data.check.verdict === v.id).length}` }));
    let label = `🤖 Revisar problemas (${pending})`;
    if (problemRun) {
        const elapsed = Date.now() - problemRun.started;
        const left = problemRun.done ? (elapsed / problemRun.done) * (problemRun.total - problemRun.done) : 0;
        label = `Revisando ${Math.min(problemRun.done + 1, problemRun.total)} de ${problemRun.total} · ${shortDuration(elapsed)}${left ? ` · faltan ~${shortDuration(left)}` : ''}`;
    }
    return `
        <div class="page-head">
            <div>
                <h1>Desafíos</h1>
                <p>1 · Desafío (se carga en la apertura) → 2 · Problema: quién lo sufre, a cuántos impacta y cómo lo abordaremos (🤖 revisión) → 3 · Idea de solución (Banco de ideas)</p>
            </div>
            <div class="page-head-actions">
                <button class="btn btn-accent" data-action="add-challenge"><svg><use href="#i-plus"/></svg>Desafío</button>
            </div>
        </div>
        ${all.length ? `
        <div class="ai-bar">
            <div class="ai-bar-text">
                <strong>Punto 1 de IA: problemas</strong>
                <span class="form-hint">${LOCAL_MODE ? 'Necesita Supabase: en modo local no está disponible.' : 'Gemini revisa si cada problema está dentro de su desafío y bien planteado (concreto, con alguien que lo sufre, sin ser una solución disfrazada). Propongan soluciones para los «Alineado».'}</span>
                <div class="card-tags">${counts.join('')}</div>
            </div>
            <div class="ai-actions">
                <button class="btn btn-accent" data-action="check-problems" ${LOCAL_MODE || problemRun || !pending ? 'disabled' : ''}>${label}</button>
            </div>
        </div>` : ''}
        ${list.length ? list.map(challengeBlock).join('') : `
            <div class="empty">
                <div class="empty-icon">🎯</div>
                <strong>Todavía no hay desafíos</strong>
                Se publican en la apertura (H0). Cárguenlos con «+ Desafío», tal como vienen en las bases.
            </div>`}`;
}

async function deleteChallenge(id) {
    const c = challengeById(id);
    if (!c) return;
    const list = problems(id);
    if (!confirm(`¿Eliminar ${id}${list.length ? ` y sus ${list.length} problema(s)` : ''}? Las ideas de solución se mantienen.`)) return;
    for (const p of list) await deleteItem(p.id);
    await deleteItem(c.id);
}

registerView({
    id: 'desafios',
    label: 'Desafíos',
    order: 3.5,
    badge: () => {
        const n = challenges().length;
        return n ? `<span class="badge">${n}</span>` : '';
    },
    render: renderDesafios,
    actions: {
        'add-challenge': () => {
            const id = nextShortId(DES_PREFIX, 'DS');
            saveItem(makeItem(`${DES_PREFIX}${id}`, 'setting', { title: '', org: '', description: '', theme: '' }, nextPosition('setting')));
        },
        'add-problem': (el) => {
            const id = nextShortId(PRO_PREFIX, 'P');
            saveItem(makeItem(`${PRO_PREFIX}${id}`, 'setting', { desafio_id: el.dataset.id, text: '', affected: '', reach: '', evidence: '', approach: '' }, nextPosition('setting')));
        },
        'delete-challenge': (el) => deleteChallenge(el.dataset.id),
        'delete-problem': (el) => {
            const p = problemById(el.dataset.id);
            if (p && confirm(`¿Eliminar el problema ${el.dataset.id}? Las ideas de solución se mantienen.`)) deleteItem(p.id);
        },
        'check-problem': (el) => checkOneProblem(el.dataset.id),
        'check-problems': () => runProblemChecks(),
        'idea-for-problem': (el) => newIdeaForProblem(el.dataset.id)
    }
});
