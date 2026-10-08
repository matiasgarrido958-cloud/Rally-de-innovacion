// Banco de ideas → Filtro rápido → Ficha → Validación → Elegida (secciones 3 y 5).
// Igual que el flujo de Fast Check: cada idea avanza de a una etapa cumpliendo
// requisitos; retroceder siempre se puede; descartar guarda el motivo.

const IDEA_STAGES = [
    { id: 'banco', label: 'Banco de ideas', color: 'var(--k-s1)', hint: 'Cada idea nueva entra con un ID: una línea, tema y beneficiario directo.' },
    { id: 'filtro', label: 'Filtro rápido', color: 'var(--k-s2)', hint: 'Cuatro preguntas. Si falla alguna, la idea se descarta.' },
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
        filter: {}, validations: [], scores: {}, discard_reason: '', discarded_from: '' };
    FICHA_FLAT.forEach(f => { data[f.id] = ''; });
    return data;
}

function ideaData(item) {
    const data = { ...blankIdeaData(), ...item.data };
    if (!Array.isArray(data.validations)) data.validations = [];
    if (typeof data.filter !== 'object' || !data.filter) data.filter = {};
    if (typeof data.scores !== 'object' || !data.scores) data.scores = {};
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

function ideaRequirements(data, target) {
    const missing = [];
    const empty = v => !String(v || '').trim();
    switch (target) {
        case 'filtro':
            if (empty(data.title)) missing.push('Escribe la idea en una línea.');
            if (!data.theme) missing.push('Elige el tema.');
            if (empty(data.beneficiary)) missing.push('Indica el beneficiario directo.');
            break;
        case 'ficha': {
            const unanswered = L.QUICK_FILTER.filter(q => !data.filter[q.id]).length;
            if (unanswered) missing.push(`Responde el filtro rápido (faltan ${unanswered}).`);
            const failed = filterFailures(data);
            if (failed.length) missing.push(`Falla el filtro (${failed.length}): descártala con el motivo correspondiente.`);
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
    if (stage >= 2 && !String(data.k_fuentes || '').trim()) warnings.push('Sin fuentes APA todavía (k): el reporte las exige, incluidas las de IA.');
    if (stage >= 2 && !String(data.i_riesgos || '').trim()) warnings.push('Sin riesgos ni supuestos anotados (i).');
    const otherChosen = ideas().filter(i => i.id !== item.id && i.data.status === 'elegida');
    if (otherChosen.length && stage >= 3) warnings.push(`Ya hay otra idea elegida: ${otherChosen.map(i => i.id).join(', ')}.`);
    return warnings;
}

// --- Tablero ---

function ideaCard(item) {
    const data = ideaData(item);
    const stage = findOption(IDEA_ALL, data.status);
    const theme = findOption(L.THEMES, data.theme);
    const score = ideaScore(data);
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

function fold(title, open, body, done = false) {
    return `<details class="fold" ${open ? 'open' : ''}><summary class="section-title">${escapeHtml(title)}${done ? ' <span class="fold-done">✓</span>' : ''}</summary><div class="section">${body}</div></details>`;
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
    `, ideaRequirements(d, 'filtro').length === 0);
}

function sectionFilter(d, open) {
    const yesNo = [{ id: 'si', label: 'Sí', color: 'var(--k-good)' }, { id: 'no', label: 'No', color: 'var(--k-bad)' }];
    return fold('2 · Filtro rápido', open, `
        <p class="form-hint">Descartar si falla alguno.</p>
        ${L.QUICK_FILTER.map(q => `
            <div class="filter-row">
                <span>${escapeHtml(q.label)}</span>
                ${pills(`filter.${q.id}`, yesNo, d.filter[q.id])}
            </div>`).join('')}
    `, ideaRequirements(d, 'ficha').length === 0);
}

function sectionFicha(d, open) {
    const render = f => field(f.id, f.label, d[f.id], { textarea: !f.input, rows: f.rows || 2, required: f.required, hint: f.hint || '' });
    return fold('3 · Ficha de idea', open, FICHA_FIELDS.map(f => f.group
        ? `<div class="subgroup"><div class="subgroup-title">${escapeHtml(f.group)}</div>${f.fields.some(x => x.input) ? `<div class="row-2">${f.fields.filter(x => x.input).map(render).join('')}</div>` : ''}${f.fields.filter(x => !x.input).map(render).join('')}</div>`
        : render(f)).join(''), ideaRequirements(d, 'validacion').length === 0);
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
    return fold('4 · Validación y puntaje', open, `
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
    `, ideaRequirements(d, 'elegida').length === 0);
}

function renderModalBody() {
    const d = draft;
    const stage = Math.max(0, ideaStageIndex(d.status));
    const discarded = d.status === 'descartada';
    const reached = discarded ? Math.max(0, ideaStageIndex(d.discarded_from)) : stage;
    const sections = [sectionIdea, sectionFilter, sectionFicha, sectionValidation];
    const openIndex = Math.min(reached, sections.length - 1);
    const body = document.getElementById('modalBody');
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
        ${sections.slice(0, reached + 1).map((fn, i) => fn(d, i === openIndex)).join('')}`;
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
            if (failed) document.getElementById('discardChoice').selectedIndex = map[failed.id];
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
        setPath(draft, el.dataset.draft, el.value);
        hasUnsavedChanges = true;
        if (el.dataset.draft === 'title' || el.dataset.draft === 'name') renderModalHeader();
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
        }
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
