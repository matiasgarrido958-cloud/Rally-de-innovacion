// Edge Function: primer filtro de una idea con Gemini.
// Gemini solo responde preguntas cerradas sobre lo que dice la idea; el veredicto
// (pasa / dudosa / no pasa) lo calcula la página con una regla fija.
// Las preguntas vienen de AI_TRIAGE en js/lineamientos.js.
// Con mode: 'correlacionar' recibe varias ideas y devuelve grupos de ideas
// relacionadas con una propuesta combinada para cada uno (la página la muestra y
// el equipo decide si crea el bloque nuevo; las ideas originales no se tocan).
// Con mode: 'extraer' recibe una tarea, insumos de texto y los campos a devolver
// (resumen de desafíos, clasificación de problemas, matriz del benchmark).
//
// Secrets (Supabase → Edge Functions → Secrets):
//   GEMINI_API_KEY  clave de Google AI Studio (https://aistudio.google.com/apikey)
//   GEMINI_MODELS   opcional; modelos preferidos en orden, separados por comas.
//                   Sin esto, la función detecta sola los modelos Gemini disponibles
//                   para la clave y los ordena alternando flash y lite (versión más
//                   nueva primero), luego otros y pro. Si uno está saturado, sin cuota
//                   o falla, usa el siguiente: la cuota gratuita es por modelo.
//   GROQ_API_KEY    opcional; respaldo si Gemini no responde (caído, saturado o sin
//                   cuota). Clave gratuita de https://console.groq.com/keys
//   GROQ_MODELS     opcional; modelos de Groq en orden, separados por comas
//                   (por defecto llama-3.3-70b-versatile y luego llama-3.1-8b-instant).
// Deja activado "Verify JWT": solo usuarios con sesión en el workspace pueden usarla.

const DEFAULT_MODEL = 'gemini-3.8-flash';

const MAX_MODELS_PER_REQUEST = 8;
// Límites de tiempo: Supabase corta la función si tarda demasiado y el navegador
// solo ve "no se pudo conectar". Cada modelo tiene MODEL_TIMEOUT_MS y no se prueban
// modelos nuevos después de TOTAL_BUDGET_MS.
const MODEL_TIMEOUT_MS = 15000;
const TOTAL_BUDGET_MS = 35000;
// Las correlaciones escriben más texto: cada modelo tiene más tiempo y se deja de
// probar modelos nuevos antes, para quedar bajo el límite de Supabase.
const CORRELATE_MODEL_TIMEOUT_MS = 45000;
const CORRELATE_BUDGET_MS = 30000;
const DISCOVERY_TTL_MS = 60 * 60 * 1000;
// Respaldo con Groq (API compatible con OpenAI). El plan gratuito limita los tokens
// por minuto, así que el texto enviado se recorta a GROQ_MAX_PROMPT caracteres.
const GROQ_DEFAULT_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
const GROQ_TIMEOUT_MS = 25000;
const GROQ_MAX_PROMPT = 28000;
let discovered: { at: number; models: string[] } | null = null;

