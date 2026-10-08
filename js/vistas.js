// Vistas del workspace (salvo Ideas, en js/ideas.js). Cada una corresponde a
// una sección del documento de trabajo del Rally.

// --- Inicio: cuenta regresiva, etapa actual, resumen y ajustes ---

function currentStage(h) {
    return L.STAGES_28H.filter(s => !s.parallel).find(s => h >= s.from && h < s.to) || null;
}

function countdownHtml() {
    const h = currentH();
    const close = hourToDate(L.DURATION_H);
    if (h < 0) {
        return `<div class="hero-kicker">Faltan para la apertura (H0 · ${escapeHtml(formatChile(h0Date()))})</div>
            <div class="hero-big">${escapeHtml(formatDuration(-h * 3600000))}</div>
            <div class="hero-sub">Cierre de entregables: ${escapeHtml(formatChile(close))} · nada se sube después de H${L.LAST_UPLOAD_H} (${escapeHtml(formatChile(hourToDate(L.LAST_UPLOAD_H)))})</div>`;
    }
    if (h < L.DURATION_H) {
        const stage = currentStage(h);
        const tiktok = L.STAGES_28H.find(s => s.parallel && h >= s.from && h < s.to);
        return `<div class="hero-kicker">En curso · etapa ${escapeHtml(stage ? stage.label : '')}${tiktok ? ` + ${escapeHtml(tiktok.label)}` : ''}</div>
            <div class="hero-big">H${Math.floor(h)}<span class="hero-of"> / ${L.DURATION_H}</span></div>
            <div class="hero-sub">Cierre en ${escapeHtml(formatDuration((L.DURATION_H - h) * 3600000))} (${escapeHtml(formatChile(close))})${h >= L.WARN_H ? ' · <strong>si algo falla, avisar al jurado y al responsable de sede ahora</strong>' : ''}</div>`;
    }
    return `<div class="hero-kicker">Rally cerrado</div>
        <div class="hero-big">Entregado</div>
        <div class="hero-sub">Resultados de la sede: hasta 3 h después del cierre (${escapeHtml(formatChile(new Date(close.getTime() + 3 * 3600000)))}).</div>`;
}

function timelineHtml() {
    const h = currentH();
    return `<div class="timeline">${L.STAGES_28H.map((s, i) => {
        const state = h >= s.to ? 'done' : h >= s.from ? 'now' : 'next';
        return `<div class="tl-row ${state} ${s.parallel ? 'parallel' : ''}">
            <div class="tl-time">H${s.from}–H${s.to}<span>${escapeHtml(formatChile(hourToDate(s.from), { withDay: false }))}–${escapeHtml(formatChile(hourToDate(s.to)))}</span></div>
            <div class="tl-dot"></div>
            <div class="tl-body"><strong>${i + 1}. ${escapeHtml(s.label)}</strong>${s.parallel ? ' <span class="chip outline">en paralelo</span>' : ''}
                <div>${escapeHtml(s.todo)}</div>
                <div class="form-hint">Salida: ${escapeHtml(s.output)}</div>
            </div>
        </div>`;
    }).join('')}</div>
    <p class="form-hint">Descansos: rotar turnos (al menos un integrante despierto en todo momento). Las horas exactas dependen de la sede; confirmar con la coordinación local.</p>`;
}

function statTile(label, value, sub, view, color = 'var(--k-s1)') {
    return `<button class="tile" data-action="go" data-view="${view}" style="--c:${color}">
        <div class="tile-label">${escapeHtml(label)}</div>
        <div class="tile-value">${value}</div>
        <div class="tile-sub">${sub}</div>
    </button>`;
}

function taskTiming(task) {
    const h = currentH();
    if (task.data.status === 'lista') return 'done';
    if (task.data.hour === null || task.data.hour === undefined || task.data.hour === '') return '';
    if (h >= Number(task.data.hour)) return 'late';
    if (Number(task.data.hour) - h <= 2) return 'soon';
    return '';
}

