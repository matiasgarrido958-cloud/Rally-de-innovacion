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
    if (problemStage(p) !== 'elegido' && !confirm(`${problemId} todavía no está elegido (fase ${findOption(L.PROBLEM_STAGES, problemStage(p)).label}). ¿Proponer una solución igual?`)) return;
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

// --- 2 · Problemas en fases: Lluvia → Ordenar → Benchmark → Decisión → Elegidos ---

const PSTAGES = L.PROBLEM_STAGES;
const PPRIO = L.PROBLEM_PRIORITY;
const PDEC = L.PROBLEM_DECISION;
const PDISCARDED = { id: 'descartado', label: 'Descartados', color: 'var(--k-neutral)', hint: 'Problemas que no siguieron, con su motivo. Se pueden restaurar.' };
let problemTab = 'lluvia';
let problemCorr = null; // { running, started, groups, comentario, model }
let problemOpen = ''; // en Ordenar: la tarjeta compacta que se abrió para editar

function problemStage(p) {
    return p.data.stage || (p.data.bench ? 'benchmark' : 'lluvia');
}

function problemsIn(stage) {
    return problems().filter(p => problemStage(p) === stage);
}

async function setProblemStage(id, stage, extra = {}) {
    const p = problemById(id);
    if (!p) return;
    await saveItem({ ...p, data: { ...p.data, ...extra, stage } }, { rerender: false });
}

// Ordenar: puntaje de priorización 1–5 (¿vale la pena investigarlo?).
function priorityInput(p) {
    const c = challengeById(p.data.desafio_id);
    const cls = p.data.cls;
    return {
        desafio: c ? challengeBrief(c) : 'sin desafío asignado',
        problema: p.data.text || '',
        quien_lo_sufre: p.data.affected || '',
        clasificacion: cls ? `${cls.desafio || ''} · calce ${cls.calce || ''} · ${cls.motivo || ''}` : ''
    };
}

function needsPriority(p) {
    return String(p.data.text || '').trim() && (!p.data.prio || p.data.prio.hash !== textHash(priorityInput(p)));
}

async function prioritizeProblem(p) {
    if (needsClass(p)) await classifyProblem(p);
    const fresh = getItem(p.id) || p;
    const input = priorityInput(fresh);
    const result = await askGemini(PPRIO, input);
    const now = getItem(p.id) || fresh;
    await saveItem({ ...now, data: { ...now.data, prio: { ...result.campos, model: result.model, at: new Date().toISOString(), hash: textHash(input) } } }, { rerender: false });
}

function priorityValue(p) {
    return Number((p.data.prio || {}).prioridad) || 0;
}

function priorityChip(p) {
    const v = priorityValue(p);
    if (!v) return '';
    const level = PPRIO.LEVELS[v];
    return `<span class="chip" style="--c:${level.color}" title="${escapeHtml((p.data.prio || {}).motivo || '')}">🤖 ${v}/5 ${escapeHtml(level.label)}</span>`;
}

// Decisión: puntaje con el benchmark, sobre 100.
function decisionProblemInput(p) {
    const c = challengeById(p.data.desafio_id);
    const d = p.data;
    return {
        desafio: c ? challengeBrief(c) : '',
        problema: [d.text, d.affected && `Lo sufre: ${d.affected}`, d.reach && `Alcance: ${d.reach}`, d.approach && `Abordaremos: ${d.approach}`, d.out_of_scope && `Fuera: ${d.out_of_scope}`, d.payer && `Pagaría: ${d.payer}`].filter(Boolean).join('. '),
        benchmark: PBENCH.FIELDS.map(f => d.bench && d.bench[f.id] ? `${f.label}: ${d.bench[f.id]}` : '').filter(Boolean).join('\n'),
        equipo: typeof teamText === 'function' ? teamText() : ''
    };
}

