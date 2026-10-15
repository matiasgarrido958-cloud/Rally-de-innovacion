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
    if (!String(data.f_quien_paga || '').trim() && p.data.payer) data.f_quien_paga = p.data.payer;
    if (!String(data.beneficiary || '').trim() && p.data.affected) data.beneficiary = p.data.affected;
    if (!data.theme && c && c.data.theme) data.theme = c.data.theme;
}

function newIdeaForProblem(problemId) {
    const p = problemById(problemId);
    if (!p) return;
    if (!p.data.bench && !confirm(`${problemId} todavía no tiene benchmark del problema. ¿Proponer una solución igual?`)) return;
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

// --- Gemini en modo «extraer»: tarea + insumos → campos ---

const EXTRACT_TIMEOUT_MS = 100000;

async function askGemini(config, insumos, extraFields = null) {
    const campos = (extraFields || config.FIELDS).map(({ id, instruccion, opciones }) => ({ id, instruccion, ...(opciones ? { opciones } : {}) }));
    try {
        return await supabaseFunction(TRIAGE.FUNCTION, { mode: 'extraer', tarea: config.TASK, insumos, campos }, false, EXTRACT_TIMEOUT_MS);
    } catch (e) {
        // La función desplegada es anterior al modo «extraer».
        if (e.status === 400 && /idea o las preguntas/.test(e.message)) {
            throw new Error('La función de Gemini en Supabase es la versión anterior. Pega de nuevo supabase/functions/filtrar-idea/index.ts en Supabase (Edge Functions) y despliega');
        }
        throw e;
    }
}

// Lote genérico con progreso: una tarea a la vez, para hasta 3 fallos seguidos.
let aiBatch = null; // { label, done, total, started }

async function runAiBatch(label, list, fn) {
    if (aiBatch) return;
    if (LOCAL_MODE) return showToast('Usa Gemini: necesita Supabase, no funciona en modo local', 'warning');
    if (!list.length) return showToast('No hay nada nuevo ni cambiado que procesar', 'warning');
    aiBatch = { label, done: 0, total: list.length, started: Date.now() };
    const timer = setInterval(requestRender, 1000);
    render();
    let failed = 0;
    let streak = 0;
    let stopped = null;
    for (const [n, item] of list.entries()) {
        if (n) await new Promise(r => setTimeout(r, L.AI_TRIAGE.DELAY_MS));
        try {
            await fn(getItem(item.id) || item);
            streak = 0;
        } catch (e) {
            failed++;
            streak++;
            if (e instanceof AuthError || e.status === 401 || streak >= 3 || /versión anterior/.test(e.message)) {
                stopped = e;
                aiBatch.done++;
                break;
            }
        }
        aiBatch.done++;
        requestRender();
    }
    clearInterval(timer);
    const { done, total, started } = aiBatch;
    aiBatch = null;
    requestRender();
    const took = shortDuration(Date.now() - started);
    if (stopped) showToast(`❌ ${stopped.message.replace(/\.$/, '')}. Listos ${done - failed} de ${total} en ${took}.`, 'error', 12000);
    else if (failed) showToast(`⚠ ${label}: ${done - failed} de ${total} en ${took}; ${failed} fallaron, vuelve a apretar para reintentarlos.`, 'warning', 10000);
    else showToast(`✓ ${label} listo (${clockTime(new Date().toISOString())}) en ${took}: ${total}`, 'success', 8000);
}

function batchLabel(text, pending) {
    if (!aiBatch) return `${text} (${pending})`;
    const elapsed = Date.now() - aiBatch.started;
    const left = aiBatch.done ? (elapsed / aiBatch.done) * (aiBatch.total - aiBatch.done) : 0;
    return `${aiBatch.label}: ${Math.min(aiBatch.done + 1, aiBatch.total)} de ${aiBatch.total} · ${shortDuration(elapsed)}${left ? ` · faltan ~${shortDuration(left)}` : ''}`;
}

async function runOne(fn, item, okText) {
    if (LOCAL_MODE) return showToast('Usa Gemini: necesita Supabase, no funciona en modo local', 'warning');
    if (aiBatch) return showToast('Espera a que termine el proceso en curso', 'warning');
    showToast('🤖 Procesando con Gemini…', 'success', 2000);
    aiBatch = { label: 'Gemini', done: 0, total: 1, started: Date.now() };
    render();
    try {
        await fn(item);
        showToast(`✓ ${okText} a las ${clockTime(new Date().toISOString())}`, 'success', 6000);
    } catch (e) {
        showToast(`❌ ${e.message}`, 'error', 9000);
    } finally {
        aiBatch = null;
        render();
    }
}

// --- 1 · Desafíos: resumen con IA ---

const CSUM = L.CHALLENGE_SUMMARY;

function challengeSummaryInput(c) {
    return { desafio: c.data.title || '', organizacion: c.data.org || '', texto_de_las_bases: c.data.description || '' };
}

function summaryOutdated(c) {
    return Boolean(c.data.summary && c.data.summary.hash !== textHash(challengeSummaryInput(c)));
}

function needsSummary(c) {
    return String(c.data.title || '').trim() && (!c.data.summary || summaryOutdated(c));
}

async function summarizeChallenge(c) {
    const input = challengeSummaryInput(c);
    const result = await askGemini(CSUM, input);
    const fresh = getItem(c.id) || c;
    await saveItem({ ...fresh, data: { ...fresh.data, summary: { ...result.campos, model: result.model, at: new Date().toISOString(), hash: textHash(input) } } }, { rerender: false });
}

// Texto con que el resto del flujo conoce un desafío: título + resumen (o descripción).
function challengeBrief(c) {
    const sum = c.data.summary;
    const body = sum ? [sum.resumen, sum.incluye && `Incluye: ${sum.incluye}`, sum.no_incluye && `Fuera: ${sum.no_incluye}`, sum.palabras && `Claves: ${sum.palabras}`].filter(Boolean).join(' ')
        : String(c.data.description || '').slice(0, 500);
    return `${shortId(c)}: ${c.data.title || 'Sin título'}${body ? ` — ${body}` : ''}`;
}

// --- 2 · Problemas: clasificación automática, delimitación y benchmark ---

const PCLASS = L.PROBLEM_CLASSIFY;
const PBENCH = L.PROBLEM_BENCHMARK;
const openSteps = new Set(); // pasos abiertos a mano: "P-01:3"

function classifyInput(p) {
    return {
        desafios: challenges().map(challengeBrief).join('\n'),
        idea_o_problema: p.data.text || '',
        quien_lo_sufre: p.data.affected || ''
    };
}

function classOutdated(p) {
    return Boolean(p.data.cls && p.data.cls.hash !== textHash(classifyInput(p)));
}

function needsClass(p) {
    return String(p.data.text || '').trim() && challenges().length && (!p.data.cls || classOutdated(p));
}

async function classifyProblem(p) {
    const input = classifyInput(p);
    const ids = challenges().map(shortId);
    const fields = PCLASS.FIELDS.map(f => (f.id === 'desafio' ? { ...f, opciones: [...ids, 'ninguno'] }
        : f.id === 'alternativo' ? { ...f, opciones: [...ids, 'ninguno'] } : f));
    const result = await askGemini(PCLASS, input, fields);
    const r = result.campos;
    const fresh = getItem(p.id) || p;
    const data = { ...fresh.data, cls: { ...r, model: result.model, at: new Date().toISOString(), hash: textHash(input) } };
    // La asignación automática se aplica si el equipo no eligió otro desafío a mano.
    if (!data.desafio_manual) data.desafio_id = ids.includes(r.desafio) ? r.desafio : '';
    await saveItem({ ...fresh, data }, { rerender: false });
}

const PHMW = L.PROBLEM_HMW;

function hmwInput(p) {
    const c = challengeById(p.data.desafio_id);
    const b = p.data.bench || {};
    return {
        desafio: c ? challengeBrief(c) : '',
        problema: [p.data.text, p.data.affected && `Lo sufre: ${p.data.affected}`, p.data.approach && `Abordaremos: ${p.data.approach}`].filter(Boolean).join('. '),
        benchmark: PBENCH.FIELDS.map(f => b[f.id] ? `${f.label}: ${b[f.id]}` : '').filter(Boolean).join('\n')
    };
}

async function makeHmw(p) {
    const result = await askGemini(PHMW, hmwInput(p));
    const fresh = getItem(p.id) || p;
    await saveItem({ ...fresh, data: { ...fresh.data, hmw: { ...result.campos, model: result.model, at: new Date().toISOString() } } }, { rerender: false });
}

function benchInput(p) {
    return { informes: p.data.bench_report || '' };
}

function benchOutdated(p) {
    return Boolean(p.data.bench && p.data.bench.hash !== textHash(benchInput(p)));
}

async function processBenchmark(p) {
    if (!String(p.data.bench_report || '').trim()) throw new Error('Pega primero el informe de la IA investigadora');
    const input = benchInput(p);
    const result = await askGemini(PBENCH, input);
    const fresh = getItem(p.id) || p;
    await saveItem({ ...fresh, data: { ...fresh.data, bench: { ...result.campos, model: result.model, at: new Date().toISOString(), hash: textHash(input) } } }, { rerender: false });
}

// Prompt para la IA investigadora, armado con el desafío y la delimitación del problema.
function problemResearchPrompt(p) {
    const c = challengeById(p.data.desafio_id);
    const d = p.data;
    const lines = [
        ['Desafío', c ? challengeBrief(c) : ''], ['Idea o problema', d.text], ['Quién lo sufre', d.affected],
        ['Alcance (a cuántos y dónde)', d.reach], ['Qué abordaremos', d.approach], ['Qué queda fuera', d.out_of_scope],
        ['Quién pagaría', d.payer], ['Dato o evidencia', d.evidence]
    ].filter(([, v]) => String(v || '').trim()).map(([k, v]) => `- ${k}: ${v}`).join('\n');
    return `Actúa como analista de vigilancia tecnológica y de mercado. Investiga en profundidad, con búsqueda web y fuentes reales, el PROBLEMA que describe un equipo universitario de ingeniería del Rally Latinoamericano de Innovación (sede ${L.SEDE_COUNTRY}). Todavía no tienen solución: necesitan entender el problema y lo que ya existe, en ${L.SEDE_COUNTRY} y en el resto de Latinoamérica, porque la solución debe poder adaptarse a varios países de la región.

CONTEXTO
${lines}

QUÉ NECESITO (una sección por punto)
1. A cuántos afecta: cifras clave con fuente y año (${L.SEDE_COUNTRY}, Latinoamérica y mundo).
2. Dónde ocurre: países o regiones donde es relevante.
3. Causas principales del problema.
4. Quién paga hoy: quién financia soluciones (Estado, municipios, empresas, usuarios, fondos), con ejemplos.
5. Qué se hace en el mundo: entre 5 y 8 soluciones existentes con nombre, país, enlace y qué hacen.
6. Brechas y oportunidades: qué no resuelven bien esas soluciones.
7. Tendencia: si el tema está en crecimiento, estable o en baja, con datos.
8. Normativa, políticas, programas o fondos relacionados en ${L.SEDE_COUNTRY} y en otros países de Latinoamérica.
9. Riesgos y barreras para implementar soluciones en ${L.SEDE_COUNTRY} y en el resto de Latinoamérica.
10. Fuentes en formato APA 7.

REGLAS
- No inventes empresas, cifras, enlaces ni citas. Si no encuentras algo, escribe "no encontrado".
- Marca con (verificar) lo que no pudiste confirmar en una fuente primaria.
- Responde en español.`;
}

// Pasos de cada problema: cuál está hecho y cuál toca ahora.
function problemSteps(p) {
    const d = p.data;
    const linked = ideas().filter(i => i.data.problem_id === shortId(p) && i.data.status !== 'descartada').length;
    return [
        { n: 1, label: 'Idea', done: Boolean(String(d.text || '').trim()) },
        { n: 2, label: 'Desafío', done: Boolean(d.desafio_id) },
        { n: 3, label: 'Delimitación', done: ['reach', 'approach', 'payer'].every(k => String(d[k] || '').trim()) },
        { n: 4, label: 'Benchmark', done: Boolean(d.bench) },
        { n: 5, label: 'Soluciones', done: linked > 0, linked }
    ];
}

function stepFold(p, step, current, title, body) {
    const key = `${shortId(p)}:${step.n}`;
    const open = openSteps.has(key) || (current && current.n === step.n && !closedSteps.has(key));
    return `<details class="fold step-fold" data-step="${escapeHtml(key)}" ${open ? 'open' : ''}>
        <summary class="section-title">${step.done ? '✓' : step.n} · ${escapeHtml(title)}</summary>
        <div class="section">${body}</div>
    </details>`;
}

function problemCheckHtml(p) {
    const check = p.data.check;
    if (!check) return '';
    const outdated = problemOutdated(p);
    const v = findOption(PCHECK.VERDICTS, check.verdict);
    const rows = PCHECK.QUESTIONS.map(q => {
        const a = check.answers[q.id] || {};
        const val = TRIAGE_VALUES[a.valor] || (a.valor === 'parcial' ? { label: 'Parcial', color: 'var(--k-s4)' } : { label: a.valor || '—', color: 'var(--k-neutral)' });
        return `<div class="filter-row"><span>${escapeHtml(q.label)}${a.motivo ? `<span class="form-hint">🤖 ${escapeHtml(a.motivo)}</span>` : ''}</span>${chip(val)}</div>`;
    }).join('');
    return `
        <details class="fold problem-check">
            <summary class="section-title">🤖 Planteamiento: ${chip(v)} ${outdated ? '⟳' : ''} <span class="form-hint inline">${escapeHtml(clockTime(check.at))} · ${escapeHtml(check.model)}</span></summary>
            <div class="section">
                ${outdated ? `<div class="req warn">${escapeHtml(outdated)}</div>` : ''}
                ${rows}
                ${check.falta ? `<p class="form-hint"><strong>Falta:</strong> ${escapeHtml(check.falta)}</p>` : ''}
            </div>
        </details>`;
}

function classHtml(p) {
    const cls = p.data.cls;
    const c = challengeById(p.data.desafio_id);
    const level = cls ? findOption(PCLASS.LEVELS, cls.calce) : null;
    const options = challenges().map(x => ({ id: shortId(x), label: `${shortId(x)} · ${x.data.title || 'Sin título'}` }));
    return `
        ${cls ? `<div class="filter-row"><span>🤖 ${c ? `<strong>${escapeHtml(shortId(c))} · ${escapeHtml(c.data.title || '')}</strong>` : '<strong>No calza con ningún desafío</strong>'}
            <span class="form-hint">${escapeHtml(cls.motivo || '')}${cls.alternativo && cls.alternativo !== 'ninguno' ? ` · También podría ser ${escapeHtml(cls.alternativo)}` : ''}${p.data.desafio_manual ? ' · Elegido a mano por el equipo' : ''}</span></span>
            ${level && level.label !== '—' ? chip(level) : ''}</div>
            ${classOutdated(p) ? '<div class="req warn">La idea o la lista de desafíos cambió: vuelve a clasificar.</div>' : ''}`
            : `<p class="form-hint">${challenges().length ? 'Gemini la clasifica sola al escribir la idea.' : 'Primero carguen los desafíos en la pestaña 1.'}</p>`}
        <div class="form-group"><label class="form-label">Desafío (cámbialo si no corresponde)</label>
            ${inlineSelect(p, 'desafio_id', options, { kind: 'setting', placeholder: 'Sin desafío' })}</div>
        <div class="ai-actions"><button class="btn btn-ghost" data-action="classify-one" data-id="${escapeHtml(shortId(p))}" ${LOCAL_MODE || !challenges().length ? 'disabled' : ''}>🤖 ${cls ? 'Clasificar de nuevo' : 'Clasificar'}</button></div>`;
}

function benchHtml(p) {
    const b = p.data.bench;
    const id = shortId(p);
    const kind = { kind: 'setting' };
    const matrix = b ? `
        <div class="bench-matrix">
            ${PBENCH.FIELDS.map(f => `<div class="bench-row"><span class="bench-key">${escapeHtml(f.label)}</span><span>${escapeHtml(b[f.id] || '—')}</span></div>`).join('')}
            <p class="form-hint">🤖 ${escapeHtml(b.model || '')} · ${escapeHtml(clockTime(b.at))}${benchOutdated(p) ? ' · ⟳ el informe cambió: vuelve a procesarlo' : ''}</p>
        </div>` : '';
    return `
        <p class="form-hint">1) Copien el prompt y péguenlo en el modo investigador de Claude, ChatGPT, Gemini o Perplexity. 2) Peguen el informe abajo (pueden pegar varios, uno tras otro). 3) Procesen: Gemini lo resume en la matriz.</p>
        <div class="ai-actions"><button class="btn btn-ghost" data-action="copy-problem-prompt" data-id="${escapeHtml(id)}">📋 Copiar prompt de investigación</button></div>
        <textarea class="form-textarea small prompt-box" id="pprompt-${escapeHtml(id)}" rows="6" readonly hidden></textarea>
        <div class="form-group"><label class="form-label">Informe de la IA investigadora</label>${inlineTextarea(p, 'bench_report', { ...kind, rows: 5, cls: 'small', placeholder: 'Pega aquí el informe completo' })}</div>
        <div class="ai-actions"><button class="btn btn-accent" data-action="bench-one" data-id="${escapeHtml(id)}" ${LOCAL_MODE ? 'disabled' : ''}>🤖 Procesar informe → matriz</button></div>
        ${matrix}`;
}

function problemCard(p) {
    const id = shortId(p);
    const kind = { kind: 'setting' };
    const steps = problemSteps(p);
    const current = steps.find(s => !s.done) || null;
    const [s1, s2, s3, s4, s5] = steps;
    return `
        <div class="vsrc problem">
            <div class="vsrc-head">
                <span class="vsrc-num">${escapeHtml(id)}</span>
                <span class="step-track">${steps.map(s => `<span class="step-pill ${s.done ? 'done' : current && current.n === s.n ? 'now' : ''}">${s.done ? '✓' : s.n} ${escapeHtml(s.label)}</span>`).join('')}</span>
                <button class="row-remove" data-action="delete-problem" data-id="${escapeHtml(id)}" aria-label="Eliminar">×</button>
            </div>
            ${stepFold(p, s1, current, 'Idea o problema (sin solución todavía)', `
                ${inlineTextarea(p, 'text', { ...kind, rows: 2, cls: 'small', placeholder: 'Qué queremos abordar. Ej.: usar el desperdicio textil como materia prima' })}
                <div class="form-group"><label class="form-label">Quién lo sufre</label>${inlineInput(p, 'affected', { ...kind, placeholder: 'Grupo concreto de personas u organizaciones' })}</div>`)}
            ${stepFold(p, s2, current, 'Desafío (🤖 automático)', classHtml(p))}
            ${stepFold(p, s3, current, 'Delimitación del problema', `
                <div class="row-2">
                    <div class="form-group"><label class="form-label">Alcance: a cuántos y dónde</label>${inlineInput(p, 'reach', { ...kind, placeholder: '12.000 hogares en Maipú (INE 2024)' })}</div>
                    <div class="form-group"><label class="form-label">Quién pagaría</label>${inlineInput(p, 'payer', { ...kind, placeholder: 'Municipio, empresa, usuario, fondo…' })}</div>
                </div>
                <div class="form-group"><label class="form-label">Qué abordaremos</label>${inlineTextarea(p, 'approach', { ...kind, rows: 2, cls: 'small', placeholder: 'Qué parte del problema atacamos (una causa, una etapa o un grupo) y por qué' })}</div>
                <div class="form-group"><label class="form-label">Qué queda fuera</label>${inlineInput(p, 'out_of_scope', { ...kind, placeholder: 'Lo que no vamos a resolver' })}</div>
                <div class="form-group"><label class="form-label">Dato o evidencia</label>${inlineInput(p, 'evidence', { ...kind, placeholder: 'Cifra, estudio u observación de que el problema existe' })}</div>
                ${problemCheckHtml(p)}
                <div class="ai-actions"><button class="btn btn-ghost" data-action="check-problem" data-id="${escapeHtml(id)}" ${LOCAL_MODE ? 'disabled' : ''}>🤖 ${p.data.check ? 'Revisar planteamiento de nuevo' : 'Revisar planteamiento (opcional)'}</button></div>`)}
            ${stepFold(p, s4, current, 'Benchmark del problema', benchHtml(p))}
            ${stepFold(p, s5, current, 'Soluciones (lluvia de ideas)', `
                ${p.data.hmw ? `<div class="bench-matrix">${['hmw1', 'hmw2', 'hmw3'].filter(k => p.data.hmw[k]).map(k => `<div class="hmw">💡 ${escapeHtml(p.data.hmw[k])}</div>`).join('')}</div>`
                    : '<p class="form-hint">Generen las preguntas «¿Cómo podríamos…?» para enfocar la lluvia de ideas, o propongan soluciones directo.</p>'}
                <div class="ai-actions">
                    <button class="btn btn-ghost" data-action="hmw-one" data-id="${escapeHtml(id)}" ${LOCAL_MODE ? 'disabled' : ''}>🤖 ${p.data.hmw ? 'Otras preguntas' : 'Preguntas «¿Cómo podríamos…?»'}</button>
                    <button class="btn btn-accent" data-action="idea-for-problem" data-id="${escapeHtml(id)}"><svg><use href="#i-plus"/></svg>Idea de solución${s5.linked ? ` (${s5.linked} en curso)` : ''}</button>
                </div>`)}
        </div>`;
}

// --- ¿Cómo funciona? (una sola pantalla, en las pestañas 1, 2 y 3) ---

let howToOpen = false;

function toggleHowTo() {
    howToOpen = !howToOpen;
    render();
}

function howToButton() {
    return `<button class="btn btn-ghost" data-action="howto" aria-expanded="${howToOpen}">❔ ${howToOpen ? 'Cerrar guía' : '¿Cómo funciona?'}</button>`;
}

function howToPanel() {
    if (!howToOpen) return '';
    const step = (n, title, items) => `<div class="howto-step"><div class="howto-n">${n}</div><div><strong>${title}</strong><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul></div></div>`;
    return `
        <section class="panel howto">
            <div class="panel-head"><h2>Cómo funciona: de 10 desafíos a 1 solución</h2><button class="row-remove" data-action="howto" aria-label="Cerrar">×</button></div>
            <p class="form-hint">Todo es en orden. Cada tarjeta muestra el paso que toca; 🤖 = lo hace Gemini. Pensamos soluciones adaptables a varios países de Latinoamérica.</p>
            <div class="howto-grid">
                ${step(1, '1 · Desafíos', ['Escriban el nombre de cada desafío (el texto de las bases es opcional).', '🤖 Resumen: de qué trata, qué incluye y qué queda fuera.'])}
                ${step(2, '2 · Problemas', ['Cada uno anota la idea o problema, sin solución.', '🤖 Se asigna sola al desafío que calza.', 'Delimitación: alcance, qué sí y qué no, quién pagaría.', 'Benchmark: copien el prompt → IA investigadora → peguen el informe → 🤖 matriz.', '🤖 Preguntas «¿Cómo podríamos…?» → lluvia de ideas.'])}
                ${step(3, '3 · Soluciones', ['Lluvia de ideas: anoten todo sin evaluar.', '🤖 Ordenar: % de similitud, fusiones y filtro → máximo 4 finalistas.', 'Benchmark de la solución → 🤖 matriz de innovación (Oslo).', '🤖 Decisión: puntaje con la rúbrica del jurado → el líder elige.', 'Construir: 🤖 ficha prellenada, plan, validación y pitch.'])}
            </div>
        </section>`;
}

// --- Vistas ---

function challengeCard(c) {
    const id = shortId(c);
    const sum = c.data.summary;
    const kind = { kind: 'setting' };
    const n = problems(id).length;
    return `
        <section class="panel challenge">
            <div class="panel-head">
                <h2><span class="mono">${escapeHtml(id)}</span> ${escapeHtml(c.data.title || 'Desafío sin título')}</h2>
                <span class="form-hint">${n ? `${n} problema(s) en la pestaña 2` : ''}</span>
                <button class="row-remove" data-action="delete-challenge" data-id="${escapeHtml(id)}" aria-label="Eliminar desafío">×</button>
            </div>
            <div class="row-2">
                <div class="form-group"><label class="form-label">Nombre del desafío</label>${inlineInput(c, 'title', { ...kind, placeholder: 'Como viene en las bases' })}</div>
                <div class="form-group"><label class="form-label">ONG o empresa (opcional)</label>${inlineInput(c, 'org', { ...kind, placeholder: 'Quién lo propone' })}</div>
            </div>
            <div class="form-group"><label class="form-label">Texto de las bases (opcional, mejora el resumen)</label>${inlineTextarea(c, 'description', { ...kind, rows: 2, cls: 'small', placeholder: 'Pega aquí el texto del desafío si lo tienen' })}</div>
            ${sum ? `
                <div class="bench-matrix">
                    ${CSUM.FIELDS.map(f => `<div class="bench-row"><span class="bench-key">${escapeHtml(f.label)}</span><span>${escapeHtml(sum[f.id] || '—')}</span></div>`).join('')}
                    <p class="form-hint">🤖 ${escapeHtml(sum.model || '')} · ${escapeHtml(clockTime(sum.at))}${summaryOutdated(c) ? ' · ⟳ el desafío cambió: vuelve a resumir' : ''}</p>
                </div>` : ''}
            <div class="ai-actions"><button class="btn btn-ghost" data-action="summarize-one" data-id="${escapeHtml(id)}" ${LOCAL_MODE || !String(c.data.title || '').trim() ? 'disabled' : ''}>🤖 ${sum ? 'Resumir de nuevo' : 'Resumir con IA'}</button></div>
        </section>`;
}

function renderDesafios() {
    const list = challenges();
    const pending = list.filter(needsSummary).length;
    return `
        <div class="page-head">
            <div>
                <h1>1 · Desafíos</h1>
                <p>Ingresen los desafíos el día de la apertura (basta el nombre). Gemini hace un resumen breve: de qué trata, qué incluye y qué queda fuera. Luego sigan a la pestaña 2 · Problemas.</p>
            </div>
            <div class="page-head-actions">
                ${howToButton()}
                ${list.length ? `<button class="btn btn-ghost" data-action="summarize-all" ${LOCAL_MODE || aiBatch || !pending ? 'disabled' : ''}>🤖 ${escapeHtml(batchLabel('Resumir', pending))}</button>` : ''}
                <button class="btn btn-accent" data-action="add-challenge"><svg><use href="#i-plus"/></svg>Desafío</button>
            </div>
        </div>
        ${howToPanel()}
        ${list.length ? list.map(challengeCard).join('') : `
            <div class="empty">
                <div class="empty-icon">🎯</div>
                <strong>Todavía no hay desafíos</strong>
                Se publican en la apertura (H0). Agréguenlos con «+ Desafío»: con el nombre basta.
            </div>`}`;
}

function renderProblemas() {
    const all = problems();
    const list = challenges();
    const pendingClass = all.filter(needsClass).length;
    const groups = [...list.map(c => ({ title: `${shortId(c)} · ${c.data.title || 'Sin título'}`, items: all.filter(p => p.data.desafio_id === shortId(c)) })),
        { title: 'Sin desafío asignado', items: all.filter(p => !challengeById(p.data.desafio_id)) }].filter(g => g.items.length);
    return `
        <div class="page-head">
            <div>
                <h1>2 · Problemas</h1>
                <p>Cada uno anota la idea o problema que quiere abordar, todavía sin solución. Gemini la asigna sola al desafío que mejor calza. Luego, en orden: delimitación → benchmark del problema → lluvia de soluciones.</p>
            </div>
            <div class="page-head-actions">
                ${howToButton()}
                ${all.length && list.length ? `<button class="btn btn-ghost" data-action="classify-all" ${LOCAL_MODE || aiBatch || !pendingClass ? 'disabled' : ''}>🤖 ${escapeHtml(batchLabel('Clasificar', pendingClass))}</button>` : ''}
                <button class="btn btn-accent" data-action="add-problem"><svg><use href="#i-plus"/></svg>Idea o problema</button>
            </div>
        </div>
        ${howToPanel()}
        ${!list.length ? '<div class="req warn">Primero carguen los desafíos en la pestaña 1 · Desafíos: Gemini los usa para clasificar.</div>' : ''}
        ${groups.length ? groups.map(g => `
            <section class="panel">
                <div class="panel-head"><h2>${escapeHtml(g.title)}</h2><span class="count">${g.items.length}</span></div>
                <div class="rows">${g.items.map(problemCard).join('')}</div>
            </section>`).join('') : `
            <div class="empty">
                <div class="empty-icon">💡</div>
                <strong>Todavía no hay ideas ni problemas</strong>
                Agreguen uno con «+ Idea o problema».
            </div>`}`;
}

async function deleteChallenge(id) {
    const c = challengeById(id);
    if (!c) return;
    if (!confirm(`¿Eliminar ${id}? Sus problemas quedan «Sin desafío asignado».`)) return;
    await deleteItem(c.id);
}

async function copyProblemPrompt(id) {
    const p = problemById(id);
    if (!p) return;
    const text = problemResearchPrompt(p);
    const box = document.getElementById(`pprompt-${id}`);
    try {
        await navigator.clipboard.writeText(text);
        showToast('✓ Prompt copiado: pégalo en el modo investigador de la IA');
    } catch (e) {
        if (box) {
            box.value = text;
            box.hidden = false;
            box.select();
        }
        showToast('Copia el prompt desde el cuadro', 'warning');
    }
}

// Al escribir la idea (al salir del campo), Gemini la clasifica sola. Si el equipo
// elige el desafío a mano, la clasificación automática ya no lo cambia.
document.getElementById('content').addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.field === 'desafio_id' && String(el.dataset.id || '').startsWith(PRO_PREFIX)) {
        updateFields(el.dataset.id, 'setting', { desafio_manual: Boolean(el.value) }, { rerender: false });
        return;
    }
    if (LOCAL_MODE || !el.dataset || el.dataset.field !== 'text' || !String(el.dataset.id || '').startsWith(PRO_PREFIX)) return;
    setTimeout(() => {
        const p = getItem(el.dataset.id);
        if (p && needsClass(p) && !aiBatch) runOne(classifyProblem, p, `${shortId(p)} clasificado`);
    }, 300);
});
// Recuerda los pasos que el equipo abrió o cerró con un clic (no los que abre la página).
const closedSteps = new Set();
document.getElementById('content').addEventListener('click', (e) => {
    const summary = e.target.closest('details[data-step] > summary');
    if (!summary) return;
    const key = summary.parentElement.dataset.step;
    const willOpen = !summary.parentElement.open;
    if (willOpen) { openSteps.add(key); closedSteps.delete(key); }
    else { openSteps.delete(key); closedSteps.add(key); }
});