function renderInicio() {
    const allIdeas = ideas().map(i => ideaData(i));
    const chosen = ideas().filter(i => i.data.status === 'elegida');
    const tasks = byKind('task');
    const doneTasks = tasks.filter(t => t.data.status === 'lista').length;
    const late = tasks.filter(t => taskTiming(t) === 'late');
    const reqs = teamRequirements();
    const reqOk = reqs.filter(r => r.ok).length + L.REQUIREMENTS_MANUAL.filter(r => isChecked(r.id)).length;
    const reqTotal = reqs.length + L.REQUIREMENTS_MANUAL.length;
    const decisions = byKind('decision');
    const decided = decisions.filter(d => (d.data.decision || '').trim()).length;
    const deliveryIds = L.DELIVERY_CHECKLIST.flatMap(g => g.items);
    const deliveryDone = deliveryIds.filter(e => e.auto ? reqs.find(r => r.id === e.auto)?.ok : isChecked(e.id)).length;
    const pre = L.PENDING_BEFORE.filter(p => isChecked(p.id)).length;
    const upcoming = tasks.filter(t => t.data.status !== 'lista').sort((a, b) => (a.data.hour ?? 99) - (b.data.hour ?? 99)).slice(0, 4);
    const gen = getItem('set:general') || makeItem('set:general', 'setting', {});

    return `
        <div class="hero">
            <div class="hero-main" id="countdown">${countdownHtml()}</div>
            <div class="hero-meta">
                <div><span>Sede</span>UDLA (Santiago, Chile)</div>
                <div><span>Líder</span>${escapeHtml((members().find(m => m.data.leader) || { data: { name: '—' } }).data.name)}</div>
                <div><span>Equipo</span>${escapeHtml(general().team_name || 'sin nombre aún')}</div>
            </div>
        </div>

        <div class="tiles">
            ${statTile('Ideas', allIdeas.filter(d => d.status !== 'descartada').length, chosen.length ? `Elegida: ${escapeHtml(chosen.map(i => i.id).join(', '))}` : `${allIdeas.filter(d => d.status === 'validacion').length} en validación`, 'ideas', 'var(--k-s3)')}
            ${statTile('Tareas', `${doneTasks}<span class="tile-of">/${tasks.length}</span>`, late.length ? `<span class="warn">${late.length} vencida(s)</span>` : 'al día', 'tareas', late.length ? 'var(--k-bad)' : 'var(--k-good)')}
            ${statTile('Requisitos del equipo', `${reqOk}<span class="tile-of">/${reqTotal}</span>`, reqOk === reqTotal ? 'todo en regla' : 'revisar Equipo', 'equipo', reqOk === reqTotal ? 'var(--k-good)' : 'var(--k-warn)')}
            ${statTile('Decisiones', `${decided}<span class="tile-of">/${decisions.length}</span>`, `${pre}/${L.PENDING_BEFORE.length} pendientes previos`, 'preparacion', 'var(--k-s2)')}
            ${statTile('Entrega', `${deliveryDone}<span class="tile-of">/${deliveryIds.length}</span>`, 'checklist de la hora 27', 'entrega', 'var(--k-s5)')}
        </div>

        <div class="cols">
            <section class="panel">
                <h2>Próximas tareas</h2>
                ${upcoming.length ? `<ul class="next-list">${upcoming.map(t => `
                    <li class="${taskTiming(t)}"><span class="mono">${escapeHtml(t.id)}</span> ${escapeHtml(t.data.title)}
                        <span class="form-hint">· H${escapeHtml(t.data.hour ?? '?')} (${escapeHtml(t.data.hour !== null && t.data.hour !== '' ? formatChile(hourToDate(t.data.hour)) : '—')}) · ${escapeHtml(t.data.owner || 'sin responsable')}</span></li>`).join('')}</ul>`
                    : '<p class="form-hint">Todas las tareas están listas.</p>'}
                <h2>Cómo usar este workspace</h2>
                <ol class="howto">
                    <li>Cada idea nueva entra al <a href="#ideas">Banco de ideas</a> con un ID (I-01, I-02…).</li>
                    <li>Cada idea que sigue viva pasa el <strong>filtro rápido</strong> y se completa su <strong>ficha</strong>.</li>
                    <li>Las <a href="#tareas">tareas</a> se asignan con responsable y hora límite del Rally (H0 = apertura).</li>
                    <li>El <a href="#temas">tablero por temas</a> agrupa las ideas para comparar sin perder el hilo.</li>
                    <li>Lo que se decide en reunión se anota en <a href="#preparacion">Decisiones</a> y en la <a href="#bitacora">Bitácora</a>.</li>
                </ol>
            </section>
            <section class="panel">
                <h2>Etapas de trabajo (28 horas)</h2>
                ${timelineHtml()}
            </section>
        </div>

        <details class="fold settings">
            <summary class="section-title">Ajustes del workspace</summary>
            <div class="section">
                <div class="row-2">
                    <div class="form-group"><label class="form-label">Nombre del equipo</label>${inlineInput(gen, 'team_name', { kind: 'setting', placeholder: 'Se usa en TikTok y en el sistema del Rally' })}</div>
                    <div class="form-group"><label class="form-label">Apertura H0 (hora Chile)</label>${inlineInput(gen, 'h0', { kind: 'setting', type: 'datetime-local' })}</div>
                </div>
                <p class="form-hint">Todas las horas de la página se calculan desde H0. Si la sede confirma otra hora de apertura, cámbiala aquí.</p>
            </div>
        </details>`;
}

