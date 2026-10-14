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
    // Margen de trabajo real para construir la idea (prototipo, validación, video y
    // reporte), descontando descanso, la interacción TikTok y la entrega. Lo usa el
    // semáforo de factibilidad del filtro.
    WORK_HOURS: 15,

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
        { id: 'prototipo', label: '¿Se puede validar y prototipar en 15 horas de trabajo?' },
        { id: 'economica', label: '¿Tiene factibilidad económica (quién paga y cuánto cuesta)?' },
        { id: 'reporte', label: '¿Se puede estructurar en el reporte pautado dentro del plazo?' }
    ],

    // Semáforo de factibilidad (fase 1, filtro): cada pregunta vale Sí = 2, A medias = 1, No = 0.
    // Verde desde FEASIBILITY_GREEN puntos; rojo bajo FEASIBILITY_YELLOW (no pasa el filtro).
    FEASIBILITY: [
        { id: 'saber', label: '¿El equipo sabe construirla con sus conocimientos y herramientas actuales?' },
        { id: 'validar', label: '¿Hay a quién validarla (beneficiario, mentor, experto) en las primeras horas?' },
        { id: 'datos', label: '¿Hay datos o cifras públicas para demostrar el impacto?' },
        { id: 'demo', label: '¿Se puede mostrar algo concreto (maqueta 3D, mockup, flujo) en el video de 2 min?' }
    ],
    FEASIBILITY_GREEN: 6,
    FEASIBILITY_YELLOW: 4,

    // Tipo de propuesta: define el plan de trabajo. hour = hora límite sugerida (H).
    OFFERING_TYPES: [
        { id: 'producto', label: 'Producto', icon: '📦', color: 'var(--k-t3)', hint: 'Algo físico o un dispositivo: hay que mostrar una maqueta 3D.' },
        { id: 'servicio', label: 'Servicio', icon: '🛎️', color: 'var(--k-t1)', hint: 'Una prestación, plataforma o app: hay que demostrar el modelo financiero.' },
        { id: 'mixto', label: 'Producto + servicio', icon: '🔀', color: 'var(--k-t2)', hint: 'Dispositivo con servicio asociado: se hacen ambos planes.' }
    ],
    WORK_PLANS: {
        producto: [
            { id: 'p-3d', label: 'Maqueta 3D o render del producto', hint: 'Tinkercad, Fusion 360, SketchUp o Blender. Es la imagen central del video.', hour: 16 },
            { id: 'p-bom', label: 'Lista de materiales y costo unitario de fabricación', hint: 'Materiales, componentes, cantidades y precios en Chile.', hour: 13 },
            { id: 'p-fabricacion', label: 'Proceso de fabricación y proveedores', hint: 'Cómo y dónde se produce, a qué escala.', hour: 14 },
            { id: 'p-precio', label: 'Precio de venta, margen y quién lo compra', hint: 'Comparar con alternativas existentes.', hour: 15 },
            { id: 'p-prueba', label: 'Prueba de usuario con la maqueta', hint: 'Foto o video mostrando la maqueta a un beneficiario o mentor.', hour: 19 }
        ],
        servicio: [
            { id: 's-flujo', label: 'Flujo del servicio (blueprint)', hint: 'Qué hace el usuario paso a paso y qué pasa detrás.', hour: 12 },
            { id: 's-ingresos', label: 'Modelo de ingresos', hint: 'Quién paga, cuánto y cada cuánto (suscripción, comisión, municipio, ONG…).', hour: 13 },
            { id: 's-costos', label: 'Inversión inicial, costos fijos y variables', hint: 'Personal, plataforma, operación y marketing.', hour: 14 },
            { id: 's-financiero', label: 'Análisis financiero: flujo de caja a 12 meses y punto de equilibrio', hint: 'Con supuestos explícitos; es lo que más pesa en prefactibilidad.', hour: 16 },
            { id: 's-mockup', label: 'Mockup de la app o de la pantalla del servicio', hint: 'Figma o Canva. Es la imagen central del video.', hour: 18 }
        ]
    },

    // Filtro rápido, capa IA: Gemini lee cada idea y responde solo las preguntas que se
    // deducen del texto; el resto del filtro lo responde el equipo. El veredicto lo calcula
    // la página con una regla fija. Pasa por la Edge Function supabase/functions/filtrar-idea.
    // help: definición exacta que recibe el modelo (un modelo simple necesita reglas claras).
    // apply: campo del filtro que Gemini llena directamente (marcado con 🤖, editable).
    //   Si el equipo ya lo respondió o lo corrigió, Gemini no lo pisa.
    // key: un "no" en esta pregunta = No pasa; "sin datos" = Dudosa.
    // discard: motivo con que se descarta si esta pregunta da "no".
    AI_TRIAGE: {
        FUNCTION: 'filtrar-idea',
        DELAY_MS: 6000,
        // Si Gemini está saturado (503) o se pasa el límite por minuto (429), se reintenta
        // tras estas esperas antes de dar error.
        RETRY_DELAYS_MS: [5000, 15000, 30000],
        QUESTIONS: [
            { id: 'tipo', label: '¿Producto, servicio o ambos?', apply: 'offering',
                options: ['producto', 'servicio', 'mixto', 'sin_datos'],
                help: 'producto = algo físico o un dispositivo que se fabrica; servicio = una prestación, plataforma o app; mixto = un dispositivo con un servicio asociado; sin_datos = la descripción no permite saberlo.' },
            { id: 'beneficiario', label: '¿El beneficiario es directo y específico?', apply: 'filter.beneficiario', key: true,
                discard: 'Sin beneficiario directo y específico',
                options: ['si', 'no', 'sin_datos'],
                help: 'si = nombra un grupo concreto de personas u organizaciones (por ejemplo «adultos mayores que viven solos en comunas rurales»); no = es genérico («la sociedad», «las personas», «todos», «el medio ambiente»); sin_datos = no se menciona.' },
            { id: 'problema', label: '¿Se entiende qué problema resuelve?', key: true,
                discard: 'Otro: no se entiende qué problema resuelve',
                options: ['si', 'no', 'sin_datos'],
                help: 'si = se puede decir en una frase qué necesidad o dolor del beneficiario resuelve; no = describe una tecnología o un producto sin un problema claro; sin_datos = la descripción es demasiado corta para saberlo.' },
            { id: 'quien_paga', label: '¿Se identifica quién pagaría?', apply: 'filter.economica', key: true,
                discard: 'Sin factibilidad económica',
                options: ['si', 'no', 'sin_datos'],
                help: 'si = la idea nombra o deja claro un pagador (el usuario, un municipio, una empresa, una ONG, el Estado); no = por su naturaleza nadie la pagaría ni la financiaría; sin_datos = no se menciona y no es evidente.' },
            { id: 'demo', label: '¿Hay algo concreto que mostrar en un video de 2 min?', apply: 'feasibility.demo',
                options: ['si', 'medio', 'no'],
                help: 'si = se puede mostrar una maqueta 3D, un mockup de pantalla o un flujo paso a paso; medio = se puede, pero solo con bastante trabajo; no = es un concepto abstracto sin nada visible que mostrar.' },
            { id: 'reporte', label: '¿Cabe en el reporte pautado?', apply: 'filter.reporte', key: true,
                discard: 'No cabe en el reporte pautado',
                options: ['si', 'no'],
                help: 'si = se puede explicar con problema, beneficiario, solución, costos e impacto en un reporte breve; no = es demasiado amplia (un sistema nacional completo, varias soluciones juntas) o demasiado vaga para ese formato.' }
        ],
        VERDICTS: [
            { id: 'pasa', label: 'Pasa', color: 'var(--k-good)' },
            { id: 'dudosa', label: 'Dudosa', color: 'var(--k-s4)' },
            { id: 'no_pasa', label: 'No pasa', color: 'var(--k-bad)' }
        ]
    },

    // Benchmark (fase 2): lo hace el equipo con investigación propia y las IA que
    // quiera. La página arma el prompt para copiar y registra los referentes.
    BENCHMARK_AIS: ['Claude', 'ChatGPT', 'Gemini', 'Perplexity', 'Otra'],
    BENCHMARK_MIN_REFS: 2,
    BENCHMARK_TRENDS: [
        { id: 'crece', label: 'En crecimiento', color: 'var(--k-good)' },
        { id: 'estable', label: 'Estable', color: 'var(--k-s4)' },
        { id: 'decrece', label: 'En baja', color: 'var(--k-bad)' },
        { id: 'nose', label: 'Sin datos', color: 'var(--k-neutral)' }
    ],
    BENCHMARK_VERDICTS: [
        { id: 'seguir', label: 'Seguir: tiene diferenciación', color: 'var(--k-good)' },
        { id: 'pivotar', label: 'Ajustar la idea', color: 'var(--k-s4)' },
        { id: 'descartar', label: 'Descartar: ya existe igual', color: 'var(--k-bad)' }
    ],

    // Criterios de evaluación del jurado, textuales de las bases 2026 (sección 12).
    // Se puntúan 1–5 en la validación. La rúbrica detallada la entrega el Comité
    // Ejecutivo a las sedes; no es pública.
    CRITERIA: [
        { id: 'innovacion', label: 'Grado de innovación de la solución propuesta' },
        { id: 'impacto', label: 'Impacto positivo de la propuesta en la sociedad' },
        { id: 'prefactibilidad', label: 'Prefactibilidad económica y social, y sustentabilidad ambiental' },
        { id: 'viabilidad', label: 'Viabilidad técnica de la propuesta' },
        { id: 'presentacion', label: 'La calidad de la presentación' }
    ],

    VALIDATION_TYPES: ['Entrevista', 'Encuesta corta', 'Mentor local', 'Mentor internacional', 'Dato / estudio', 'Otro'],

    DISCARD_REASONS: [
        'Sin beneficiario directo y específico',
        'No se puede validar ni prototipar a tiempo',
        'Sin factibilidad económica',
        'No cabe en el reporte pautado',
        'Semáforo rojo: no alcanza en 15 horas de trabajo',
        'Ya existe en el mundo sin diferenciación clara',
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
        { id: 'T-07', title: 'Publicar interacción TikTok (#RallyLatam26 y #RallyLatam2026, nombre de los equipos) y registrar URL', deliverable: 'URL en el sistema', hour: 27, note: 'Antes de H27 (ver emparejamiento)' },
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
            { id: 'ent-viable', label: 'Solución técnicamente viable, con impacto positivo en la sociedad y sustentable en lo ambiental' },
            { id: 'ent-criterios', label: 'El reporte aborda los 5 criterios del jurado: grado de innovación, impacto positivo en la sociedad, prefactibilidad económica y social con sustentabilidad ambiental, viabilidad técnica y calidad de la presentación' }
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
            { id: 'tt-duracion', label: 'Video de máximo 1 minuto, con #RallyLatam26 y nombre de los equipos (las bases también mencionan #RallyLatam2026: usar ambas)' },
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
