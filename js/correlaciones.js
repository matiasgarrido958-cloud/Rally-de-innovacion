// Correlaciones entre ideas: justo después de la lluvia de ideas (Banco y Filtro) y en Ficha.
// Cada grupo trae su % de similitud y si conviene fusionar (se complementan) o no.
// «Buscar correlaciones» manda a Gemini las ideas de la etapa abierta; «Correlacionar
// selección» solo las marcadas. Gemini propone grupos de ideas relacionadas con una
// idea combinada; el equipo decide cuáles crear. El bloque nuevo entra en la etapa
// donde se apretó el botón, junta el contenido de las originales y guarda de dónde
// salió (data.combined). Las ideas originales no se modifican.
// Usa la misma Edge Function del filtro con mode: 'correlacionar'.

const CORRELATION_STAGES = ['banco', 'filtro', 'ficha'];
const CORRELATION_TIMEOUT_MS = 100000;
const RELATION_LABELS = {
    duplicada: 'Duplicadas', complementaria: 'Complementarias', mismo_problema: 'Mismo problema',
    mismo_beneficiario: 'Mismo beneficiario', otra: 'Relacionadas'
};
// Resultado de la última búsqueda (solo en este navegador, hasta recargar):
// { stage, selection, running, groups: [{ ids, tipo, relacion, propuesta, created }], comentario, model, at }.
let correlation = null;

function clipText(value, max) {
    const text = String(value || '').trim();
    return text.length > max ? `${text.slice(0, max)}…` : text;
}

// Lo que recibe Gemini de cada idea, según la etapa.
function correlationFields(item) {
    const d = ideaData(item);
    const ctx = ideaContext(d);
    const fields = {
        'Idea': d.title, 'Nombre': d.name, 'Desafío': ctx.desafio, 'Problema': ctx.problema,
        'A cuántos impacta': d.b_alcance, 'Abordaje': d.b_abordaje, 'Beneficiario': d.beneficiary,
        'Tema': d.theme ? findOption(L.THEMES, d.theme).label : '',
        'Tipo': d.offering ? findOption(L.OFFERING_TYPES, d.offering).label : '', 'Notas': d.notes
    };
    if (d.status === 'benchmark' || d.status === 'ficha') {
        fields['Diferenciación (benchmark)'] = d.benchmark.differentiation;
        fields['Referentes'] = d.benchmark.refs.map(r => r.name).filter(Boolean).join(', ');
    }
    if (d.status === 'ficha') {
        fields['Solución'] = d.d_solucion;
        fields['Componente innovador'] = d.e_innovacion;
        fields['Quién paga'] = d.f_quien_paga;
    }
    Object.keys(fields).forEach(k => {
        fields[k] = clipText(fields[k], 500);
        if (!fields[k]) delete fields[k];
    });
    return { id: item.id, campos: fields };
}

async function findCorrelations(selection) {
    if (correlation && correlation.running) return;
    if (LOCAL_MODE) return showToast('Las correlaciones usan Gemini: necesitan Supabase, no funcionan en modo local', 'warning');
    const stage = ideaTab;
    const list = selection ? selectedInStage() : ideas().filter(i => i.data.status === stage);
    if (list.length < 2) return showToast(selection ? `Marca al menos 2 ideas de ${findOption(IDEA_STAGES, stage).label}` : 'Se necesitan al menos 2 ideas en esta etapa', 'warning');
    correlation = { stage, selection, running: true, total: list.length, started: Date.now(), groups: [] };
    const timer = setInterval(requestRender, 1000);
    render();
    try {
        // Un solo intento con espera larga: la función ya prueba varios modelos.
        const result = await supabaseFunction(TRIAGE.FUNCTION, {
            mode: 'correlacionar',
            etapa: findOption(IDEA_STAGES, stage).label,
            seleccion: selection,
            ideas: list.map(correlationFields)
        }, false, CORRELATION_TIMEOUT_MS);
        correlation = {
            stage, selection, running: false, total: list.length,
            groups: (result.grupos || []).map(g => ({ ...g, created: null })),
            comentario: result.comentario || '', model: result.model || '', at: new Date().toISOString()
        };
        const n = correlation.groups.length;
        showToast(n ? `🔗 ${n} correlación(es) encontradas: revísalas y crea las que sirvan` : '🔗 Gemini no encontró correlaciones claras', n ? 'success' : 'warning', 6000);
    } catch (e) {
        correlation = null;
        // La función desplegada es anterior a las correlaciones: no conoce el modo y
        // responde como si fuera el filtro sin preguntas.
        const outdated = /Faltan la idea o las preguntas/.test(e.message);
        showToast(outdated
            ? '❌ La función de Gemini en Supabase es la versión anterior y no sabe correlacionar. Pega de nuevo supabase/functions/filtrar-idea/index.ts en Supabase (Edge Functions) y despliega.'
            : `❌ ${e.message}`, 'error', outdated ? 15000 : 8000);
    } finally {
        clearInterval(timer);
        requestRender();
    }
}