// Tolera valores pegados con espacios, comillas o el prefijo "models/".
function cleanModel(m: string) {
    return m.trim().replace(/^["']|["']$/g, '').replace(/^models\//, '').trim();
}

function preferredModels() {
    const raw = Deno.env.get('GEMINI_MODELS') || Deno.env.get('GEMINI_MODEL') || '';
    return raw.split(/[,\n]/).map(cleanModel).filter(Boolean);
}

// Grupo: flash, lite, otros, pro; estables antes que preview; versión más nueva primero.
function modelRank(name: string) {
    const tier = /flash-lite|lite/.test(name) ? 1 : /flash/.test(name) ? 0 : /pro/.test(name) ? 3 : 2;
    const preview = /preview|exp/.test(name) ? 1 : 0;
    const version = parseFloat((name.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || '0');
    return { tier, preview, version };
}

// Lista los modelos Gemini de texto disponibles para la clave (con caché de 1 hora).
async function discoverModels(key: string) {
    if (discovered && Date.now() - discovered.at < DISCOVERY_TTL_MS) return discovered.models;
    try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
            headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) return [];
        const data = await response.json();
        const models = (data.models || [])
            .filter((m: { name?: string; supportedGenerationMethods?: string[] }) =>
                (m.supportedGenerationMethods || []).includes('generateContent'))
            .map((m: { name: string }) => cleanModel(m.name))
            .filter((name: string) => /^gemini-/.test(name) && !/embed|image|tts|audio|live|aqa|computer|robotics|veo|imagen/.test(name))
            .sort((x: string, y: string) => {
                const a = modelRank(x), b = modelRank(y);
                return a.tier - b.tier || a.preview - b.preview || b.version - a.version || x.localeCompare(y);
            });
        // Alterna flash y lite: si todos los flash están saturados, los lite (más
        // livianos) se prueban antes de que se acabe el tiempo.
        const flash = models.filter((m: string) => modelRank(m).tier === 0);
        const lite = models.filter((m: string) => modelRank(m).tier === 1);
        const rest = models.filter((m: string) => modelRank(m).tier > 1);
        const mixed: string[] = [];
        for (let i = 0; i < Math.max(flash.length, lite.length); i++) {
            if (flash[i]) mixed.push(flash[i]);
            if (lite[i]) mixed.push(lite[i]);
        }
        discovered = { at: Date.now(), models: [...mixed, ...rest] };
        return discovered.models;
    } catch {
        return [];
    }
}

async function modelList(key: string) {
    const list = [...preferredModels(), ...await discoverModels(key)];
    if (!list.length) list.push(DEFAULT_MODEL);
    return [...new Set(list)].slice(0, MAX_MODELS_PER_REQUEST);
}

type Attempt = { ok: true; raw: Record<string, Record<string, unknown>> } | { ok: false; status: number; detail: string; next: boolean };

async function askModel(model: string, key: string, prompt: string, schema: unknown, temperature = 0, timeoutMs = MODEL_TIMEOUT_MS): Promise<Attempt> {
    let response: Response;
    let text: string;
    try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature, responseMimeType: 'application/json', responseSchema: schema }
            }),
            signal: AbortSignal.timeout(timeoutMs)
        });
        text = await response.text();
    } catch {
        // Tardó demasiado o se cortó la conexión: probar el siguiente.
        return { ok: false, status: 504, detail: 'sin respuesta a tiempo', next: true };
    }
    if (!response.ok) {
        // Saturado, sin cuota, caído o modelo inexistente para esta clave: probar el siguiente.
        // Un 400 que no es de la clave (p. ej. un modelo que no acepta el formato JSON) también.
        const modelProblem = [404, 429, 500, 503, 504].includes(response.status)
            || (response.status === 400 && !/api[ _]?key/i.test(text));
        return { ok: false, status: response.status, detail: text.slice(0, 300), next: modelProblem };
    }
    try {
        const data = JSON.parse(text);
        const out = (data.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
        return { ok: true, raw: JSON.parse(out) };
    } catch {
        return { ok: false, status: 502, detail: 'respuesta no válida', next: true };
    }
}

function groqModels() {
    const list = (Deno.env.get('GROQ_MODELS') || '').split(',').map(m => m.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    return list.length ? list : GROQ_DEFAULT_MODELS;
}

// El esquema de Gemini (tipos en mayúscula) como texto JSON Schema para la instrucción.
function schemaText(schema: unknown) {
    return JSON.stringify(schema).replace(/"type":"([A-Z]+)"/g, (_, t: string) => `"type":"${t.toLowerCase()}"`);
}

async function askGroq(model: string, key: string, prompt: string, schema: unknown, temperature = 0): Promise<Attempt> {
    const text = prompt.length > GROQ_MAX_PROMPT ? `${prompt.slice(0, GROQ_MAX_PROMPT)}\n[… texto recortado]` : prompt;
    let response: Response;
    let body: string;
    try {
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({
                model, temperature,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: `Responde solo con un objeto JSON válido, en español, que cumpla este JSON Schema (todas las claves de "required", y en los campos con "enum" exactamente uno de esos valores):\n${schemaText(schema)}` },
                    { role: 'user', content: text }
                ]
            }),
            signal: AbortSignal.timeout(GROQ_TIMEOUT_MS)
        });
        body = await response.text();
    } catch {
        return { ok: false, status: 504, detail: 'sin respuesta a tiempo', next: true };
    }
    if (!response.ok) return { ok: false, status: response.status, detail: body.slice(0, 300), next: response.status !== 401 };
    try {
        const data = JSON.parse(body);
        return { ok: true, raw: JSON.parse(data.choices?.[0]?.message?.content || '') };
    } catch {
        return { ok: false, status: 502, detail: 'respuesta no válida', next: true };
    }
}

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type Question = { id: string; label: string; help: string; options: string[] };

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function clip(value: unknown, max: number) {
    return String(value ?? '').slice(0, max);
}