// --- Preparación: decisiones iniciales, requisitos y pendientes previos ---

function requirementsHtml() {
    return `<ul class="req-list">
        ${teamRequirements().map(r => `<li class="${r.ok ? 'ok' : 'no'}"><span class="auto-mark">${r.ok ? '✓' : '✗'}</span>${escapeHtml(r.label)}</li>`).join('')}
    </ul>
    <div class="checks">${L.REQUIREMENTS_MANUAL.map(r => checkRow(r)).join('')}</div>
    <p class="form-hint">Los requisitos con ✓/✗ se calculan desde la tabla de <a href="#equipo">Equipo</a>.</p>`;
}

function renderPreparacion() {
    const decisions = byKind('decision');
    const pre = L.PENDING_BEFORE.filter(p => isChecked(p.id)).length;
    return `
        <div class="page-head"><div><h1>Preparación</h1><p>Cerrar antes del 16/10.</p></div></div>
        <section class="panel">
            <div class="panel-head"><h2>Decisiones iniciales</h2><button class="btn btn-ghost btn-add" data-action="add-decision"><svg><use href="#i-plus"/></svg>Agregar decisión</button></div>
            <div class="table-wrap"><table class="table">
                <thead><tr><th>#</th><th>Decisión</th><th>Opciones</th><th>Decisión tomada</th><th>Fecha</th><th></th></tr></thead>
                <tbody>${decisions.map(d => `
                    <tr class="${(d.data.decision || '').trim() ? 'row-done' : ''}">
                        <td class="mono">${escapeHtml(d.id)}</td>
                        <td>${inlineInput(d, 'title')}</td>
                        <td>${inlineTextarea(d, 'options', { rows: 2, cls: 'small' })}</td>
                        <td>${inlineTextarea(d, 'decision', { rows: 2, cls: 'small', placeholder: 'Pendiente' })}</td>
                        <td>${inlineInput(d, 'date', { type: 'date' })}</td>
                        <td><button class="row-remove" data-action="delete-row" data-id="${escapeHtml(d.id)}" aria-label="Eliminar">×</button></td>
                    </tr>`).join('')}</tbody>
            </table></div>
            <p class="form-hint">D2: sólo se premia una categoría por lugar.</p>
        </section>
        <div class="cols">
            <section class="panel">
                <h2>Requisitos obligatorios</h2>
                ${requirementsHtml()}
            </section>
            <section class="panel">
                <div class="panel-head"><h2>Pendientes antes del 16/10</h2><span class="count">${pre}/${L.PENDING_BEFORE.length}</span></div>
                ${progressBar(pre, L.PENDING_BEFORE.length)}
                <div class="checks">${L.PENDING_BEFORE.map(p => checkRow(p)).join('')}</div>
            </section>
        </div>`;
}

// --- Equipo y roles ---