// --- Bloque combinado ---

// Valor común de todas las fuentes que lo tienen; si discrepan, vacío.
function agreed(values) {
    const set = [...new Set(values.filter(v => v !== undefined && v !== null && v !== ''))];
    return set.length === 1 ? set[0] : '';
}

// Junta un texto de varias ideas: si es igual en todas, una vez; si no, con su id.
function joinTexts(sources, getter) {
    const parts = sources.map(s => [s.id, String(getter(s.data) || '').trim()]).filter(([, t]) => t);
    const unique = [...new Set(parts.map(([, t]) => t))];
    if (unique.length <= 1) return unique[0] || '';
    return parts.map(([id, t]) => `${id}: ${t}`).join('\n');
}

function combinedOffering(values) {
    const set = new Set(values.filter(Boolean));
    if (set.size <= 1) return [...set][0] || '';
    return set.has('mixto') || (set.has('producto') && set.has('servicio')) ? 'mixto' : [...set][0];
}

function buildCombinedIdea(group, stage) {
    const sources = group.ids.map(id => getItem(id)).filter(Boolean).map(i => ({ id: i.id, data: ideaData(i) }));
    const p = group.propuesta;
    const d = blankIdeaData();
    const ids = sources.map(s => s.id);
    d.status = stage;
    d.title = p.titulo;
    d.name = p.nombre || '';
    d.beneficiary = p.beneficiario || agreed(sources.map(s => s.data.beneficiary));
    d.owner = agreed(sources.map(s => s.data.owner));
    d.theme = agreed(sources.map(s => s.data.theme)) || (sources[0] ? sources[0].data.theme : '');
    d.offering = combinedOffering(sources.map(s => s.data.offering));
    // Mismo problema en todas: se mantiene el vínculo; si no, queda el problema propuesto.
    const problemId = agreed(sources.map(s => s.data.problem_id || '-'));
    if (problemId && problemId !== '-') {
        d.problem_id = problemId;
        applyProblemLink(d);
    } else {
        d.problem_id = '';
        d.a_desafio = joinTexts(sources, x => ideaContext(x).desafio);
        d.b_problema = p.problema || joinTexts(sources, x => ideaContext(x).problema);
    }
    // Campos de la ficha: lo que tengan las originales, con su id si discrepan.
    FICHA_FLAT.forEach(f => {
        if (['a_desafio', 'b_problema'].includes(f.id) && d[f.id]) return;
        d[f.id] = joinTexts(sources, x => x[f.id]);
    });
    if (stage === 'ficha' || !d.d_solucion) d.d_solucion = [p.descripcion, d.d_solucion].filter(Boolean).join('\n\n');
    // Filtro y semáforo: solo las respuestas en que todas coinciden; el resto lo responde el equipo.
    L.QUICK_FILTER.forEach(q => { const v = agreed(sources.map(s => s.data.filter[q.id])); if (v) d.filter[q.id] = v; });
    L.FEASIBILITY.forEach(q => { const v = agreed(sources.map(s => s.data.feasibility[q.id])); if (v) d.feasibility[q.id] = v; });
    // Benchmark: todos los referentes (sin repetir); la decisión la toma el equipo.
    const seen = new Set();
    d.benchmark.refs = sources.flatMap(s => s.data.benchmark.refs).filter(r => {
        const key = String(r.name || '').trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    }).map(r => ({ ...r }));
    d.benchmark.trend = agreed(sources.map(s => s.data.benchmark.trend));
    d.benchmark.differentiation = joinTexts(sources, x => x.benchmark.differentiation);
    d.benchmark.notes = joinTexts(sources, x => x.benchmark.notes);
    d.validations = sources.flatMap(s => s.data.validations.map(v => ({ ...v, who: `${v.who || ''} (de ${s.id})`.trim() })));
    d.notes = [
        `🔗 Combinada de ${ids.join(' + ')}: ${group.relacion}`,
        p.por_que ? `Por qué juntas: ${p.por_que}` : '',
        p.descripcion && stage !== 'ficha' ? `Propuesta: ${p.descripcion}` : '',
        joinTexts(sources, x => x.notes)
    ].filter(Boolean).join('\n');
    d.combined = { from: ids, tipo: group.tipo, relacion: group.relacion, model: correlation.model, at: new Date().toISOString() };
    return d;
}

