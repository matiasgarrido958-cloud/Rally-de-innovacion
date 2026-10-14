// Edge Function: primer filtro de una idea con Gemini.
// Gemini solo responde preguntas cerradas sobre lo que dice la idea; el veredicto
// (pasa / dudosa / no pasa) lo calcula la página con una regla fija.
// Las preguntas vienen de AI_TRIAGE en js/lineamientos.js.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   GEMINI_API_KEY  clave de Google AI Studio (https://aistudio.google.com/apikey)
//   GEMINI_MODELS   opcional; modelos preferidos en orden, separados por comas.
//                   Sin esto, la función detecta sola los modelos Gemini disponibles
//                   para la clave y los ordena (flash, luego lite, luego pro; versión
//                   más nueva primero). Si uno está saturado, sin cuota o falla, usa
//                   el siguiente: la cuota gratuita es por modelo.
// Deja activado "Verify JWT": solo usuarios con sesión en el workspace pueden usarla.

const DEFAULT_MODEL = 'gemini-3.8-flash';

const MAX_MODELS_PER_REQUEST = 8;
// Límites de tiempo: Supabase corta la función si tarda demasiado y el navegador
// solo ve "no se pudo conectar". Cada modelo tiene MODEL_TIMEOUT_MS y no se prueban
// modelos nuevos después de TOTAL_BUDGET_MS.
const MODEL_TIMEOUT_MS = 15000;
const TOTAL_BUDGET_MS = 35000;
const DISCOVERY_TTL_MS = 60 * 60 * 1000;
let discovered: { at: number; models: string[] } | null = null;

// Tolera valores pegados con espacios, comillas o el prefijo "models/".
function cleanModel(m: string) {
    return m.trim().replace(/^["']|["']$/g, '').replace(/^models\//, '').trim();
}

function preferredModels() {
    const raw = Deno.env.get('GEMINI_MODELS') || Deno.env.get('GEMINI_MODEL') || '';
    return raw.split(/[,\n]/).map(cleanModel).filter(Boolean);
}

// Orden: flash, lite, otros, pro; estables antes que preview; versión más nueva primero.
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
        discovered = { at: Date.now(), models };
        return models;
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

async function askModel(model: string, key: string, prompt: string, schema: unknown): Promise<Attempt> {
    let response: Response;
    let text: string;
    try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: schema }
            }),
            signal: AbortSignal.timeout(MODEL_TIMEOUT_MS)
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

    const key = Deno.env.get('GEMINI_API_KEY');
    if (!key) return json({ error: 'Falta el secret GEMINI_API_KEY en Supabase.' }, 500);

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return json({ error: 'Cuerpo inválido' }, 400);
    }
    const questions = cleanQuestions(body.questions);
    const idea: Record<string, string> = {};
    Object.entries((body.idea || {}) as Record<string, unknown>).slice(0, 20)
        .forEach(([k, v]) => { idea[clip(k, 60)] = clip(v, 2000); });
    if (!questions.length || !Object.values(idea).some(v => v.trim())) return json({ error: 'Faltan la idea o las preguntas.' }, 400);

    const prompt = buildPrompt(idea, questions);
    const schema = responseSchema(questions);
    const failures: { model: string; status: number; detail: string }[] = [];
    let raw: Record<string, Record<string, unknown>> | null = null;
    let model = '';
    const started = Date.now();
    for (const candidate of await modelList(key)) {
        if (Date.now() - started > TOTAL_BUDGET_MS) break;
        const attempt = await askModel(candidate, key, prompt, schema);
        if (attempt.ok) {
            raw = attempt.raw;
            model = candidate;
            break;
        }
        failures.push({ model: candidate, status: attempt.status, detail: attempt.detail });
        if (!attempt.next) return json({ error: `Gemini respondió ${attempt.status} (${candidate}): ${attempt.detail}` }, 502);
    }
    if (!raw) {
        if (!failures.length) return json({ error: 'Gemini respondió 503: no hubo tiempo de probar modelos. Vuelve a intentar.' }, 503);
        const summary = failures.map(f => `${f.model}: ${f.status}`).join(', ');
        if (failures.every(f => f.status === 429)) {
            return json({ error: `Se alcanzó el límite gratuito de Gemini en todos los modelos (${summary}). Espera un minuto y vuelve a intentar.` }, 429);
        }
        if (failures.some(f => [429, 503, 504].includes(f.status))) {
            return json({ error: `Gemini respondió 503: todos los modelos están saturados o sin cuota (${summary}).` }, 503);
        }
        return json({ error: `Ningún modelo respondió (${summary}). Último error: ${failures[failures.length - 1].detail}` }, 502);
    }

    // Solo valores permitidos; uno inválido queda como sin_datos (o vacío si no existe).
    const answers: Record<string, { valor: string; motivo: string }> = {};
    questions.forEach(q => {
        const r = raw[q.id] || {};
        const valor = q.options.includes(String(r.valor)) ? String(r.valor) : (q.options.includes('sin_datos') ? 'sin_datos' : '');
        answers[q.id] = { valor, motivo: clip(r.motivo, 300) };
    });
    return json({ answers, falta: clip(raw.falta, 300), resumen: clip(raw.resumen, 300), model });
}