function cleanQuestions(list: unknown): Question[] {
    if (!Array.isArray(list)) return [];
    return list.slice(0, 10)
        .filter(q => q && typeof q.id === 'string' && Array.isArray(q.options) && q.options.length)
        .map(q => ({
            id: clip(q.id, 40),
            label: clip(q.label, 200),
            help: clip(q.help, 600),
            options: q.options.slice(0, 6).map((o: unknown) => clip(o, 30))
        }));
}

// Comprueba la sesión con Supabase Auth, usando la misma apikey que envió la página.
async function hasSession(req: Request) {
    const auth = req.headers.get('Authorization') || '';
    const apikey = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    if (!auth.startsWith('Bearer ') || !apikey) return false;
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
        headers: { Authorization: auth, apikey }, signal: AbortSignal.timeout(10000)
    });
    return response.ok;
}

function buildPrompt(idea: Record<string, string>, questions: Question[]) {
    const fields = Object.entries(idea)
        .filter(([, v]) => v.trim())
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n');
    const list = questions
        .map(q => `- ${q.id}: ${q.label}\n  Opciones: ${q.options.join(' | ')}\n  Regla: ${q.help}`)
        .join('\n');
    return `Clasificas ideas de una lluvia de ideas para el Rally Latinoamericano de Innovación (competencia de 28 horas para equipos universitarios de ingeniería en Chile). Es un primer filtro rápido: decide solo con lo que dice la idea.

Reglas:
1. Responde cada pregunta eligiendo exactamente una de sus opciones, siguiendo su regla al pie de la letra.
2. Usa solo la información de la idea. No supongas datos que no están escritos.
3. Si la idea no da información suficiente para una pregunta y existe la opción sin_datos, elige sin_datos.
4. "motivo": una frase corta (máximo 20 palabras) que cite o resuma lo que dice la idea.
5. No reescribas ni mejores la idea.

Preguntas:
${list}

Idea:
${fields}

Además:
- "falta": la información más importante que el equipo debería agregar a la idea, en una frase (vacío si no falta nada).
- "resumen": la idea en una frase de máximo 20 palabras.`;
}

// Esquema de respuesta: cada pregunta limitada a sus opciones.
function responseSchema(questions: Question[]) {
    const properties: Record<string, unknown> = {};
    questions.forEach(q => {
        properties[q.id] = {
            type: 'OBJECT',
            properties: { valor: { type: 'STRING', enum: q.options }, motivo: { type: 'STRING' } },
            required: ['valor', 'motivo']
        };
    });
    properties.falta = { type: 'STRING' };
    properties.resumen = { type: 'STRING' };
    return { type: 'OBJECT', properties, required: [...questions.map(q => q.id), 'falta', 'resumen'] };
}

// Cualquier error inesperado se devuelve como JSON con CORS; si no, el navegador
// solo muestra "Failed to fetch" y no se sabe qué pasó.
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    try {
        return await handle(req);
    } catch (error) {
        console.error(error);
        return json({ error: `Error en filtrar-idea: ${error instanceof Error ? error.message : String(error)}` }, 500);
    }
});