const challengeActions = {
    'add-challenge': () => {
        const id = nextShortId(DES_PREFIX, 'DS');
        saveItem(makeItem(`${DES_PREFIX}${id}`, 'setting', { title: '', org: '', description: '', theme: '' }, nextPosition('setting')));
    },
    'delete-challenge': (el) => deleteChallenge(el.dataset.id),
    'summarize-one': (el) => runOne(summarizeChallenge, challengeById(el.dataset.id), `Resumen de ${el.dataset.id} listo`),
    'summarize-all': () => runAiBatch('Resumir', challenges().filter(needsSummary), summarizeChallenge),
    howto: () => toggleHowTo()
};

const problemActions = {
    'add-problem': () => {
        const id = nextShortId(PRO_PREFIX, 'P');
        saveItem(makeItem(`${PRO_PREFIX}${id}`, 'setting', { desafio_id: '', text: '', affected: '', reach: '', evidence: '', approach: '', payer: '', out_of_scope: '' }, nextPosition('setting')));
    },
    'delete-problem': (el) => {
        const p = problemById(el.dataset.id);
        if (p && confirm(`¿Eliminar ${el.dataset.id}? Las ideas de solución se mantienen.`)) deleteItem(p.id);
    },
    'classify-one': (el) => runOne(classifyProblem, problemById(el.dataset.id), `${el.dataset.id} clasificado`),
    'classify-all': () => runAiBatch('Clasificar', problems().filter(needsClass), classifyProblem),
    'check-problem': (el) => checkOneProblem(el.dataset.id),
    'copy-problem-prompt': (el) => copyProblemPrompt(el.dataset.id),
    'bench-one': (el) => runOne(processBenchmark, problemById(el.dataset.id), `Matriz del benchmark de ${el.dataset.id} lista`),
    'hmw-one': (el) => runOne(makeHmw, problemById(el.dataset.id), `Preguntas de ${el.dataset.id} listas`),
    howto: () => toggleHowTo(),
    'idea-for-problem': (el) => newIdeaForProblem(el.dataset.id)
};

registerView({
    id: 'desafios', label: '1 · Desafíos', order: 3.5,
    badge: () => {
        const n = challenges().length;
        return n ? `<span class="badge">${n}</span>` : '';
    },
    render: renderDesafios,
    actions: challengeActions
});

registerView({
    id: 'problemas', label: '2 · Problemas', order: 3.6,
    badge: () => {
        const n = problems().length;
        return n ? `<span class="badge">${n}</span>` : '';
    },
    render: renderProblemas,
    actions: problemActions
});