function decisionProblemFields() {
    return [
        ...PDEC.CRITERIA.flatMap(c => [
            { id: `p_${c.id}`, instruccion: `Puntaje de 1 a 5 en «${c.label}»: ${c.instruccion}`, opciones: ['1', '2', '3', '4', '5'] },
            { id: `m_${c.id}`, instruccion: `Por qué ese puntaje en ${c.label}, en una frase de máximo 20 palabras.` }
        ]),
        { id: 'recomendacion', instruccion: 'En una frase: conviene o no elegir este problema, y por qué.' }
    ];
}

async function decideProblem(p) {
    const input = decisionProblemInput(p);
    const result = await askGemini(PDEC, input, decisionProblemFields());
    const now = getItem(p.id) || p;
    await saveItem({ ...now, data: { ...now.data, pdec: { ...result.campos, model: result.model, at: new Date().toISOString(), hash: textHash(input) } } }, { rerender: false });
}

function needsProblemDecision(p) {
    return Boolean(p.data.bench) && (!p.data.pdec || p.data.pdec.hash !== textHash(decisionProblemInput(p)));
}

function problemTotal(p) {
    const dec = p.data.pdec;
    if (!dec) return null;
    const values = PDEC.CRITERIA.map(c => Number(dec[`p_${c.id}`]) || 0);
    if (!values.some(Boolean)) return null;
    return Math.round(values.reduce((a, b) => a + b, 0) / (PDEC.CRITERIA.length * 5) * 100);
}

// Similitud entre problemas: el modo «correlacionar» de la función.
async function findProblemSimilarity() {
    if (LOCAL_MODE) return showToast('Usa Gemini: necesita Supabase, no funciona en modo local', 'warning');
    const list = problemsIn('ordenar').filter(p => String(p.data.text || '').trim());
    if (list.length < 2) return showToast('Se necesitan al menos 2 problemas en Ordenar', 'warning');
    problemCorr = { running: true, started: Date.now(), groups: [] };
    const timer = setInterval(requestRender, 1000);
    render();
    try {
        const result = await supabaseFunction(TRIAGE.FUNCTION, {
            mode: 'correlacionar', etapa: 'problemas (todavía sin solución)',
            ideas: list.map(p => {
                const c = challengeById(p.data.desafio_id);
                return { id: shortId(p), campos: { Problema: p.data.text || '', 'Quién lo sufre': p.data.affected || '', 'Desafío': c ? c.data.title || '' : '' } };
            })
        }, false, 100000);
        problemCorr = { running: false, groups: (result.grupos || []).map(g => ({ ...g, done: false })), comentario: result.comentario || '', model: result.model || '' };
        showToast(problemCorr.groups.length ? `🔗 ${problemCorr.groups.length} grupo(s) de problemas parecidos` : '🔗 No hay problemas parecidos', problemCorr.groups.length ? 'success' : 'warning', 6000);
    } catch (e) {
        problemCorr = null;
        showToast(`❌ ${e.message}`, 'error', 9000);
    } finally {
        clearInterval(timer);
        render();
    }
}

async function mergeProblems(index) {
    const g = problemCorr && problemCorr.groups[index];
    if (!g) return;
    const sources = g.ids.map(problemById).filter(Boolean);
    const p = g.propuesta || {};
    const id = nextShortId(PRO_PREFIX, 'P');
    await saveItem(makeItem(`${PRO_PREFIX}${id}`, 'setting', {
        desafio_id: (sources[0] && sources[0].data.desafio_id) || '', desafio_manual: Boolean(sources[0] && sources[0].data.desafio_manual),
        text: p.problema || p.titulo || sources.map(x => x.data.text).join(' / '),
        affected: p.beneficiario || (sources[0] && sources[0].data.affected) || '',
        reach: '', evidence: '', approach: '', payer: '', out_of_scope: '', stage: 'ordenar', merged_from: g.ids
    }, nextPosition('setting')), { rerender: false });
    for (const x of sources) await setProblemStage(shortId(x), 'descartado', { discard_reason: `Fusionado en ${id}` });
    g.done = id;
    render();
    showToast(`✓ ${g.ids.join(' + ')} fusionados en ${id}`);
}