async function handle(req: Request) {
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
    if (!await hasSession(req)) return json({ error: 'Inicia sesión en el workspace para usar el filtro con IA.' }, 401);

    const key = Deno.env.get('GEMINI_API_KEY') || '';
    if (!key && !Deno.env.get('GROQ_API_KEY')) return json({ error: 'Falta el secret GEMINI_API_KEY en Supabase.' }, 500);

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return json({ error: 'Cuerpo inválido' }, 400);
    }
    if (body.mode === 'correlacionar') return correlate(key, body);
    if (body.mode === 'extraer') return extract(key, body);

    const questions = cleanQuestions(body.questions);
    const idea: Record<string, string> = {};
    Object.entries((body.idea || {}) as Record<string, unknown>).slice(0, 20)
        .forEach(([k, v]) => { idea[clip(k, 60)] = clip(v, 2000); });
    if (!questions.length || !Object.values(idea).some(v => v.trim())) return json({ error: 'Faltan la idea o las preguntas.' }, 400);

    const result = await runModels(key, buildPrompt(idea, questions), responseSchema(questions));
    if (result instanceof Response) return result;
    const { raw, model } = result;

    // Solo valores permitidos; uno inválido queda como sin_datos (o vacío si no existe).
    const answers: Record<string, { valor: string; motivo: string }> = {};
    questions.forEach(q => {
        const r = raw[q.id] || {};
        const valor = q.options.includes(String(r.valor)) ? String(r.valor) : (q.options.includes('sin_datos') ? 'sin_datos' : '');
        answers[q.id] = { valor, motivo: clip(r.motivo, 300) };
    });
    return json({ answers, falta: clip(raw.falta, 300), resumen: clip(raw.resumen, 300), model });
}

// Prueba los modelos en orden hasta que uno responda; si ninguno, devuelve la
// respuesta de error para la página.
async function runModels(key: string, prompt: string, schema: unknown,
    { temperature = 0, modelTimeout = MODEL_TIMEOUT_MS, budget = TOTAL_BUDGET_MS } = {}):
    Promise<{ raw: Record<string, Record<string, unknown>>; model: string } | Response> {
    const failures: { model: string; status: number; detail: string }[] = [];
    const started = Date.now();
    let fatal = '';
    // Con respaldo se le da a Gemini la mitad del tiempo, para que Groq alcance a responder
    // antes de que la página deje de esperar.
    const groqKey = (Deno.env.get('GROQ_API_KEY') || '').trim();
    const geminiBudget = groqKey ? budget / 2 : budget;
    for (const candidate of key ? await modelList(key) : []) {
        if (Date.now() - started > geminiBudget) break;
        const attempt = await askModel(candidate, key, prompt, schema, temperature, modelTimeout);
        if (attempt.ok) return { raw: attempt.raw, model: candidate };
        failures.push({ model: candidate, status: attempt.status, detail: attempt.detail });
        if (!attempt.next) {
            fatal = `Gemini respondió ${attempt.status} (${candidate}): ${attempt.detail}`;
            break;
        }
    }
    // Respaldo: si Gemini no respondió, se prueba Groq.
    if (groqKey) {
        for (const candidate of groqModels()) {
            if (Date.now() - started > geminiBudget + modelTimeout + GROQ_TIMEOUT_MS) break;
            const attempt = await askGroq(candidate, groqKey, prompt, schema, temperature);
            if (attempt.ok) return { raw: attempt.raw, model: `groq · ${candidate}` };
            failures.push({ model: `groq · ${candidate}`, status: attempt.status, detail: attempt.detail });
            if (!attempt.next) break;
        }
    }
    if (fatal && !groqKey) return json({ error: fatal }, 502);
    if (!failures.length) return json({ error: 'Gemini respondió 503: no hubo tiempo de probar modelos. Vuelve a intentar.' }, 503);
    const summary = failures.map(f => `${f.model}: ${f.status}`).join(', ');
    if (failures.every(f => f.status === 429)) {
        return json({ error: `Se alcanzó el límite gratuito en todos los modelos (${summary}). Espera un minuto y vuelve a intentar.` }, 429);
    }
    if (failures.some(f => [429, 503, 504].includes(f.status))) {
        return json({ error: `Gemini respondió 503: todos los modelos${groqKey ? ', y el respaldo Groq,' : ''} están saturados o sin cuota (${summary}).` }, 503);
    }
    return json({ error: `Ningún modelo respondió (${summary}). Último error: ${failures[failures.length - 1].detail}` }, 502);
}

// --- Correlaciones entre ideas ---

const RELATION_TYPES = ['duplicada', 'complementaria', 'mismo_problema', 'mismo_beneficiario', 'otra'];
const PROPOSAL_KEYS = ['titulo', 'nombre', 'beneficiario', 'problema', 'descripcion', 'por_que'];