async function createCombined(index) {
    const group = correlation && correlation.groups[index];
    if (!group || group.created) return;
    const id = nextIdeaId();
    const data = buildCombinedIdea(group, correlation.stage);
    const ok = await saveItem(makeItem(id, 'idea', data, nextPosition('idea')), { rerender: false });
    if (!ok) return;
    group.created = id;
    render();
    showToast(`✓ ${id} creada en ${findOption(IDEA_STAGES, data.status).label}; ${group.ids.join(', ')} siguen igual`);
}

function dismissCorrelation(index) {
    if (!correlation) return;
    correlation.groups.splice(index, 1);
    render();
}

// --- Vista ---

// Las marcadas que están en la etapa abierta (la selección puede tener de otras etapas).
function selectedInStage() {
    return ideaSelection ? [...ideaSelection].map(getItem).filter(i => i && i.data.status === ideaTab) : [];
}

function correlationButtons(selectionOnly = false) {
    if (!CORRELATION_STAGES.includes(ideaTab)) return '';
    const running = correlation && correlation.running;
    if (selectionOnly) {
        const n = selectedInStage().length;
        return `<button class="btn btn-ghost" data-action="correlate-selected" ${LOCAL_MODE || running || n < 2 ? 'disabled' : ''} title="Gemini busca la relación entre las ideas marcadas y propone un bloque combinado">🔗 Correlacionar ${n}</button>`;
    }
    const n = ideas().filter(i => i.data.status === ideaTab).length;
    return `<button class="btn btn-ghost" data-action="correlate-all" ${LOCAL_MODE || running || n < 2 ? 'disabled' : ''} title="Gemini busca ideas relacionadas en esta etapa y propone bloques combinados">🔗 Buscar correlaciones (${n})</button>`;
}

function correlationBar() {
    if (!CORRELATION_STAGES.includes(ideaTab) || ideaSelection) return '';
    return `
        <div class="ai-bar">
            <div class="ai-bar-text">
                <strong>Correlaciones entre ideas</strong>
                <span class="form-hint">${LOCAL_MODE ? 'Usan Gemini: en modo local no están disponibles.' : 'Gemini busca ideas de esta etapa que se repiten o se complementan y propone un bloque combinado. Ustedes deciden cuáles crear; las ideas originales no se tocan. Para elegir ideas a mano, use «☑ Seleccionar».'}</span>
            </div>
            <div class="ai-actions">${correlationButtons()}</div>
        </div>`;
}