function problemCorrPanel() {
    if (problemTab !== 'ordenar' || !problemCorr) return '';
    if (problemCorr.running) return `<div class="corr-panel"><p class="form-hint">🔗 Gemini compara los problemas… ${shortDuration(Date.now() - problemCorr.started)}</p></div>`;
    return `
        <div class="corr-panel">
            <div class="corr-panel-head"><strong>Problemas parecidos</strong><span class="form-hint">${escapeHtml(problemCorr.comentario)} · ${escapeHtml(problemCorr.model)}</span></div>
            <div class="corr-grid">${problemCorr.groups.map((g, i) => `
                <article class="corr-card ${g.done ? 'done' : ''}">
                    <div class="corr-head">
                        <span class="chip corr-pct" style="--c:${g.similitud >= 70 ? 'var(--k-good)' : g.similitud >= 50 ? 'var(--k-s4)' : 'var(--k-neutral)'}">${Number(g.similitud) || 0}% similar</span>
                        <span class="corr-sources">${g.ids.map(id => `<span class="chip outline">${escapeHtml(id)}</span>`).join('<span class="form-hint">+</span>')}</span>
                    </div>
                    <p class="corr-relation">${escapeHtml(g.relacion || '')}</p>
                    ${g.fusionar ? `<div class="req ok"><strong>Conviene fusionar:</strong> ${escapeHtml(g.analisis || '')}</div>${g.propuesta && (g.propuesta.problema || g.propuesta.titulo) ? `<div class="corr-proposal"><strong>${escapeHtml(g.propuesta.problema || g.propuesta.titulo)}</strong></div>` : ''}`
                        : `<div class="req warn"><strong>No conviene fusionar:</strong> ${escapeHtml(g.analisis || '')}</div>`}
                    <div class="ai-actions">${g.done ? `<span class="form-hint">✓ Fusionados en ${escapeHtml(g.done)}</span>`
                        : g.fusionar ? `<button class="btn btn-accent" data-action="merge-problems" data-index="${i}">Fusionar</button><button class="btn btn-ghost" data-action="dismiss-corr" data-index="${i}">Ignorar</button>`
                        : `<button class="btn btn-ghost" data-action="dismiss-corr" data-index="${i}">Entendido</button>`}</div>
                </article>`).join('')}</div>
        </div>`;
}

// --- Ordenar: tarjetas compactas con el puntaje arriba, para ver todo de una vez ---

function problemMini(p) {
    const id = shortId(p);
    const v = priorityValue(p);
    const level = v ? PPRIO.LEVELS[v] : null;
    const prio = p.data.prio || {};
    const outdated = v && needsPriority(p);
    return `
        <article class="pmini" style="--stage:${level ? level.color : 'var(--border)'}" data-action="problem-open" data-id="${escapeHtml(id)}" tabindex="0" title="${escapeHtml(prio.motivo ? `🤖 ${prio.motivo}` : 'Clic para ver y editar')}">
            <div class="pmini-top">
                <span class="pmini-score" style="--c:${level ? level.color : 'var(--k-neutral)'}">${v ? `${v}<small>/5</small>` : '—'}</span>
                <span class="pmini-level">${level ? escapeHtml(level.label) : 'Sin puntaje'}${outdated ? ' ⟳' : ''}</span>
                <span class="card-id">${escapeHtml(id)}</span>
            </div>
            <p class="pmini-text">${escapeHtml(p.data.text || 'Sin texto')}</p>
            <p class="pmini-meta">${p.data.desafio_id ? `🎯 ${escapeHtml(p.data.desafio_id)}` : 'Sin desafío'}${p.data.affected ? ` · 👥 ${escapeHtml(p.data.affected)}` : ''}</p>
            <div class="pmini-actions">
                <button class="btn btn-ghost btn-xs" data-action="prioritize-one" data-id="${escapeHtml(id)}" ${LOCAL_MODE ? 'disabled' : ''} title="Priorizar con Gemini">🤖</button>
                <button class="btn btn-ghost btn-xs danger" data-action="discard-problem" data-id="${escapeHtml(id)}" title="Descartar">✕</button>
                <button class="btn btn-accent btn-xs" data-action="problem-stage" data-id="${escapeHtml(id)}" data-stage="benchmark">Benchmark →</button>
            </div>
        </article>`;
}