function correlationPrompt(list: { id: string; campos: Record<string, string> }[], stage: string, selection: boolean) {
    const ideas = list.map(i => `### ${i.id}\n${Object.entries(i.campos).filter(([, v]) => v.trim()).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`).join('\n\n');
    const task = selection
        ? `El equipo eligió estas ${list.length} ideas para combinarlas. Devuelve UN solo grupo con todas sus ids y una propuesta que las combine. Si de verdad no tienen ninguna relación útil, devuelve "grupos" vacío y explica por qué en "comentario".`
        : `Busca grupos de 2 o más ideas con una similitud de 40% o más: son la misma idea con otras palabras (duplicada), se complementan y juntas resuelven mejor el problema (complementaria), atacan el mismo problema (mismo_problema) o el mismo beneficiario (mismo_beneficiario). Incluye también los grupos que se parecen pero NO conviene fusionar. Una idea puede estar en un solo grupo. No fuerces relaciones: si no hay, devuelve "grupos" vacío. Máximo 8 grupos, del más similar al menos similar.`;
    return `Ayudas a un equipo universitario de ingeniería en el Rally Latinoamericano de Innovación (competencia de 28 horas en Chile). Tienen ideas de solución en la etapa «${stage}».

${task}

Para cada grupo:
- "ids": las ids de las ideas del grupo, tal como aparecen.
- "tipo": duplicada, complementaria, mismo_problema, mismo_beneficiario u otra.
- "relacion": en una frase, qué las une.
- "similitud": porcentaje entero de 0 a 100 de qué tan parecidas son (100 = la misma idea).
- "fusionar": "si" si se complementan y juntas hacen una propuesta mejor que por separado; "no" si se parecen pero no se complementan (compiten, se contradicen o fusionarlas no suma nada).
- "analisis": en máximo 25 palabras, por qué conviene o no fusionarlas. Rápido, preciso y conciso.
- "propuesta": solo si "fusionar" es "si" (si es "no", deja todos sus textos vacíos): una idea combinada que tome lo mejor de cada una, sin inventar datos que no estén en las ideas: "titulo" (la solución en una frase), "nombre" (corto, opcional), "beneficiario" (concreto), "problema" (el problema que ataca), "descripcion" (qué es y cómo funciona, máximo 60 palabras) y "por_que" (por qué combinada es más fuerte que por separado, una frase).
Además, "comentario": una frase general sobre lo que encontraste.

Ideas:

${ideas}`;
}

function correlationSchema() {
    const text = { type: 'STRING' };
    const proposal = { type: 'OBJECT', properties: Object.fromEntries(PROPOSAL_KEYS.map(k => [k, text])), required: ['titulo', 'beneficiario', 'problema', 'descripcion', 'por_que'] };
    const group = {
        type: 'OBJECT',
        properties: {
            ids: { type: 'ARRAY', items: text }, tipo: { type: 'STRING', enum: RELATION_TYPES }, relacion: text,
            similitud: { type: 'INTEGER' }, fusionar: { type: 'STRING', enum: ['si', 'no'] }, analisis: text, propuesta: proposal
        },
        required: ['ids', 'tipo', 'relacion', 'similitud', 'fusionar', 'analisis', 'propuesta']
    };
    return { type: 'OBJECT', properties: { grupos: { type: 'ARRAY', items: group }, comentario: text }, required: ['grupos', 'comentario'] };
}