function renderEquipo() {
    const list = byKind('member');
    const reqs = teamRequirements();
    const missing = reqs.filter(r => !r.ok).map(r => r.label);
    return `
        <div class="page-head"><div><h1>Equipo y roles</h1><p>${members().length} integrante(s) con nombre.</p></div>
            <div class="page-head-actions"><button class="btn btn-accent" data-action="add-member"><svg><use href="#i-plus"/></svg>Agregar integrante</button></div></div>
        <div class="req-box">${reqBox(missing, 'El equipo cumple los requisitos obligatorios.')}</div>
        <section class="panel">
            <div class="table-wrap"><table class="table">
                <thead><tr><th>Integrante</th><th>Carrera / perfil</th><th>Tipo</th><th title="Estudiante de ingeniería">Ing.</th><th>Mujer</th><th>Líder</th><th>Rol principal</th><th>Rol secundario</th><th>Disponibilidad (28 h)</th><th title="Inscrito en la sede">Inscrito</th><th></th></tr></thead>
                <tbody>${list.map(m => `
                    <tr>
                        <td>${inlineInput(m, 'name', { placeholder: 'Nombre' })}</td>
                        <td>${inlineInput(m, 'career', { placeholder: 'Carrera' })}</td>
                        <td>${inlineSelect(m, 'profile', L.MEMBER_PROFILES)}</td>
                        <td class="center">${inlineCheckbox(m, 'engineering')}</td>
                        <td class="center">${inlineCheckbox(m, 'woman')}</td>
                        <td class="center">${inlineCheckbox(m, 'leader')}</td>
                        <td>${inlineInput(m, 'role')}</td>
                        <td>${inlineInput(m, 'role2')}</td>
                        <td>${inlineInput(m, 'availability', { placeholder: 'Ej.: 12:00–02:00, duerme 02–06' })}</td>
                        <td class="center">${inlineCheckbox(m, 'registered')}</td>
                        <td><button class="row-remove" data-action="delete-row" data-id="${escapeHtml(m.id)}" aria-label="Eliminar">×</button></td>
                    </tr>`).join('')}</tbody>
            </table></div>
        </section>
        <section class="panel">
            <h2>Responsabilidades base (según lineamientos)</h2>
            <div class="resp-grid">${L.RESPONSIBILITIES.map(r => `<div class="resp"><strong>${escapeHtml(r.title)}</strong><span>${escapeHtml(r.text)}</span></div>`).join('')}</div>
            <p class="form-hint">La persona que lidera el reporte final y revisa el checklist no debe ser la misma que cierra el video; así hay una segunda mirada (se controla en <a href="#entrega">Entrega</a>).</p>
        </section>`;
}

// --- Tablero por temas ---

function renderTemas() {
    const notes = getItem('set:temas') || makeItem('set:temas', 'setting', {});
    const all = ideas();
    return `
        <div class="page-head"><div><h1>Tablero por temas</h1><p>Agrupa las ideas por tema para comparar y detectar duplicados o combinaciones.</p></div></div>
        <div class="themes">${L.THEMES.map(t => {
            const list = all.filter(i => i.data.theme === t.id);
            const active = list.filter(i => i.data.status !== 'descartada');
            const discarded = list.length - active.length;
            return `<section class="theme-col" style="--c:${t.color}">
                <div class="theme-head"><span class="dot"></span><h2>${escapeHtml(t.label)}</h2><span class="count">${active.length}</span></div>
                <p class="form-hint">${escapeHtml(t.hint)}</p>
                <div class="theme-ideas">${active.length ? active.map(i => {
                    const d = ideaData(i);
                    const score = ideaScore(d);
                    return `<div class="mini-card" data-idea="${escapeHtml(i.id)}" tabindex="0">
                        <span class="mono">${escapeHtml(i.id)}</span> ${escapeHtml(d.name || d.title || 'Sin título')}
                        <div class="mini-tags">${chip(findOption(IDEA_ALL, d.status))}${score !== null ? `<span class="chip outline">★ ${score}</span>` : ''}</div>
                    </div>`;
                }).join('') : '<p class="form-hint">Sin ideas.</p>'}${discarded ? `<p class="form-hint">+ ${discarded} descartada(s)</p>` : ''}</div>
                <div class="form-group"><label class="form-label">Observaciones</label>${inlineTextarea(notes, `notes.${t.id}`, { kind: 'setting', rows: 2, cls: 'small', placeholder: 'Duplicados, combinaciones, ángulos…' })}</div>
            </section>`;
        }).join('')}</div>
        ${all.some(i => !i.data.theme) ? `<p class="form-hint">${all.filter(i => !i.data.theme).length} idea(s) sin tema: asígnalo en la idea.</p>` : ''}`;
}

// --- Tareas ---

