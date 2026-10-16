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
    // key: un "no" en esta pregunta = No pasa; "sin datos" = Dudosa. Por eso las reglas
    //   reservan el "no" para casos claros: una idea mal descartada no vuelve.
    // Al cambiar estas reglas, las ideas evaluadas con las anteriores se reevalúan.
    // discard: motivo con que se descarta si esta pregunta da "no".
    AI_TRIAGE: {
        // Dirección (slug) de la Edge Function en Supabase: la que aparece en su URL
        // (…/functions/v1/<slug>), que puede no coincidir con el nombre visible.
        FUNCTION: 'rapid-action',
        DELAY_MS: 6000,
        // Si Gemini está saturado (503) o se pasa el límite por minuto (429), se reintenta
        // tras estas esperas antes de dar error (la función ya prueba varios modelos).
        RETRY_DELAYS_MS: [10000],
        // Tiempo máximo de espera por consulta; después se avisa y se sigue.
        TIMEOUT_MS: 80000,
        QUESTIONS: [
            { id: 'tipo', label: '¿Producto, servicio o ambos?', apply: 'offering',
                options: ['producto', 'servicio', 'mixto', 'sin_datos'],
                help: 'producto = algo físico o un dispositivo que se fabrica; servicio = una prestación, plataforma o app; mixto = un dispositivo con un servicio asociado; sin_datos = la descripción no permite saberlo.' },
            { id: 'beneficiario', label: '¿El beneficiario es directo y específico?', apply: 'filter.beneficiario', key: true,
                discard: 'Sin beneficiario directo y específico',
                options: ['si', 'no', 'sin_datos'],
                help: 'si = nombra un grupo concreto de personas u organizaciones, aunque sea amplio (por ejemplo «adultos mayores que viven solos», «juntas de vecinos de comunas con mucha basura»); no = SOLO si es totalmente genérico («la sociedad», «las personas», «todos», «el medio ambiente», «quien quiera»); sin_datos = no se menciona o es ambiguo.' },
            { id: 'alineacion', label: '¿La solución ataca el problema planteado, dentro del desafío?', key: true,
                discard: 'Otro: la solución no ataca el problema planteado',
                options: ['si', 'no', 'sin_datos'],
                help: 'si = la solución actúa directamente sobre el problema escrito (su causa o su efecto) y queda dentro del desafío; no = SOLO si la solución resuelve otro problema distinto al escrito o queda fuera del desafío; sin_datos = no hay problema escrito o no se puede saber.' },
            { id: 'quien_paga', label: '¿Se identifica quién pagaría?', apply: 'filter.economica', key: true,
                discard: 'Sin factibilidad económica',
                options: ['si', 'no', 'sin_datos'],
                help: 'si = la idea nombra o deja claro un pagador (el usuario, un municipio, una empresa, una ONG, el Estado, un fondo concursable); no = SOLO si la idea dice algo que hace imposible financiarla; sin_datos = no se menciona quién paga (no mencionarlo NO es un no).' },
            { id: 'demo', label: '¿Hay algo concreto que mostrar en un video de 2 min?', apply: 'feasibility.demo',
                options: ['si', 'medio', 'no'],
                help: 'si = se puede mostrar una maqueta 3D, un mockup de pantalla o un flujo paso a paso; medio = se puede, pero solo con bastante trabajo; no = es un concepto abstracto sin nada visible que mostrar.' },
            { id: 'reporte', label: '¿Cabe en el reporte pautado?', apply: 'filter.reporte', key: true,
                discard: 'No cabe en el reporte pautado',
                options: ['si', 'no', 'sin_datos'],
                help: 'si = es una solución acotada que se puede explicar con problema, beneficiario, solución, costos e impacto en un reporte breve; no = SOLO si es demasiado amplia para ese formato (un sistema nacional completo, varias soluciones distintas juntas); sin_datos = es tan vaga que no se puede saber.' }
        ],
        VERDICTS: [
            { id: 'pasa', label: 'Pasa', color: 'var(--k-good)' },
            { id: 'dudosa', label: 'Dudosa', color: 'var(--k-s4)' },
            { id: 'no_pasa', label: 'No pasa', color: 'var(--k-bad)' }
        ]
    },

    // Punto 1 de IA (vista Desafíos): antes de proponer soluciones, Gemini revisa si
    // cada problema está alineado con su desafío y bien planteado. Mismas reglas que
    // AI_TRIAGE (help, key); el veredicto lo calcula la página: un "no" en
    // «alineado» = No alineado; otro "no", "parcial" o "sin datos" en una clave = Revisar.
    PROBLEM_CHECK: {
        QUESTIONS: [
            { id: 'alineado', label: '¿El problema es parte del desafío?', key: true,
                options: ['si', 'parcial', 'no'],
                help: 'si = el problema cae dentro de lo que pide el desafío; parcial = toca el desafío solo en parte o de forma indirecta; no = SOLO si es un problema de otro ámbito, fuera del desafío.' },
            { id: 'concreto', label: '¿Es concreto: qué falla, dónde y a quién?', key: true,
                options: ['si', 'no', 'sin_datos'],
                help: 'si = dice qué falla o qué cuesta, en qué contexto y a quién le afecta, aunque sea en pocas palabras; no = SOLO si es una frase general sin nada concreto («la contaminación», «la salud»); sin_datos = es demasiado corto para saberlo.' },
            { id: 'no_solucion', label: '¿Está planteado como problema y no como una solución disfrazada?', key: true,
                options: ['si', 'no'],
                help: 'si = describe una dificultad, necesidad o cuello de botella; no = SOLO si en realidad nombra una solución o su ausencia («falta una app», «no existe un sistema de…», «se necesita una plataforma»).' },
            { id: 'afectado', label: '¿Se identifica quién lo sufre?', key: true,
                options: ['si', 'no', 'sin_datos'],
                help: 'si = nombra a un grupo concreto de personas u organizaciones; no = SOLO si es totalmente genérico («la sociedad», «todos»); sin_datos = no se menciona.' },
            { id: 'evidencia', label: '¿Trae un dato o evidencia de que existe?',
                options: ['si', 'no'],
                help: 'si = menciona una cifra, un estudio, una fuente o una observación concreta; no = no menciona ninguna (no descarta el problema, solo avisa que hay que buscarla).' },
            { id: 'magnitud', label: '¿Dice a cuántos afecta, con una cifra?',
                options: ['si', 'no'],
                help: 'si = da una cantidad de personas, hogares u organizaciones afectadas (aunque sea estimada) o un porcentaje de una población concreta; no = no da ninguna cantidad (no descarta el problema, solo avisa que hay que buscarla).' },
            { id: 'abordaje', label: '¿El abordaje ataca este problema?',
                options: ['si', 'no', 'sin_datos'],
                help: 'si = el abordaje dice qué parte del problema se atacará (una causa, una etapa o un grupo) y eso corresponde al problema escrito; no = el abordaje apunta a otro problema; sin_datos = no se escribió el abordaje.' }
        ],
        VERDICTS: [
            { id: 'ok', label: 'Alineado', color: 'var(--k-good)' },
            { id: 'revisar', label: 'Revisar', color: 'var(--k-s4)' },
            { id: 'no_alineado', label: 'No alineado', color: 'var(--k-bad)' }
        ]
    },

    // --- Flujo del problema (pestañas 1 y 2), con el modo «extraer» de la Edge Function ---
    // Cada tarea manda a Gemini una instrucción, los insumos y los campos que debe
    // devolver (instruccion = qué escribir; opciones = valores permitidos).

    // 1 · Desafíos: resumen breve para entender el desafío aunque no se domine el tema.
    CHALLENGE_SUMMARY: {
        TASK: 'Eres asesor de un equipo universitario de ingeniería en el Rally Latinoamericano de Innovación 2026 (28 horas, Chile). Resume el desafío para que el equipo lo entienda en un minuto aunque no domine el tema. Puedes usar conocimiento general para explicar el contexto, pero no inventes cifras, nombres ni fuentes.',
        FIELDS: [
            { id: 'resumen', label: 'De qué trata', instruccion: 'Qué problema o necesidad aborda el desafío y para quién, en máximo 2 frases.' },
            { id: 'incluye', label: 'Qué incluye', instruccion: 'Qué ámbitos o tipos de solución entran en el desafío (su delimitación), en 2 a 4 puntos cortos separados por " · ".' },
            { id: 'no_incluye', label: 'Qué queda fuera', instruccion: 'Qué no cubre el desafío o qué sería salirse de él, en 1 a 3 puntos cortos separados por " · ". Si el texto no lo dice, deduce lo razonable.' },
            { id: 'actores', label: 'Actores clave', instruccion: 'Quiénes sufren el problema y quiénes podrían pagar o implementar una solución, en una frase.' },
            { id: 'palabras', label: 'Palabras clave', instruccion: 'De 5 a 8 palabras clave separadas por coma, útiles para clasificar ideas y buscar referentes.' }
        ]
    },

    // 2 · Problemas: Gemini asigna solo el desafío que mejor calza con cada idea.
    PROBLEM_CLASSIFY: {
        TASK: 'Clasifica la idea o problema que propone un equipo del Rally en el desafío que mejor le corresponde, usando la lista de desafíos con sus resúmenes. Si encaja en varios, elige el más directo y nombra el otro como alternativo. Si no encaja en ninguno, elige "ninguno".',
        FIELDS: [
            { id: 'desafio', label: 'Desafío', instruccion: 'El id del desafío que mejor calza.' },
            { id: 'calce', label: 'Calce', instruccion: 'Qué tan directo es el calce: alto (es el centro del desafío), medio (entra pero de forma parcial o indirecta) o bajo (apenas lo toca).', opciones: ['alto', 'medio', 'bajo'] },
            { id: 'motivo', label: 'Motivo', instruccion: 'Por qué calza con ese desafío, en una frase de máximo 20 palabras.' },
            { id: 'alternativo', label: 'Alternativo', instruccion: 'El id de un segundo desafío que también podría calzar, o "ninguno".' }
        ],
        LEVELS: [
            { id: 'alto', label: 'Calce alto', color: 'var(--k-good)' },
            { id: 'medio', label: 'Calce medio', color: 'var(--k-s4)' },
            { id: 'bajo', label: 'Calce bajo', color: 'var(--k-bad)' }
        ]
    },

    // 2 · Problemas, paso Benchmark: el informe de la IA investigadora se pega y Gemini lo
    // compacta en esta matriz estándar (la misma para todos los problemas).
    PROBLEM_BENCHMARK: {
        TASK: 'Procesa uno o varios informes de investigación (benchmark) sobre un problema y extrae los puntos clave en un formato estándar y breve. Usa solo lo que dicen los informes: si algo no aparece, escribe "sin datos". Conserva las cifras con su fuente, año, territorio y unidad. No conviertas en hecho lo que el informe marca como inferencia o como dato autorreportado.',
        FIELDS: [
            { id: 'hipotesis', label: 'Hipótesis del equipo', instruccion: 'Según el informe, la hipótesis inicial del equipo sobre el problema y su causa está: respaldada, parcial (en parte, o solo para algunos casos o territorios), no respaldada, o sin datos.', opciones: ['respaldada', 'parcial', 'no respaldada', 'sin datos'] },
            { id: 'hipotesis_motivo', label: 'Por qué', instruccion: 'En una o dos frases: qué evidencia respalda o contradice la hipótesis y qué otras causas aparecen.' },
            { id: 'confiabilidad', label: 'Confiabilidad del informe', instruccion: 'Calidad de la evidencia del informe: alta (fuentes oficiales o académicas, cifras con referencia y corroboradas), media (mezcla de fuentes, algunas cifras sin corroborar) o baja (pocas fuentes, mayormente autorreportadas o sin referencia).', opciones: ['alta', 'media', 'baja'] },
            { id: 'actores', label: 'Actores y roles', instruccion: 'Quién genera el problema, quién lo sufre, posibles usuarios, beneficiarios y quién pagaría, en el formato "Rol: actores" separados por " · ".' },
            { id: 'magnitud', label: 'Magnitud', instruccion: 'Las cifras clave (máximo 3), separando volumen, actores afectados e impactos, cada una con año, territorio y fuente.' },
            { id: 'donde', label: 'Dónde ocurre', instruccion: 'Países o regiones donde el problema es relevante, destacando Chile y Latinoamérica.' },
            { id: 'causas', label: 'Causas', instruccion: 'Las causas principales documentadas (2 a 4, separadas por " · ").' },
            { id: 'quien_paga', label: 'Quién paga hoy', instruccion: 'Quién financia hoy soluciones a este problema (Estado, municipios, empresas, usuarios, fondos), con ejemplos si hay.' },
            { id: 'soluciones', label: 'Soluciones existentes', instruccion: 'De 3 a 6 soluciones existentes, cada una como "Nombre (país): qué hace; quién paga; principal limitación", separadas por " · ". Indica cuáles son latinoamericanas.' },
            { id: 'brechas', label: 'Brechas y oportunidades', instruccion: 'Qué no resuelven bien las soluciones existentes, según limitaciones documentadas (2 a 4, separadas por " · "). Marca con (inferencia) lo que sea análisis y no dato.' },
            { id: 'tendencia', label: 'Tendencia', instruccion: 'Tendencia del problema, del mercado y del número de iniciativas (crecimiento, estable o baja), con el dato que respalda cada una o "sin datos".' },
            { id: 'normativa', label: 'Normativa y fondos', instruccion: 'Normativa, políticas, programas o fondos en Chile y en Latinoamérica, cada uno con su estado (vigente, en tramitación, cerrado o abierto) y año.' },
            { id: 'riesgos', label: 'Riesgos y barreras', instruccion: 'Riesgos o barreras para implementar soluciones en Chile y en el resto de Latinoamérica.' },
            { id: 'validar', label: 'Qué validar en terreno', instruccion: 'Lo que las fuentes no confirman y el equipo debe validar con entrevistas u observación directa, y con quién (2 a 4, separadas por " · ").' },
            { id: 'fuentes', label: 'Fuentes clave', instruccion: 'Las 3 a 5 fuentes más importantes en formato APA abreviado, separadas por " · ".' }
        ],
        // Chips de la parte de arriba de la matriz.
        LEVELS: {
            hipotesis: { respaldada: 'var(--k-good)', parcial: 'var(--k-s4)', 'no respaldada': 'var(--k-bad)', 'sin datos': 'var(--k-neutral)' },
            confiabilidad: { alta: 'var(--k-good)', media: 'var(--k-s4)', baja: 'var(--k-bad)' }
        }
    },

    // 2 · Problemas en fases, igual que Soluciones: Lluvia → Ordenar → Benchmark → Decisión → Elegidos.
    PROBLEM_STAGES: [
        { id: 'lluvia', label: 'Lluvia de problemas', color: 'var(--k-s1)', hint: 'Anoten todos los problemas en una línea y quién lo sufre, sin evaluar. Gemini los asigna solos a un desafío. Al terminar, mándenlos a Ordenar.' },
        { id: 'ordenar', label: 'Ordenar', color: 'var(--k-s2)', hint: '🔗 Similitud entre problemas (fusionar o no) y 🤖 puntaje de priorización 1–5: 5 sí, 4 probable, 3 tal vez, 2 o menos no. El equipo pasa al Benchmark los que quiera.' },
        { id: 'benchmark', label: 'Benchmark', color: 'var(--k-t3)', hint: 'Delimitación del problema + prompt → IA investigadora → informe → 🤖 matriz del problema.' },
        { id: 'decision', label: 'Decisión', color: 'var(--k-s4)', hint: '🤖 Puntaje con el benchmark: magnitud, alineación con el desafío, alcance en Latinoamérica, oportunidad y acceso a validar. El equipo elige.' },
        { id: 'elegido', label: 'Elegidos', color: 'var(--k-s5)', hint: 'Problemas a resolver: 🤖 preguntas «¿Cómo podríamos…?» y lluvia de soluciones (pestaña 3).' }
    ],

    // Ordenar: ¿vale la pena investigar este problema? (primer puntaje, rápido).
    PROBLEM_PRIORITY: {
        TASK: 'Evalúa rápido si vale la pena que un equipo universitario del Rally Latinoamericano de Innovación (28 horas) investigue a fondo este problema. Usa solo lo escrito y el resumen del desafío; no inventes datos.',
        FIELDS: [
            { id: 'prioridad', instruccion: 'Puntaje: 5 = sí, es concreto, está dentro del desafío, es relevante y hay espacio para innovar; 4 = probablemente sí; 3 = tal vez, le falta claridad o relevancia; 2 = no, es vago, está fuera del desafío o es una solución disfrazada; 1 = descartar.', opciones: ['1', '2', '3', '4', '5'] },
            { id: 'motivo', instruccion: 'Por qué ese puntaje, en una frase de máximo 20 palabras.' },
            { id: 'mejorar', instruccion: 'Qué le falta al planteamiento para subir el puntaje, en una frase (vacío si nada).' }
        ],
        LEVELS: { 5: { label: 'Sí', color: 'var(--k-good)' }, 4: { label: 'Probable', color: 'var(--k-good)' }, 3: { label: 'Tal vez', color: 'var(--k-s4)' }, 2: { label: 'No', color: 'var(--k-bad)' }, 1: { label: 'Descartar', color: 'var(--k-bad)' } }
    },

    // Decisión: ¿cuál problema resolvemos? (segundo puntaje, con el benchmark).
    PROBLEM_DECISION: {
        TASK: 'Eres jurado del Rally Latinoamericano de Innovación 2025. Con el benchmark del problema, puntúa de 1 (muy débil) a 5 (excelente) qué tan buen problema es para que un equipo universitario lo resuelva en 28 horas. El jurado valora problemas relevantes que se repiten en varios países de Latinoamérica. Usa solo los insumos; no inventes datos.',
        CRITERIA: [
            { id: 'magnitud', label: 'Magnitud', instruccion: 'A cuántas personas u organizaciones afecta y qué tan grave es, según las cifras del benchmark.' },
            { id: 'alineacion', label: 'Alineación con el desafío', instruccion: 'Qué tan en el centro del desafío está.' },
            { id: 'latam', label: 'Alcance en Latinoamérica', instruccion: 'Si el problema se repite en varios países de Latinoamérica.' },
            { id: 'oportunidad', label: 'Oportunidad de innovar', instruccion: 'Si el benchmark muestra brechas que las soluciones existentes no cubren.' },
            { id: 'validacion', label: 'Acceso a validar', instruccion: 'Si el equipo podría hablar con afectados o expertos durante las 28 horas.' }
        ]
    },

    // País de la sede. El Rally se evalúa también a nivel nacional y latinoamericano:
    // las matrices piden soluciones adaptables a la mayor cantidad de países de la región.
    SEDE_COUNTRY: 'Chile',

    // 2 · Problemas, último paso: preguntas «¿Cómo podríamos…?» para enfocar la lluvia de ideas.
    PROBLEM_HMW: {
        TASK: 'A partir de un problema delimitado y su benchmark, escribe preguntas «¿Cómo podríamos…?» (design thinking) para que un equipo universitario haga una lluvia de ideas de soluciones. No propongas la solución dentro de la pregunta. Piensa en soluciones que se puedan adaptar a varios países de Latinoamérica.',
        FIELDS: [
            { id: 'hmw1', instruccion: 'Una pregunta «¿Cómo podríamos…?» que ataque la causa principal del problema.' },
            { id: 'hmw2', instruccion: 'Una pregunta «¿Cómo podríamos…?» que aproveche una brecha u oportunidad del benchmark.' },
            { id: 'hmw3', instruccion: 'Una pregunta «¿Cómo podríamos…?» pensada para que la solución funcione en varios países de Latinoamérica.' }
        ]
    },

    // 3 · Soluciones, Benchmark de la solución: el informe de la IA investigadora se compacta
    // en esta matriz de innovación (tipos según el Manual de Oslo 2018: producto o proceso de negocio).
    SOLUTION_BENCHMARK: {
        TASK: 'Procesa uno o varios informes de benchmark sobre una idea de solución y evalúa su innovación con el Manual de Oslo 2018 (innovación de producto: bien o servicio; innovación de proceso de negocio: producción, distribución y logística, marketing y ventas, TIC, administración, o desarrollo de productos y procesos). Usa solo lo que dicen los informes y la idea: si algo no aparece, escribe "sin datos".',
        FIELDS: [
            { id: 'tipo', label: 'Tipo de innovación (Oslo)', instruccion: 'Si es innovación de producto (bien o servicio), de proceso de negocio (indica la función) o ambas, en una frase.' },
            { id: 'novedad', label: 'Grado de novedad', instruccion: 'Qué tan nueva es frente a lo que ya existe según los informes.', opciones: ['no es nueva', 'nueva en Chile', 'nueva en Latinoamérica', 'nueva en el mundo'] },
            { id: 'existentes', label: 'Soluciones parecidas', instruccion: 'De 2 a 5 soluciones parecidas con nombre y país, separadas por " · ".' },
            { id: 'diferenciacion', label: 'Diferenciación', instruccion: 'Qué distingue a la idea de esas soluciones, en máximo 2 frases. Si ya existe igual, dilo.' },
            { id: 'ajustes', label: 'Qué ajustar para innovar más', instruccion: 'De 1 a 3 ajustes concretos para que la idea sea más innovadora o se diferencie más, separados por " · ".' },
            { id: 'valor', label: 'Valor agregado', instruccion: 'El valor agregado que el equipo puede aportar, en una frase.' },
            { id: 'latam', label: 'Adaptable a Latinoamérica', instruccion: 'En qué países de Latinoamérica se podría implementar y qué habría que adaptar en cada contexto, en máximo 2 frases.' },
            { id: 'trl', label: 'Madurez alcanzable en 28 h', instruccion: 'Nivel de madurez tecnológica (TRL) que el equipo podría demostrar en 28 horas: TRL 1 = idea en papel; TRL 2 = concepto formulado; TRL 3 = prueba de concepto o maqueta funcional; TRL 4 = prototipo validado en condiciones de laboratorio.', opciones: ['TRL 1', 'TRL 2', 'TRL 3', 'TRL 4'] },
            { id: 'riesgos', label: 'Riesgos', instruccion: 'Los 2 o 3 riesgos principales de la idea (técnicos, de adopción o regulatorios), separados por " · ".' },
            { id: 'fuentes', label: 'Fuentes clave', instruccion: 'Las 3 a 5 fuentes más importantes en formato APA abreviado, separadas por " · ".' }
        ]
    },

    // 3 · Soluciones, Decisión: Gemini puntúa cada finalista 1–5 en los criterios del jurado
    // (CRITERIA, con los puntos de la sede) y estima horas, encaje con el equipo y escalabilidad.
    // El ranking lo arma la página; el líder del equipo confirma la elegida.
    DECISION_MATRIX: {
        TASK: 'Eres jurado del Rally Latinoamericano de Innovación 2025 (28 horas). Evalúa con exigencia una idea finalista de un equipo universitario usando todos los insumos: el problema y su benchmark, la idea, su matriz de innovación, las respuestas del equipo y las carreras de sus integrantes. Puntúa de 1 (muy débil) a 5 (excelente) cada criterio según lo que pide. El jurado valora especialmente las soluciones que se pueden adaptar a varios países de Latinoamérica, no solo a uno.',
        EXTRA: [
            { id: 'horas', label: 'Horas para un prototipo', instruccion: 'Cuántas horas de trabajo del equipo tomaría tener un prototipo o maqueta demostrable para el video, como un número estimado con una frase de por qué.' },
            { id: 'encaje', label: 'Encaje con el equipo', instruccion: 'Qué tan bien calza la idea con las carreras y habilidades del equipo.', opciones: ['alto', 'medio', 'bajo'] },
            { id: 'encaje_motivo', label: 'Por qué el encaje', instruccion: 'En una frase, qué carreras o habilidades del equipo la sostienen o qué les falta.' },
            { id: 'escalabilidad', label: 'Escalable en Latinoamérica', instruccion: 'En una frase, si se puede adaptar a otros países de Latinoamérica y a cuáles.' },
            { id: 'mejorar', label: 'Qué la haría ganar', instruccion: 'Los 2 cambios que más subirían su puntaje, separados por " · ".' }
        ]
    },

    // 3 · Soluciones, Construir: Gemini prellena la ficha (solo los campos vacíos) con
    // todo lo que ya existe: problema, benchmarks, idea y decisión.
    FICHA_PREFILL: {
        TASK: 'Redacta la ficha de una idea para el reporte del Rally Latinoamericano de Innovación 2025 usando solo los insumos (problema, benchmark del problema, idea, matriz de innovación y evaluación). Escribe en español, claro y breve (máximo 60 palabras por campo). Si un dato no está en los insumos, escribe "por completar" en vez de inventarlo. Considera la implementación en Chile y en otros países de Latinoamérica.'
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

    // Criterios de evaluación del jurado (bases 2026, sección 12) con la rúbrica que
    // mostró la sede para el video de 2 minutos: puntos y qué hay que demostrar.
    // Se puntúan 1–5 en la validación y el total se lleva a 100 según los puntos.
    // fields: campos de la idea que respaldan el criterio (la validación muestra si
    // están completos). Presentación no salía en la foto de la rúbrica: 10 puntos es
    // lo que falta para 100, hay que confirmarlo con la sede.
    CRITERIA: [
        { id: 'innovacion', label: 'Grado de innovación de la solución', short: 'Innovación', points: 30,
            rubric: 'Explicar qué la diferencia de las alternativas existentes y qué valor aporta.',
            fields: ['e_innovacion', 'f_alternativas', 'benchmark.differentiation'] },
        { id: 'impacto', label: 'Impacto positivo en la sociedad', short: 'Impacto', points: 20,
            rubric: 'Identificar a los beneficiarios y fundamentar cómo se aborda una problemática concreta.',
            fields: ['b_problema', 'c_beneficiario', 'b_alcance', 'b_abordaje', 'g_efecto'] },
        { id: 'prefactibilidad', label: 'Prefactibilidad económica y social, y sustentabilidad ambiental', short: 'Prefactibilidad', points: 20,
            rubric: 'Considerar recursos, costos aproximados, aceptación social e implicancias ambientales.',
            fields: ['j_recursos', 'f_costo_inicial', 'f_quien_paga', 'g_aceptacion', 'g_ambiental'] },
        { id: 'viabilidad', label: 'Viabilidad técnica', short: 'Viabilidad', points: 20,
            rubric: 'Sustentar el funcionamiento de la propuesta y sus posibilidades de implementación.',
            fields: ['d_solucion', 'h_viabilidad', 'h_implementacion'] },
        { id: 'presentacion', label: 'La calidad de la presentación', short: 'Presentación', points: 10,
            rubric: 'Se evalúa en el video de 2 minutos (vista Pitch). Puntaje por confirmar con la sede.',
            fields: [] }
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
        { id: 'gancho', label: 'Gancho y dolor', from: 0, to: 20, hint: 'Dato impactante o pregunta. Quién sufre el problema y a cuántos afecta. Sin presentaciones largas.' },
        { id: 'valor', label: 'Propuesta de valor', from: 20, to: 50, hint: 'Innovación (30 pts): qué la diferencia de las alternativas existentes y qué valor aporta. Mostrar prototipo o flujograma.' },
        { id: 'modelo', label: 'Factibilidad y modelo', from: 50, to: 80, hint: 'Viabilidad técnica (20 pts): cómo funciona y cómo se implementa. Prefactibilidad (20 pts): recursos y costos aproximados.' },
        { id: 'impacto', label: 'Impacto y sustentabilidad', from: 80, to: 105, hint: 'Impacto (20 pts): beneficiarios y cómo se aborda el problema. Aceptación social e implicancias ambientales.' },
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