async function correlate(key: string, body: Record<string, unknown>) {
    const list = (Array.isArray(body.ideas) ? body.ideas : []).slice(0, 40)
        .filter((i: Record<string, unknown>) => i && typeof i.id === 'string')
        .map((i: Record<string, unknown>) => {
            const campos: Record<string, string> = {};
            Object.entries((i.campos || {}) as Record<string, unknown>).slice(0, 16)
                .forEach(([k, v]) => { campos[clip(k, 60)] = clip(v, 600); });
            return { id: clip(i.id, 20), campos };
        });
    if (list.length < 2) return json({ error: 'Se necesitan al menos 2 ideas para buscar correlaciones.' }, 400);
    const selection = body.seleccion === true;
    const result = await runModels(key, correlationPrompt(list, clip(body.etapa, 40), selection), correlationSchema(),
        { temperature: 0.3, modelTimeout: CORRELATE_MODEL_TIMEOUT_MS, budget: CORRELATE_BUDGET_MS });
    if (result instanceof Response) return result;
    const { raw, model } = result;

    // Solo ids enviadas, sin repetir una idea en dos grupos, y grupos de 2 o más.
    const known = new Set(list.map(i => i.id));
    const used = new Set<string>();
    const grupos: { ids: string[]; tipo: string; relacion: string; similitud: number; fusionar: boolean; analisis: string; propuesta: Record<string, string> }[] = [];
    for (const g of (Array.isArray(raw.grupos) ? raw.grupos : []) as Record<string, unknown>[]) {
        const ids = [...new Set((Array.isArray(g.ids) ? g.ids : []).map(String))].filter(id => known.has(id) && !used.has(id));
        const p = (g.propuesta || {}) as Record<string, unknown>;
        const propuesta = Object.fromEntries(PROPOSAL_KEYS.map(k => [k, clip(p[k], 800)]));
        // Fusionar solo si hay propuesta; si no, el grupo se informa igual (similitud y análisis).
        const fusionar = g.fusionar === 'si' && Boolean(propuesta.titulo.trim());
        if (ids.length < 2) continue;
        ids.forEach(id => used.add(id));
        const similitud = Math.max(0, Math.min(100, Math.round(Number(g.similitud) || 0)));
        grupos.push({
            ids, tipo: RELATION_TYPES.includes(String(g.tipo)) ? String(g.tipo) : 'otra', relacion: clip(g.relacion, 300),
            similitud, fusionar, analisis: clip(g.analisis, 300), propuesta
        });
        if (grupos.length >= 8) break;
    }
    return json({ grupos, comentario: clip(raw.comentario, 400), model });
}

// --- Extracción genérica: tarea + insumos → campos de texto ---

const EXTRACT_MAX_INPUT = 60000;

async function extract(key: string, body: Record<string, unknown>) {
    const tarea = clip(body.tarea, 2000);
    const campos = (Array.isArray(body.campos) ? body.campos : []).slice(0, 16)
        .filter((c: Record<string, unknown>) => c && typeof c.id === 'string')
        .map((c: Record<string, unknown>) => ({
            id: clip(c.id, 40),
            instruccion: clip(c.instruccion, 600),
            opciones: Array.isArray(c.opciones) ? c.opciones.slice(0, 30).map(o => clip(o, 60)) : null
        }));
    const insumos: Record<string, string> = {};
    let room = EXTRACT_MAX_INPUT;
    Object.entries((body.insumos || {}) as Record<string, unknown>).slice(0, 20).forEach(([k, v]) => {
        const text = clip(v, room);
        room -= text.length;
        insumos[clip(k, 60)] = text;
    });
    if (!tarea || !campos.length || !Object.values(insumos).some(v => v.trim())) return json({ error: 'Faltan la tarea, los campos o los insumos.' }, 400);

    const prompt = `${tarea}

Reglas:
1. No inventes cifras, nombres, enlaces ni fuentes.
2. Sé breve y concreto; respeta el largo que pide cada campo.
3. En los campos con opciones, responde exactamente una de ellas.

Campos que debes completar:
${campos.map(c => `- ${c.id}: ${c.instruccion}${c.opciones ? ` Opciones: ${c.opciones.join(' | ')}` : ''}`).join('\n')}

Insumos:
${Object.entries(insumos).filter(([, v]) => v.trim()).map(([k, v]) => `### ${k}\n${v}`).join('\n\n')}`;
    const properties = Object.fromEntries(campos.map(c => [c.id, c.opciones ? { type: 'STRING', enum: c.opciones } : { type: 'STRING' }]));
    const schema = { type: 'OBJECT', properties, required: campos.map(c => c.id) };

    const result = await runModels(key, prompt, schema,
        { temperature: 0.2, modelTimeout: CORRELATE_MODEL_TIMEOUT_MS, budget: CORRELATE_BUDGET_MS });
    if (result instanceof Response) return result;
    const { raw, model } = result;
    const out = Object.fromEntries(campos.map(c => {
        const value = String(raw[c.id] ?? '');
        return [c.id, c.opciones ? (c.opciones.includes(value) ? value : '') : clip(value, 3000)];
    }));
    return json({ campos: out, model });
}