function renderTareas() {
    const tasks = byKind('task').sort((a, b) => (a.data.hour ?? 99) - (b.data.hour ?? 99) || a.id.localeCompare(b.id));
    const done = tasks.filter(t => t.data.status === 'lista').length;
    return `
        <div class="page-head"><div><h1>Tareas</h1><p>${done}/${tasks.length} listas · H0 = ${escapeHtml(formatChile(h0Date()))}</p></div>
            <div class="page-head-actions"><button class="btn btn-accent" data-action="add-task"><svg><use href="#i-plus"/></svg>Agregar tarea</button></div></div>
        ${progressBar(done, tasks.length)}
        <section class="panel">
            <div class="table-wrap"><table class="table tasks">
                <thead><tr><th>#</th><th>Tarea</th><th>Entregable</th><th>Responsable</th><th>Estado</th><th>Hora límite (H)</th><th>Hora Chile</th><th></th></tr></thead>
                <tbody>${tasks.map(t => {
                    const timing = taskTiming(t);
                    const hasHour = t.data.hour !== null && t.data.hour !== undefined && t.data.hour !== '';
                    return `<tr class="task-${timing}">
                        <td class="mono">${escapeHtml(t.id)}</td>
                        <td>${inlineTextarea(t, 'title', { rows: 2, cls: 'small' })}</td>
                        <td>${inlineInput(t, 'deliverable')}</td>
                        <td>${inlineInput(t, 'owner', { list: 'people', placeholder: 'Sin asignar' })}</td>
                        <td>${inlineSelect(t, 'status', L.TASK_STATUSES)}</td>
                        <td class="hour-cell">${inlineInput(t, 'hour', { type: 'number', cls: 'hour' })}${t.data.note ? `<div class="form-hint">${escapeHtml(t.data.note)}</div>` : ''}</td>
                        <td class="nowrap">${hasHour ? escapeHtml(formatChile(hourToDate(t.data.hour))) : '—'}${timing === 'late' ? '<div class="warn">vencida</div>' : timing === 'soon' ? '<div class="soon-text">en menos de 2 h</div>' : ''}</td>
                        <td><button class="row-remove" data-action="delete-row" data-id="${escapeHtml(t.id)}" aria-label="Eliminar">×</button></td>
                    </tr>`;
                }).join('')}</tbody>
            </table></div>
            <p class="form-hint"><strong>Regla:</strong> nada se sube después de H${L.LAST_UPLOAD_H}. Si algo falla, se avisa al jurado y al responsable de sede antes de H${L.WARN_H}.</p>
        </section>`;
}

// --- Pitch de 2 minutos ---