function problemGrid(list) {
    return `<div class="pgrid">${list.map(p => shortId(p) === problemOpen
        ? `<div class="pgrid-open">${problemCard(p)}<button class="btn btn-ghost" data-action="problem-open" data-id="">Cerrar ▲</button></div>`
        : problemMini(p)).join('')}</div>`;
}

// --- Tarjeta de un problema según su fase ---

function problemSummary(p) {
    const c = challengeById(p.data.desafio_id);
    return `<p class="problem-text">${escapeHtml(p.data.text || 'Sin texto')}</p>
        <p class="form-hint">${p.data.affected ? `👥 ${escapeHtml(p.data.affected)} · ` : ''}${c ? `🎯 ${escapeHtml(shortId(c))} ${escapeHtml(c.data.title || '')}` : 'Sin desafío'}</p>`;
}

function stageButtons(p, buttons) {
    return `<div class="ai-actions problem-move">${buttons.join('')}</div>`;
}

function moveButton(p, stage, label, primary = false, disabled = false) {
    return `<button class="btn ${primary ? 'btn-accent' : 'btn-ghost'}" data-action="problem-stage" data-id="${escapeHtml(shortId(p))}" data-stage="${stage}" ${disabled ? 'disabled' : ''}>${label}</button>`;
}

function problemCard(p) {
    const id = shortId(p);
    const kind = { kind: 'setting' };
    const stage = problemStage(p);
    const prio = p.data.prio;
    const total = problemTotal(p);
    let body = '';
    let moves = [];
    if (stage === 'lluvia') {
        body = `${inlineTextarea(p, 'text', { ...kind, rows: 2, cls: 'small', placeholder: 'El problema en una línea, sin solución. Ej.: la ropa usada termina en vertederos' })}
            <div class="form-group"><label class="form-label">Quién lo sufre</label>${inlineInput(p, 'affected', { ...kind, placeholder: 'Grupo concreto de personas u organizaciones' })}</div>
            ${p.data.cls ? `<p class="form-hint">🤖 ${escapeHtml(p.data.desafio_id || 'Sin desafío')} · calce ${escapeHtml(p.data.cls.calce || '—')}</p>` : ''}`;
        moves = [moveButton(p, 'ordenar', 'Ordenar →', true, !String(p.data.text || '').trim())];
    } else if (stage === 'ordenar') {
        body = `${inlineTextarea(p, 'text', { ...kind, rows: 2, cls: 'small' })}
            <div class="form-group"><label class="form-label">Quién lo sufre</label>${inlineInput(p, 'affected', kind)}</div>
            <div class="subgroup"><div class="subgroup-title">Desafío</div>${classHtml(p)}</div>
            <div class="subgroup"><div class="subgroup-title">Priorización ${priorityChip(p)}</div>
                ${prio ? `<p class="form-hint">🤖 ${escapeHtml(prio.motivo || '')}${prio.mejorar ? `<br><strong>Para subir:</strong> ${escapeHtml(prio.mejorar)}` : ''}${needsPriority(p) ? ' · ⟳ cambió: vuelve a priorizar' : ''}</p>` : '<p class="form-hint">Sin priorizar todavía.</p>'}
                <div class="ai-actions"><button class="btn btn-ghost" data-action="prioritize-one" data-id="${escapeHtml(id)}" ${LOCAL_MODE ? 'disabled' : ''}>🤖 ${prio ? 'Priorizar de nuevo' : 'Priorizar'}</button></div>
            </div>`;
        moves = [moveButton(p, 'lluvia', '← Lluvia'), `<button class="btn btn-ghost danger" data-action="discard-problem" data-id="${escapeHtml(id)}">Descartar</button>`, moveButton(p, 'benchmark', 'Benchmark →', true)];
    } else if (stage === 'benchmark') {
        body = `${problemSummary(p)}
            <div class="subgroup"><div class="subgroup-title">Delimitación</div>
                <div class="row-2">
                    <div class="form-group"><label class="form-label">Alcance: a cuántos y dónde</label>${inlineInput(p, 'reach', { ...kind, placeholder: '12.000 hogares en Maipú (INE 2024)' })}</div>
                    <div class="form-group"><label class="form-label">Quién pagaría</label>${inlineInput(p, 'payer', { ...kind, placeholder: 'Municipio, empresa, usuario, fondo…' })}</div>
                </div>
                <div class="form-group"><label class="form-label">Qué abordaremos</label>${inlineTextarea(p, 'approach', { ...kind, rows: 2, cls: 'small', placeholder: 'Qué parte del problema atacamos (una causa, una etapa o un grupo) y por qué' })}</div>
                <div class="row-2">
                    <div class="form-group"><label class="form-label">Qué queda fuera</label>${inlineInput(p, 'out_of_scope', { ...kind, placeholder: 'Lo que no vamos a resolver' })}</div>
                    <div class="form-group"><label class="form-label">Dato o evidencia</label>${inlineInput(p, 'evidence', { ...kind, placeholder: 'Cifra, estudio u observación' })}</div>
                </div>
            </div>
            <div class="subgroup"><div class="subgroup-title">Benchmark del problema</div>${benchHtml(p)}</div>`;
        moves = [moveButton(p, 'ordenar', '← Ordenar'), moveButton(p, 'decision', 'Decisión →', true, !p.data.bench)];
    } else if (stage === 'decision') {
        const dec = p.data.pdec;
        body = `${problemSummary(p)}
            <details class="fold"><summary class="section-title">🔎 Matriz del benchmark</summary><div class="section">${benchHtml(p)}</div></details>
            <div class="subgroup"><div class="subgroup-title">Decisión ${total !== null ? `<span class="score-big">★ ${total}/100</span>` : ''}</div>
                ${dec ? `<div class="bench-matrix">${PDEC.CRITERIA.map(c => `<div class="bench-row"><span class="bench-key">${escapeHtml(c.label)} · ${escapeHtml(dec[`p_${c.id}`] || '—')}/5</span><span>${escapeHtml(dec[`m_${c.id}`] || '')}</span></div>`).join('')}
                    <p class="form-hint">🤖 ${escapeHtml(dec.recomendacion || '')} · ${escapeHtml(dec.model || '')} ${escapeHtml(clockTime(dec.at))}${needsProblemDecision(p) ? ' · ⟳ cambió: vuelve a puntuar' : ''}</p></div>` : '<p class="form-hint">Sin puntaje todavía.</p>'}
                <div class="ai-actions"><button class="btn btn-ghost" data-action="decide-problem" data-id="${escapeHtml(id)}" ${LOCAL_MODE ? 'disabled' : ''}>🤖 ${dec ? 'Puntuar de nuevo' : 'Puntuar'}</button></div>
            </div>`;
        moves = [moveButton(p, 'benchmark', '← Benchmark'), `<button class="btn btn-ghost danger" data-action="discard-problem" data-id="${escapeHtml(id)}">Descartar</button>`, moveButton(p, 'elegido', 'Elegir ✓', true)];
    } else if (stage === 'elegido') {
        const linked = ideas().filter(i => i.data.problem_id === id && i.data.status !== 'descartada').length;
        body = `${problemSummary(p)}
            ${total !== null ? `<p class="form-hint">Decisión: ★ ${total}/100</p>` : ''}
            <details class="fold"><summary class="section-title">🔎 Matriz del benchmark</summary><div class="section">${benchHtml(p)}</div></details>
            ${p.data.hmw ? `<div class="bench-matrix">${['hmw1', 'hmw2', 'hmw3'].filter(k => p.data.hmw[k]).map(k => `<div class="hmw">💡 ${escapeHtml(p.data.hmw[k])}</div>`).join('')}</div>`
                : '<p class="form-hint">Generen las preguntas «¿Cómo podríamos…?» para enfocar la lluvia de soluciones.</p>'}
            <div class="ai-actions">
                <button class="btn btn-ghost" data-action="hmw-one" data-id="${escapeHtml(id)}" ${LOCAL_MODE ? 'disabled' : ''}>🤖 ${p.data.hmw ? 'Otras preguntas' : 'Preguntas «¿Cómo podríamos…?»'}</button>
                <button class="btn btn-accent" data-action="idea-for-problem" data-id="${escapeHtml(id)}"><svg><use href="#i-plus"/></svg>Idea de solución${linked ? ` (${linked} en curso)` : ''}</button>
            </div>`;
        moves = [moveButton(p, 'decision', '← Decisión')];
    } else {
        body = `${problemSummary(p)}<div class="req warn">Descartado: ${escapeHtml(p.data.discard_reason || 'sin motivo')}</div>`;
        moves = [moveButton(p, 'ordenar', 'Restaurar a Ordenar')];
    }
    return `
        <div class="vsrc problem">
            <div class="vsrc-head">
                <span class="vsrc-num">${escapeHtml(id)}</span>
                <span class="step-track">${stage === 'ordenar' || stage === 'benchmark' ? priorityChip(p) : ''}${total !== null && stage !== 'decision' ? `<span class="chip outline">★ ${total}/100</span>` : ''}</span>
                <button class="row-remove" data-action="delete-problem" data-id="${escapeHtml(id)}" aria-label="Eliminar">×</button>
            </div>
            ${body}
            ${stageButtons(p, moves)}
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
                ${step(2, '2 · Problemas', ['Lluvia: cada uno anota problemas, sin solución; 🤖 se asignan solos a un desafío.', 'Ordenar: 🔗 similitud y 🤖 priorización 1–5; pasan los que el equipo quiera.', 'Benchmark: delimitación, prompt → IA investigadora → informe → 🤖 matriz.', 'Decisión: 🤖 puntaje con el benchmark → el equipo elige.', 'Elegidos: 🤖 «¿Cómo podríamos…?» → ideas de solución.'])}
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

function problemBar() {
    const list = problemsIn(problemTab);
    if (problemTab === 'lluvia') {
        const ready = list.filter(p => String(p.data.text || '').trim()).length;
        const pendingClass = list.filter(needsClass).length;
        return `<div class="ai-bar"><div class="ai-bar-text"><strong>Lluvia de problemas</strong>
            <span class="form-hint">Anoten todo, sin evaluar. Al salir del texto, Gemini asigna el desafío. Al terminar, mándenlos a Ordenar.</span></div>
            <div class="ai-actions">
                ${pendingClass && challenges().length ? `<button class="btn btn-ghost" data-action="classify-all" ${LOCAL_MODE || aiBatch ? 'disabled' : ''}>🤖 ${escapeHtml(batchLabel('Clasificar', pendingClass))}</button>` : ''}
                <button class="btn btn-accent" data-action="send-problems" ${ready ? '' : 'disabled'}>Mandar ${ready} a Ordenar →</button>
            </div></div>`;
    }
    if (problemTab === 'ordenar') {
        const pending = list.filter(needsPriority).length;
        const good = list.filter(p => priorityValue(p) >= 4).length;
        return `<div class="ai-bar"><div class="ai-bar-text"><strong>Ordenar: 🔗 similitud → 🤖 priorización → ustedes eligen</strong>
            <span class="pmini-tally">${[5, 4, 3].map(n => `<span class="chip" style="--c:${PPRIO.LEVELS[n].color}">${n} ${escapeHtml(PPRIO.LEVELS[n].label)}: ${list.filter(p => priorityValue(p) === n).length}</span>`).join('')}<span class="chip" style="--c:var(--k-bad)">≤2 No: ${list.filter(p => priorityValue(p) && priorityValue(p) <= 2).length}</span><span class="chip outline">Sin puntaje: ${list.filter(p => !priorityValue(p)).length}</span></span>
            <span class="form-hint">Clic en una tarjeta para verla y editarla. Pasen al Benchmark los que quieran (no hay máximo).</span></div>
            <div class="ai-actions">
                <button class="btn btn-ghost" data-action="problem-similarity" ${LOCAL_MODE || (problemCorr && problemCorr.running) || list.length < 2 ? 'disabled' : ''}>🔗 Similitud (${list.length})</button>
                <button class="btn btn-ghost" data-action="prioritize-all" ${LOCAL_MODE || aiBatch || !pending ? 'disabled' : ''}>🤖 ${escapeHtml(batchLabel('Priorizar', pending))}</button>
                ${good ? `<button class="btn btn-accent" data-action="promote-good">Pasar ${good} «Sí/Probable» al Benchmark →</button>` : ''}
            </div></div>`;
    }
    if (problemTab === 'benchmark') {
        return `<div class="ai-bar"><div class="ai-bar-text"><strong>Benchmark de los problemas</strong>
            <span class="form-hint">En cada uno: delimitación → copiar prompt → IA investigadora → pegar informe → 🤖 matriz. Listos: ${list.filter(p => p.data.bench).length} de ${list.length}.</span></div></div>`;
    }
    if (problemTab === 'decision') {
        const pending = list.filter(needsProblemDecision).length;
        const top = list.filter(p => problemTotal(p) !== null).sort((a, b) => problemTotal(b) - problemTotal(a))[0];
        return `<div class="ai-bar"><div class="ai-bar-text"><strong>Decisión: ¿cuál problema resolvemos?</strong>
            <span class="form-hint">${top ? `Va primero ${escapeHtml(shortId(top))} (★ ${problemTotal(top)}/100). ` : ''}🤖 Puntaje con el benchmark; el equipo elige uno o más con «Elegir ✓».</span></div>
            <div class="ai-actions"><button class="btn btn-accent" data-action="decide-problems" ${LOCAL_MODE || aiBatch || !pending ? 'disabled' : ''}>🤖 ${escapeHtml(batchLabel('Puntuar', pending))}</button></div></div>`;
    }
    if (problemTab === 'elegido') {
        return `<div class="ai-bar"><div class="ai-bar-text"><strong>Problemas elegidos</strong>
            <span class="form-hint">Generen las preguntas «¿Cómo podríamos…?» y creen ideas de solución: van a la pestaña 3 · Soluciones.</span></div></div>`;
    }
    return '';
}

function renderProblemas() {
    const all = problems();
    const list = problemsIn(problemTab);
    if (problemTab === 'ordenar') list.sort((a, b) => priorityValue(b) - priorityValue(a));
    if (problemTab === 'decision' || problemTab === 'elegido') list.sort((a, b) => (problemTotal(b) ?? -1) - (problemTotal(a) ?? -1));
    const current = findOption([...PSTAGES, PDISCARDED], problemTab);
    const discarded = problemsIn('descartado').length;
    return `
        <div class="page-head">
            <div>
                <h1>2 · Problemas</h1>
                <p>Igual que Soluciones, en fases: lluvia → ordenar → benchmark → decisión → elegidos.</p>
            </div>
            <div class="page-head-actions">
                ${howToButton()}
                <button class="btn btn-accent" data-action="add-problem"><svg><use href="#i-plus"/></svg>Problema</button>
            </div>
        </div>
        ${howToPanel()}
        ${!challenges().length ? '<div class="req warn">Primero carguen los desafíos en la pestaña 1 · Desafíos: Gemini los usa para clasificar.</div>' : ''}
        <nav class="pipeline" aria-label="Fases de los problemas">
            ${PSTAGES.map((s, i) => `
                <button class="stage ${s.id === problemTab ? 'active' : ''}" data-action="problem-tab" data-stage="${s.id}" style="--stage:${s.color}" aria-pressed="${s.id === problemTab}">
                    <div class="stage-step"><span class="stage-dot"></span>Fase ${i + 1}</div>
                    <div class="stage-label">${s.label}</div>
                    <div class="stage-count">${problemsIn(s.id).length}</div>
                </button>`).join('')}
        </nav>
        <div class="board-bar">
            <p class="stage-hint"><strong>${escapeHtml(current.label)}:</strong> ${escapeHtml(current.hint)}</p>
            <button class="discard-tab ${problemTab === 'descartado' ? 'active' : ''}" data-action="problem-tab" data-stage="descartado">Descartados (${discarded})</button>
        </div>
        ${problemBar()}
        ${problemCorrPanel()}
        ${list.length ? (problemTab === 'ordenar' ? problemGrid(list) : `<div class="rows">${list.map(problemCard).join('')}</div>`) : `
            <div class="empty">
                <div class="empty-icon">💡</div>
                <strong>${all.length ? 'No hay problemas en esta fase' : 'Todavía no hay problemas'}</strong>
                ${problemTab === 'lluvia' ? 'Agreguen uno con «+ Problema».' : ''}
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
        problemTab = 'lluvia';
        saveItem(makeItem(`${PRO_PREFIX}${id}`, 'setting', { desafio_id: '', text: '', affected: '', reach: '', evidence: '', approach: '', payer: '', out_of_scope: '', stage: 'lluvia' }, nextPosition('setting')));
    },
    'problem-open': (el) => {
        problemOpen = problemOpen === el.dataset.id ? '' : el.dataset.id;
        render();
    },
    'problem-tab': (el) => {
        problemTab = el.dataset.stage;
        problemOpen = '';
        render();
    },
    'problem-stage': async (el) => {
        await setProblemStage(el.dataset.id, el.dataset.stage);
        render();
        showToast(`✓ ${el.dataset.id} → ${findOption(PSTAGES, el.dataset.stage).label}`);
    },
    'discard-problem': async (el) => {
        const reason = prompt(`Motivo para descartar ${el.dataset.id}:`, 'No es prioritario');
        if (reason === null) return;
        await setProblemStage(el.dataset.id, 'descartado', { discard_reason: reason });
        render();
    },
    'send-problems': async () => {
        const list = problemsIn('lluvia').filter(p => String(p.data.text || '').trim());
        for (const p of list) await setProblemStage(shortId(p), 'ordenar');
        problemTab = 'ordenar';
        render();
        showToast(`✓ ${list.length} problema(s) a Ordenar`);
    },
    'promote-good': async () => {
        const list = problemsIn('ordenar').filter(p => priorityValue(p) >= 4);
        if (!confirm(`¿Pasar al Benchmark: ${list.map(shortId).join(', ')}?`)) return;
        for (const p of list) await setProblemStage(shortId(p), 'benchmark');
        problemTab = 'benchmark';
        render();
    },
    'prioritize-one': (el) => runOne(prioritizeProblem, problemById(el.dataset.id), `${el.dataset.id} priorizado`),
    'prioritize-all': () => runAiBatch('Priorizar', problemsIn('ordenar').filter(needsPriority), prioritizeProblem),
    'problem-similarity': () => findProblemSimilarity(),
    'merge-problems': (el) => mergeProblems(Number(el.dataset.index)),
    'dismiss-corr': (el) => {
        problemCorr.groups.splice(Number(el.dataset.index), 1);
        render();
    },
    'decide-problem': (el) => runOne(decideProblem, problemById(el.dataset.id), `Puntaje de ${el.dataset.id} listo`),
    'decide-problems': () => runAiBatch('Puntuar', problemsIn('decision').filter(needsProblemDecision), decideProblem),
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