function correlationGroupCard(g, index) {
    const p = g.propuesta;
    const sources = g.ids.map(id => {
        const item = getItem(id);
        const title = item ? (item.data.name || item.data.title || id) : `${id} (ya no existe)`;
        return `<button class="chip outline link-chip" data-action="open-idea" data-id="${escapeHtml(id)}" title="${escapeHtml(title)}">${escapeHtml(id)}</button>`;
    }).join('<span class="form-hint">+</span>');
    return `
        <article class="corr-card ${g.created ? 'done' : ''}">
            <div class="corr-head">
                ${typeof g.similitud === 'number' ? `<span class="chip corr-pct" style="--c:${g.similitud >= 70 ? 'var(--k-good)' : g.similitud >= 50 ? 'var(--k-s4)' : 'var(--k-neutral)'}" title="Similitud según Gemini">${g.similitud}% similar</span>` : ''}
                <span class="chip" style="--c:var(--k-t3)">${escapeHtml(RELATION_LABELS[g.tipo] || 'Relacionadas')}</span>
                <span class="corr-sources">${sources}</span>
            </div>
            <p class="corr-relation">${escapeHtml(g.relacion)}</p>
            ${g.fusionar === false ? `<div class="req warn"><strong>No conviene fusionar:</strong> ${escapeHtml(g.analisis || 'se parecen pero no se complementan.')}</div>`
                : g.analisis ? `<div class="req ok"><strong>Se complementan:</strong> ${escapeHtml(g.analisis)}</div>` : ''}
            ${g.fusionar === false ? '' : `<div class="corr-proposal">
                <strong>${escapeHtml(p.nombre ? `${p.nombre}: ` : '')}${escapeHtml(p.titulo)}</strong>
                ${p.problema ? `<span class="form-hint"><strong>Problema:</strong> ${escapeHtml(p.problema)}</span>` : ''}
                ${p.beneficiario ? `<span class="form-hint"><strong>Beneficiario:</strong> ${escapeHtml(p.beneficiario)}</span>` : ''}
                ${p.descripcion ? `<span class="form-hint">${escapeHtml(p.descripcion)}</span>` : ''}
                ${p.por_que ? `<span class="form-hint"><strong>Por qué juntas:</strong> ${escapeHtml(p.por_que)}</span>` : ''}
            </div>`}
            <div class="ai-actions">
                ${g.fusionar === false ? `<button class="btn btn-ghost" data-action="corr-dismiss" data-index="${index}">Entendido</button>` : g.created
                    ? `<button class="btn btn-ghost" data-action="open-idea" data-id="${escapeHtml(g.created)}">✓ Creada como ${escapeHtml(g.created)} · abrir</button>`
                    : `<button class="btn btn-accent" data-action="corr-create" data-index="${index}">Crear bloque combinado</button>
                       <button class="btn btn-ghost" data-action="corr-dismiss" data-index="${index}">Ignorar</button>`}
            </div>
        </article>`;
}

function correlationPanel() {
    if (!correlation || correlation.stage !== ideaTab) return '';
    if (correlation.running) {
        const elapsed = shortDuration(Date.now() - correlation.started);
        return `<div class="corr-panel"><p class="form-hint">🔗 Gemini está buscando correlaciones entre ${correlation.total} idea(s)… ${elapsed}</p></div>`;
    }
    const groups = correlation.groups;
    return `
        <section class="corr-panel">
            <div class="corr-panel-head">
                <strong>🔗 ${groups.length ? `${groups.length} correlación(es)` : 'Sin correlaciones claras'} ${correlation.selection ? 'en la selección' : 'en esta etapa'}</strong>
                <span class="form-hint">${escapeHtml(correlation.comentario)} · ${escapeHtml(clockTime(correlation.at))} · ${escapeHtml(correlation.model)}</span>
                <button class="row-remove" data-action="corr-close" aria-label="Cerrar">×</button>
            </div>
            ${groups.length ? `<div class="corr-grid">${groups.map(correlationGroupCard).join('')}</div>` : ''}
        </section>`;
}

// Chip en la tarjeta y aviso en la ventana de un bloque combinado.
function combinedChip(data) {
    if (!data.combined) return '';
    return `<span class="chip outline" title="${escapeHtml(`Combinada (${RELATION_LABELS[data.combined.tipo] || 'relacionadas'}): ${data.combined.relacion}`)}">🔗 ${escapeHtml(data.combined.from.join('+'))}</span>`;
}

function combinedNotice(data) {
    if (!data.combined) return '';
    const c = data.combined;
    return `<div class="req">🔗 <strong>Bloque combinado</strong> de ${escapeHtml(c.from.join(' + '))} (${escapeHtml(RELATION_LABELS[c.tipo] || 'relacionadas')}): ${escapeHtml(c.relacion)}
        Revisen y editen todo: donde las originales decían cosas distintas, el campo trae cada versión con su id. Las originales siguen igual.</div>`;
}