function words(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function pitchSeconds(text, wpm) {
    return Math.round(words(text) / (wpm / 60));
}

function pitchStats(pitch) {
    const wpm = Number(pitch.wpm) || L.PITCH_WPM;
    const blocks = L.PITCH_BLOCKS.map(b => {
        const text = (pitch.blocks || {})[b.id] || '';
        const seconds = pitchSeconds(text, wpm);
        const limit = b.to - b.from;
        return { ...b, text, seconds, limit, over: seconds > limit, words: words(text) };
    });
    return { wpm, blocks, total: blocks.reduce((a, b) => a + b.seconds, 0) };
}

function mmss(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function renderPitch() {
    const item = getItem('set:pitch') || makeItem('set:pitch', 'setting', { blocks: {}, wpm: L.PITCH_WPM });
    const stats = pitchStats(item.data);
    const max = L.VIDEO_MAX_SECONDS;
    return `
        <div class="page-head"><div><h1>Pitch de 2 minutos</h1><p>Guion por bloques. La duración se estima a <strong>${stats.wpm}</strong> palabras por minuto.</p></div>
            <div class="page-head-actions"><div class="form-group inline-group"><label class="form-label">Palabras/min</label>${inlineInput(item, 'wpm', { type: 'number', kind: 'setting', cls: 'hour' })}</div></div></div>
        <div class="pitch-total ${stats.total > max ? 'over' : ''}" id="pitchTotal">${pitchTotalHtml(stats)}</div>
        <div class="pitch-blocks">${stats.blocks.map((b, i) => `
            <section class="panel pitch-block ${b.over ? 'over' : ''}" data-block="${b.id}">
                <div class="panel-head">
                    <h2>${i + 1}. ${escapeHtml(b.label)} <span class="form-hint inline">${mmss(b.from)}–${mmss(b.to)}</span></h2>
                    <span class="pitch-meter" data-meter="${b.id}">${pitchMeterHtml(b)}</span>
                </div>
                <p class="form-hint">${escapeHtml(b.hint)}</p>
                ${inlineTextarea(item, `blocks.${b.id}`, { kind: 'setting', rows: 4, placeholder: 'Texto de la voz en off / lo que se dice…' })}
            </section>`).join('')}</div>
        <section class="panel">
            <h2>Consejos</h2>
            <ul class="tips"><li>Grabar por bloques con voz en off.</li><li>Medir la lectura antes de grabar (la estimación es solo una guía).</li><li>El jurado deja de evaluar a los 2 minutos exactos.</li></ul>
        </section>`;
}

function pitchMeterHtml(b) {
    return `${b.words} palabras · ~${b.seconds} s / ${b.limit} s`;
}

function pitchTotalHtml(stats) {
    return `<strong>~${mmss(stats.total)}</strong> de ${mmss(L.VIDEO_MAX_SECONDS)} ${stats.total > L.VIDEO_MAX_SECONDS ? '· se pasa: recorta antes de grabar' : ''}
        ${progressBar(Math.min(stats.total, L.VIDEO_MAX_SECONDS), L.VIDEO_MAX_SECONDS, stats.total > L.VIDEO_MAX_SECONDS ? 'var(--k-bad)' : 'var(--k-s5)')}`;
}

// --- Checklist de entrega ---

function parseDuration(text) {
    const m = String(text || '').trim().match(/^(\d+):(\d{1,2})$/);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    const n = Number(text);
    return text && !Number.isNaN(n) ? n : null;
}

function deliveryWarnings(d) {
    const warnings = [];
    const video = parseDuration(d.video_duration);
    const tiktok = parseDuration(d.tiktok_duration);
    if (video !== null && video > L.VIDEO_MAX_SECONDS) warnings.push(`El video dura ${mmss(video)}: el máximo es ${mmss(L.VIDEO_MAX_SECONDS)} (el jurado deja de evaluar ahí).`);
    if (tiktok !== null && tiktok > L.TIKTOK_MAX_SECONDS) warnings.push(`El TikTok dura ${mmss(tiktok)}: el máximo es ${mmss(L.TIKTOK_MAX_SECONDS)}.`);
    if (d.reviewer && d.video_closer && samePerson(d.reviewer, d.video_closer)) warnings.push('Quien revisa el reporte y el checklist no debe ser quien cierra el video (segunda mirada).');
    if (d.youtube_url && !/youtu\.?be/.test(d.youtube_url)) warnings.push('La URL del video no parece de YouTube.');
    if (d.tiktok_url && !/tiktok\.com/.test(d.tiktok_url)) warnings.push('La URL del TikTok no parece de TikTok.');
    return warnings;
}

function renderEntrega() {
    const item = getItem('set:entrega') || makeItem('set:entrega', 'setting', {});
    const d = item.data;
    const reqs = teamRequirements();
    const entries = L.DELIVERY_CHECKLIST.flatMap(g => g.items);
    const okOf = e => e.auto ? Boolean(reqs.find(r => r.id === e.auto)?.ok) : isChecked(e.id);
    const done = entries.filter(okOf).length;
    const complete = done === entries.length;
    const warnings = deliveryWarnings(d);
    const signMissing = [];
    if (!complete) signMissing.push(`Faltan ${entries.length - done} punto(s) del checklist.`);
    if (!(d.reviewer || '').trim()) signMissing.push('Indica quién revisa el reporte y el checklist.');
    if (!(d.video_closer || '').trim()) signMissing.push('Indica quién cierra el video.');
    if (samePerson(d.reviewer, d.video_closer)) signMissing.push('Revisor y quien cierra el video deben ser personas distintas.');
    return `
        <div class="page-head"><div><h1>Checklist de entrega (hora ${L.LAST_UPLOAD_H})</h1><p>${done}/${entries.length} puntos · cierre ${escapeHtml(formatChile(hourToDate(L.DURATION_H)))}</p></div></div>
        ${progressBar(done, entries.length, complete ? 'var(--k-good)' : 'var(--k-s5)')}
        <div class="cols">
            <section class="panel">
                <h2>Revisión cruzada y enlaces</h2>
                <div class="row-2">
                    <div class="form-group"><label class="form-label">Revisa reporte y checklist</label>${inlineInput(item, 'reviewer', { kind: 'setting', list: 'people' })}</div>
                    <div class="form-group"><label class="form-label">Cierra el video</label>${inlineInput(item, 'video_closer', { kind: 'setting', list: 'people' })}</div>
                </div>
                <div class="row-2">
                    <div class="form-group"><label class="form-label">URL YouTube</label>${inlineInput(item, 'youtube_url', { kind: 'setting', type: 'url', placeholder: 'https://youtu.be/…' })}</div>
                    <div class="form-group"><label class="form-label">Duración del video (m:ss)</label>${inlineInput(item, 'video_duration', { kind: 'setting', placeholder: '1:58' })}</div>
                </div>
                <div class="row-2">
                    <div class="form-group"><label class="form-label">URL TikTok</label>${inlineInput(item, 'tiktok_url', { kind: 'setting', type: 'url', placeholder: 'https://www.tiktok.com/…' })}</div>
                    <div class="form-group"><label class="form-label">Duración del TikTok (m:ss)</label>${inlineInput(item, 'tiktok_duration', { kind: 'setting', placeholder: '0:55' })}</div>
                </div>
                <div class="form-group"><label class="form-label">PDF del reporte (enlace o nombre del archivo)</label>${inlineInput(item, 'pdf', { kind: 'setting' })}</div>
                <div class="req-box">${reqBox([], '', warnings)}</div>
                <div class="sign">
                    ${d.signed_at
                        ? `<div class="req ok">✓ Checklist firmado por <strong>${escapeHtml(d.signed_by)}</strong> · ${escapeHtml(formatChile(new Date(d.signed_at)))} <button class="btn btn-ghost btn-add" data-action="unsign">Quitar firma</button></div>`
                        : `${reqBox(signMissing, 'Todo listo para firmar.')}<button class="btn btn-primary" data-action="sign" ${signMissing.length ? 'disabled' : ''}>Firmar checklist (T-11)</button>`}
                </div>
            </section>
            <section class="panel">
                ${L.DELIVERY_CHECKLIST.map(g => {
                    const n = g.items.filter(okOf).length;
                    return `<div class="checklist">
                        <div class="checklist-head"><span>${escapeHtml(g.group)}</span><span class="checklist-count">${n}/${g.items.length}</span></div>
                        ${g.items.map(e => checkRow(e, { autoValue: e.auto ? okOf(e) : null })).join('')}
                    </div>`;
                }).join('')}
            </section>
        </div>`;
}

// --- Bitácora de reuniones ---

function renderBitacora() {
    const list = byKind('meeting').sort((a, b) => String(b.data.date || '').localeCompare(String(a.data.date || '')) || b.position - a.position);
    return `
        <div class="page-head"><div><h1>Bitácora de reuniones</h1><p>${list.length} reunión(es).</p></div>
            <div class="page-head-actions"><button class="btn btn-accent" data-action="add-meeting"><svg><use href="#i-plus"/></svg>Nueva reunión</button></div></div>
        <section class="panel">
            ${list.length ? `<div class="table-wrap"><table class="table">
                <thead><tr><th>Fecha</th><th>Participantes</th><th>Decisiones</th><th>Tareas nuevas</th><th></th></tr></thead>
                <tbody>${list.map(m => `<tr>
                    <td>${inlineInput(m, 'date', { type: 'date' })}</td>
                    <td>${inlineTextarea(m, 'participants', { rows: 2, cls: 'small' })}</td>
                    <td>${inlineTextarea(m, 'decisions', { rows: 3, cls: 'small' })}</td>
                    <td>${inlineTextarea(m, 'new_tasks', { rows: 3, cls: 'small', placeholder: 'Agrégalas también en Tareas' })}</td>
                    <td><button class="row-remove" data-action="delete-row" data-id="${escapeHtml(m.id)}" aria-label="Eliminar">×</button></td>
                </tr>`).join('')}</tbody>
            </table></div>` : '<div class="empty"><div class="empty-icon">📝</div><strong>Sin reuniones registradas</strong>Agrega la primera con «Nueva reunión».</div>'}
        </section>`;
}

// --- Acciones compartidas ---

function todayChile() {
    const p = chileParts(new Date());
    return `${p.year}-${p.month}-${p.day}`;
}

function nextTaskId() {
    const max = byKind('task').reduce((m, t) => Math.max(m, Number((t.id.match(/^T-(\d+)$/) || [])[1] || 0)), 0);
    return `T-${String(max + 1).padStart(2, '0')}`;
}

function nextDecisionId() {
    const max = byKind('decision').reduce((m, t) => Math.max(m, Number((t.id.match(/^D(\d+)$/) || [])[1] || 0)), 0);
    return `D${max + 1}`;
}

const sharedActions = {
    go: (el) => goToView(el.dataset.view),
    'delete-row': (el) => {
        const item = getItem(el.dataset.id);
        const label = item && (item.data.title || item.data.name || item.data.date) || el.dataset.id;
        if (confirm(`¿Eliminar «${label}»?`)) deleteItem(el.dataset.id);
    }
};

registerView({ id: 'inicio', label: 'Inicio', order: 1, render: renderInicio, actions: sharedActions });

registerView({
    id: 'preparacion', label: 'Preparación', order: 2, render: renderPreparacion,
    actions: { ...sharedActions, 'add-decision': () => saveItem(makeItem(nextDecisionId(), 'decision', { title: '', options: '', decision: '', date: '' }, nextPosition('decision'))) }
});

registerView({
    id: 'equipo', label: 'Equipo', order: 3, render: renderEquipo,
    badge: () => teamRequirements().every(r => r.ok) ? '' : '<span class="badge warn">!</span>',
    actions: {
        ...sharedActions,
        'add-member': () => saveItem(makeItem(randomId('M'), 'member', { name: '', career: '', role: '', role2: '', availability: '', profile: 'estudiante', engineering: false, woman: false, leader: false, registered: false }, nextPosition('member')))
    }
});

registerView({ id: 'temas', label: 'Temas', order: 5, render: renderTemas, actions: sharedActions });

registerView({
    id: 'tareas', label: 'Tareas', order: 6, render: renderTareas,
    badge: () => {
        const late = byKind('task').filter(t => taskTiming(t) === 'late').length;
        return late ? `<span class="badge bad">${late}</span>` : '';
    },
    actions: { ...sharedActions, 'add-task': () => saveItem(makeItem(nextTaskId(), 'task', { title: '', deliverable: '', owner: '', status: 'pendiente', hour: null, note: '' }, nextPosition('task'))) }
});

registerView({
    id: 'pitch', label: 'Pitch', order: 7, render: renderPitch, actions: sharedActions,
    // Contador de palabras en vivo, sin repintar (para no perder el foco).
    onInput(el) {
        const match = (el.dataset.field || '').match(/^blocks\.(\w+)$/);
        if (!match) return;
        const pitch = JSON.parse(JSON.stringify(setting('pitch')));
        setPath(pitch, el.dataset.field, el.value);
        const stats = pitchStats(pitch);
        const block = stats.blocks.find(b => b.id === match[1]);
        document.querySelector(`[data-meter="${block.id}"]`).innerHTML = pitchMeterHtml(block);
        document.querySelector(`[data-block="${block.id}"]`).classList.toggle('over', block.over);
        const total = document.getElementById('pitchTotal');
        total.innerHTML = pitchTotalHtml(stats);
        total.classList.toggle('over', stats.total > L.VIDEO_MAX_SECONDS);
    }
});

registerView({
    id: 'entrega', label: 'Entrega', order: 8, render: renderEntrega,
    actions: {
        ...sharedActions,
        sign: () => {
            const d = setting('entrega');
            updateFields('set:entrega', 'setting', { signed_by: d.reviewer, signed_at: new Date().toISOString() });
            showToast('✓ Checklist firmado');
        },
        unsign: () => updateFields('set:entrega', 'setting', { signed_by: '', signed_at: '' })
    }
});

registerView({
    id: 'bitacora', label: 'Bitácora', order: 9, render: renderBitacora,
    actions: { ...sharedActions, 'add-meeting': () => saveItem(makeItem(randomId('B'), 'meeting', { date: todayChile(), participants: '', decisions: '', new_tasks: '' }, nextPosition('meeting'))) }
});
