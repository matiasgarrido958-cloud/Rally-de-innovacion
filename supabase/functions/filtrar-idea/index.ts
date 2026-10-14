// Edge Function: primer filtro de una idea con Gemini.
// Gemini solo responde preguntas cerradas sobre lo que dice la idea; el veredicto
// (pasa / dudosa / no pasa) lo calcula la página con una regla fija.
// Las preguntas vienen de AI_TRIAGE en js/lineamientos.js.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   GEMINI_API_KEY  clave de Google AI Studio (https://aistudio.google.com/apikey)
//   GEMINI_MODEL    opcional; por defecto gemini-2.5-flash
// Deja activado "Verify JWT": solo usuarios con sesión en el workspace pueden usarla.

const DEFAULT_MODEL = 'gemini-2.5-flash';

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
        headers: { Authorization: auth, apikey }
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

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
    if (!await hasSession(req)) return json({ error: 'Inicia sesión en el workspace para usar el filtro con IA.' }, 401);

    const key = Deno.env.get('GEMINI_API_KEY');
    if (!key) return json({ error: 'Falta el secret GEMINI_API_KEY en Supabase.' }, 500);
    const model = Deno.env.get('GEMINI_MODEL') || DEFAULT_MODEL;

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

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: buildPrompt(idea, questions) }] }],
            generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: responseSchema(questions) }
        })
    });
    const text = await response.text();
    if (response.status === 429) return json({ error: 'Se alcanzó el límite gratuito de Gemini. Espera un minuto y vuelve a intentar.' }, 429);
    if (!response.ok) return json({ error: `Gemini respondió ${response.status}: ${text.slice(0, 300)}` }, 502);

    let raw: Record<string, Record<string, unknown>>;
    try {
        const data = JSON.parse(text);
        const out = (data.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
        raw = JSON.parse(out);
    } catch {
        return json({ error: 'Gemini no devolvió una respuesta válida. Intenta de nuevo.' }, 502);
    }

    // Solo valores permitidos; uno inválido queda como sin_datos (o vacío si no existe).
    const answers: Record<string, { valor: string; motivo: string }> = {};
    questions.forEach(q => {
        const r = raw[q.id] || {};
        const valor = q.options.includes(String(r.valor)) ? String(r.valor) : (q.options.includes('sin_datos') ? 'sin_datos' : '');
        answers[q.id] = { valor, motivo: clip(r.motivo, 300) };
    });
    return json({ answers, falta: clip(raw.falta, 300), resumen: clip(raw.resumen, 300), model });
});
