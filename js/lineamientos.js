// Reglas y contenido base del workspace, según el documento de trabajo del
// Rally Latinoamericano de Innovación 2026 (sede UDLA). Este es el archivo a
// editar cuando cambien las bases, los temas, las tareas o los checklists.
window.LINEAMIENTOS = {
    // Apertura del Rally (H0) en hora de Chile continental (America/Santiago).
    // Se puede cambiar desde la página (Inicio → Ajustes) si la sede confirma otra hora.
    H0_DEFAULT: '2026-10-16T12:00',
    DURATION_H: 28,
    // Nada se sube después de esta hora; avisar al jurado antes de WARN_H.
    LAST_UPLOAD_H: 27,
    WARN_H: 26,

    // Tablero por temas (sección 4).
    THEMES: [
        { id: 'sustentabilidad', label: 'Sustentabilidad y recursos', hint: 'Agua, residuos, huertas.', color: 'var(--k-t1)' },
        { id: 'bienestar', label: 'Prevención y bienestar', hint: 'Alerta temprana, salud móvil, violencia.', color: 'var(--k-t2)' },
        { id: 'logistica', label: 'Logística y organización', hint: 'Logística, desarrollo organizacional.', color: 'var(--k-t3)' },
        { id: 'reciclaje', label: 'Reciclaje tecnológico/textil', hint: 'Ganadores chilenos previos en este tema: Hojabeta y The Last Resort. Buscar un ángulo distinto.', color: 'var(--k-t4)' },
        { id: 'otro', label: 'Otro / por definir', hint: 'Desafíos publicados en la apertura que no calzan en los temas anteriores.', color: 'var(--k-neutral)' }
    ],

    // Filtro rápido (sección 3): si falla alguno, la idea se descarta.
    QUICK_FILTER: [
        { id: 'beneficiario', label: '¿Tiene un beneficiario directo y específico?' },
        { id: 'prototipo', label: '¿Se puede validar y prototipar en el tiempo disponible?' },
        { id: 'economica', label: '¿Tiene factibilidad económica (quién paga y cuánto cuesta)?' },
        { id: 'reporte', label: '¿Se puede estructurar en el reporte pautado dentro del plazo?' }
    ],

    // Criterios del jurado (checklist de entrega): se puntúan 1–5 en la validación.
    CRITERIA: [
        { id: 'innovacion', label: 'Innovación' },
        { id: 'impacto', label: 'Impacto social y ambiental' },
        { id: 'prefactibilidad', label: 'Prefactibilidad y sustentabilidad' },
        { id: 'viabilidad', label: 'Viabilidad técnica' },
        { id: 'presentacion', label: 'Potencial de presentación' }
    ],

    VALIDATION_TYPES: ['Entrevista', 'Encuesta corta', 'Mentor local', 'Mentor internacional', 'Dato / estudio', 'Otro'],

    DISCARD_REASONS: [
        'Sin beneficiario directo y específico',
        'No se puede validar ni prototipar a tiempo',
        'Sin factibilidad económica',
        'No cabe en el reporte pautado',
        'Duplicada o combinada con otra idea',
        'Otro'
    ],

    // Categorías del Rally (D2).
    CATEGORIES: ['Innovación', 'Impacto Social', 'Ambas'],

    // Decisiones iniciales (sección 1).
    DECISIONS: [
        { id: 'D1', title: 'Perfil del equipo', options: 'Ingeniería + informática + diseño/negocios/ciencias sociales' },
        { id: 'D2', title: 'Categoría objetivo', options: 'Innovación / Impacto Social / ambas (sólo se premia una categoría por lugar)' },
        { id: 'D3', title: 'Tema preferido', options: 'Sustentabilidad y recursos · Prevención y bienestar · Logística y organización · Reciclaje tecnológico/textil' },
        { id: 'D4', title: 'Mentores a consultar', options: 'Locales (sede) / internacionales (vía correo)' },
        { id: 'D5', title: 'Estudiante observador (nivel medio)', options: 'Sí / No — requiere confirmar con Prof. Hinojosa y autorización de padres' }
    ],

    // Equipo inicial (sección 2). Se completa desde la página.
    MEMBERS: [
        { name: 'Matías Garrido', career: 'Ingeniería Civil Industrial', role: 'Líder, coordinación, viabilidad económica', role2: 'Pitch', leader: true, engineering: true },
        { name: '', career: 'Ingeniería Industrial', role: 'Impacto y sustentabilidad', engineering: true },
        { name: '', career: 'Ingeniería Industrial', role: 'Viabilidad técnica', engineering: true },
        { name: '', career: 'Informática', role: 'Prototipo / TikTok' },
        { name: '', career: '', role: 'Audiovisual y pitch (guion, grabación, edición)' },
        { name: '', career: '', role: 'Creatividad y redes (TikTok)' }
    ],
    MEMBER_PROFILES: [
        { id: 'estudiante', label: 'Estudiante' },
        { id: 'graduado', label: 'Graduado / profesional' },
        { id: 'docente', label: 'Docente' }
    ],
    TEAM_SIZE: { min: 4, max: 10 },

    RESPONSIBILITIES: [
        { title: 'Viabilidad técnica y económica', text: 'Modelo de negocio sostenible, costos, financiamiento, método cuantitativo.' },
        { title: 'Impacto y medioambiente', text: 'Indicadores de sustentabilidad y beneficio para la comunidad.' },
        { title: 'Audiovisual y pitch', text: 'Presentación, guion del reporte, video de hasta 2 min.' },
        { title: 'Creatividad y redes', text: 'Interacción lúdico-creativa en TikTok según bases.' }
    ],

    // Tareas (sección 6). hour = hora límite del Rally (H0 = apertura).
    TASKS: [
        { id: 'T-01', title: 'Formar equipo y registrar en el sistema', deliverable: 'Equipo confirmado', hour: 0 },
        { id: 'T-02', title: 'Elegir desafío y justificar', deliverable: 'Acta de elección', hour: 3 },
        { id: 'T-03', title: 'Definir beneficiario y forma de validarlo', deliverable: 'Ficha de idea (b, c)', hour: 6 },
        { id: 'T-04', title: 'Validar la solución (entrevista, encuesta corta, mentor)', deliverable: 'Notas de validación', hour: 10 },
        { id: 'T-05', title: 'Modelo económico preliminar', deliverable: 'Tabla de costos e ingresos', hour: 14 },
        { id: 'T-06', title: 'Prototipo / render / flujograma', deliverable: 'Imagen para video y pitch', hour: 18 },
        { id: 'T-07', title: 'Publicar interacción TikTok (#RallyLatam26, nombre del equipo) y registrar URL', deliverable: 'URL en el sistema', hour: 27, note: 'Antes de H27 (ver emparejamiento)' },
        { id: 'T-08', title: 'Guion del video (2 min máx.) con bloques de tiempo', deliverable: 'Guion', hour: 16 },
        { id: 'T-09', title: 'Grabar y editar video', deliverable: 'Video MP4 ≤ 2 min', hour: 24 },
        { id: 'T-10', title: 'Redactar reporte pautado con citas APA (incluye IA)', deliverable: 'PDF del reporte', hour: 24 },
        { id: 'T-11', title: 'Revisión cruzada con checklist', deliverable: 'Checklist firmado', hour: 26 },
        { id: 'T-12', title: 'Subir video a YouTube y registrar URL + PDF en el sistema', deliverable: 'Confirmación de carga', hour: 27 }
    ],
    TASK_STATUSES: [
        { id: 'pendiente', label: 'Pendiente', color: 'var(--k-neutral)' },
        { id: 'en_curso', label: 'En curso', color: 'var(--k-t1)' },
        { id: 'bloqueada', label: 'Bloqueada', color: 'var(--k-bad)' },
        { id: 'lista', label: 'Lista', color: 'var(--k-good)' }
    ],

    // Etapas de trabajo (sección 7).
    STAGES_28H: [
        { from: 0, to: 3, label: 'Arranque', todo: 'Formar equipo, revisar desafíos publicados, roles', output: 'Equipo y desafío elegido' },
        { from: 3, to: 8, label: 'Entender el problema', todo: 'Investigación rápida, beneficiarios, 2–3 ideas candidatas', output: 'Idea seleccionada y ficha a/b/c' },
        { from: 4, to: 9, label: 'Interacción TikTok', todo: 'Emparejamiento, video lúdico con otro equipo de otro país; sólo necesita a algunos integrantes', output: 'URL de TikTok registrada', parallel: true },
        { from: 8, to: 14, label: 'Diseñar solución', todo: 'Solución, validación, modelo económico preliminar', output: 'Solución validada (d, e, f)' },
        { from: 14, to: 20, label: 'Construir', todo: 'Prototipo, cálculos, borrador del reporte', output: 'Prototipo y borrador' },
        { from: 20, to: 24, label: 'Producir', todo: 'Guion, grabación, reporte casi final', output: 'Video grabado y reporte' },
        { from: 24, to: 27, label: 'Revisar', todo: 'Edición, APA, checklist, corrección de formato', output: 'Material listo' },
        { from: 27, to: 28, label: 'Entregar', todo: 'Subir YouTube, PDF y URL al sistema', output: 'Confirmación de carga' }
    ],

    // Pitch de 2 minutos (sección 8). from/to en segundos.
    PITCH_BLOCKS: [
        { id: 'gancho', label: 'Gancho y dolor', from: 0, to: 20, hint: 'Dato impactante o pregunta. Quién sufre el problema. Sin presentaciones largas.' },
        { id: 'valor', label: 'Propuesta de valor', from: 20, to: 50, hint: 'Qué es la solución, cómo funciona, componente innovador. Mostrar prototipo o flujograma.' },
        { id: 'modelo', label: 'Factibilidad y modelo', from: 50, to: 80, hint: 'Financiamiento, costos clave, por qué es viable y accesible frente a alternativas.' },
        { id: 'impacto', label: 'Impacto y sustentabilidad', from: 80, to: 105, hint: 'Efecto en la comunidad o el medioambiente y cómo se mantiene a largo plazo.' },
        { id: 'cierre', label: 'Equipo y cierre', from: 105, to: 120, hint: 'Multidisciplinariedad en una frase. Cierre memorable.' }
    ],
    // Velocidad de lectura para estimar la duración (palabras por minuto).
    PITCH_WPM: 150,
    VIDEO_MAX_SECONDS: 120,
    TIKTOK_MAX_SECONDS: 60,

    // Requisitos obligatorios que no se pueden calcular desde la tabla de equipo.
    REQUIREMENTS_MANUAL: [
        { id: 'req-inscripcion', label: 'Inscripción personal en la sede (todos en la misma sede física si es presencial)' }
    ],

    // Checklist de entrega (sección 9).
    DELIVERY_CHECKLIST: [
        { group: 'Contenido', items: [
            { id: 'ent-desafio', label: 'El desafío elegido está resuelto de manera directa por nuestra idea' },
            { id: 'ent-beneficiarios', label: 'Beneficiarios identificados de forma específica' },
            { id: 'ent-economica', label: 'Propuesta económicamente factible (costos, financiamiento, alternativas)' },
            { id: 'ent-viable', label: 'Solución técnicamente viable y con impacto social y ambiental positivo' },
            { id: 'ent-criterios', label: 'Criterios cubiertos: innovación, impacto, prefactibilidad y sustentabilidad, viabilidad técnica, calidad de la presentación' }
        ] },
        { group: 'Video YouTube', items: [
            { id: 'yt-duracion', label: 'Duración máxima de 2 minutos (medido en el archivo final)' },
            { id: 'yt-cuenta', label: 'Subido a YouTube desde la cuenta de un integrante del equipo' },
            { id: 'yt-url', label: 'URL registrada en el Sistema de Gestión del Rally' }
        ] },
        { group: 'Reporte pautado (PDF)', items: [
            { id: 'pdf-formato', label: 'Completo y sin errores de formato' },
            { id: 'pdf-apa', label: 'Citas válidas en APA, incluidas las de uso de inteligencia artificial' },
            { id: 'pdf-autoria', label: 'Solución de autoría propia (sin plagio ni abuso de IA, las bases lo penalizan)' }
        ] },
        { group: 'Interacción TikTok', items: [
            { id: 'tt-duracion', label: 'Video de máximo 1 minuto, con #RallyLatam26 y nombre de los equipos' },
            { id: 'tt-ludica', label: 'Actividad lúdico-creativa entre dos equipos de distinto país o cultura' },
            { id: 'tt-url', label: 'URL del video registrada por ambos líderes en el sistema' }
        ] },
        { group: 'Equipo', items: [
            { id: 'eq-mujer', label: 'Al menos un integrante mujer', auto: 'women' },
            { id: 'eq-ingenieria', label: 'Al menos un estudiante de ingeniería', auto: 'engineering' },
            { id: 'eq-sede', label: 'Todos los integrantes registrados en la sede', auto: 'registered' }
        ] },
        { group: 'Material', items: [
            { id: 'mat-publico', label: 'Todo lo entregado pasa a ser de dominio público: revisar que no haya material de terceros sin permiso' }
        ] }
    ],

    // Pendientes antes del 16/10 (sección 10).
    PENDING_BEFORE: [
        { id: 'pre-perfil', label: 'Definir perfil del equipo y categoría objetivo (Decisiones D1 y D2)' },
        { id: 'pre-mujer', label: 'Confirmar mujer en el equipo y completar roles' },
        { id: 'pre-observador', label: 'Revisar y decidir sobre el estudiante observador (aviso a Prof. Hinojosa y autorización)' },
        { id: 'pre-inscripcion', label: 'Confirmar inscripción de todos los integrantes en el sistema' },
        { id: 'pre-turnos', label: 'Definir turnos de descanso para las 28 horas' },
        { id: 'pre-mentores', label: 'Definir quién atiende a mentores locales e internacionales' },
        { id: 'pre-herramientas', label: 'Preparar herramientas: edición de video, plantilla de reporte con APA, cuenta de TikTok y YouTube' }
    ]
};
