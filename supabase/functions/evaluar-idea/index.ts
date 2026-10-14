// Edge Function: evalúa una idea con un modelo de IA según los criterios del jurado
// del Rally y la matriz de integración de IA. La clave del modelo vive solo aquí
// (secrets de Supabase), nunca en el navegador.
//
// Secrets (Supabase → Edge Functions → Secrets, o `supabase secrets set`):
//   AI_PROVIDER  gemini | openai | anthropic   (por defecto: gemini)
//   AI_API_KEY   clave del proveedor elegido
//   AI_MODEL     opcional; si falta se usa el modelo por defecto del proveedor
// SUPABASE_URL y SUPABASE_ANON_KEY los entrega Supabase automáticamente.

const DEFAULT_MODELS: Record<string, string> = {
    gemini: 'gemini-2.5-flash',
    openai: 'gpt-4o-mini',
    anthropic: 'claude-haiku-5-5'
};

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type Criterion = { id: string; label: string; hint?: string };

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function clip(value: unknown, max: number) {
    return String(value ?? '').slice(0, max);
}

function cleanCriteria(list: unknown): Criterion[] {
    if (!Array.isArray(list)) return [];
    return list.slice(0, 12)
        .filter(c => c && typeof c.id === 'string' && typeof c.label === 'string')
        .map(c => ({ id: clip(c.id, 40), label: clip(c.label, 120), hint: clip(c.hint, 400) }));
}

// Solo usuarios con sesión en el workspace pueden usar la función.
async function userFromToken(req: Request) {
    const auth = req.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) return null;
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
        headers: { Authorization: auth, apikey: Deno.env.get('SUPABASE_ANON_KEY') || '' }
    });
    return response.ok ? await response.json() : null;
}

function buildPrompt(idea: Record<string, string>, criteria: Criterion[], aiMatrix: Criterion[]) {
    const fields = Object.entries(idea)
        .filter(([, v]) => v.trim())
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n');
    const list = (cs: Criterion[]) => cs.map(c => `- ${c.id}: ${c.label}${c.hint ? ` (${c.hint})` : ''}`).join('\n');
    return `Eres jurado del Rally Latinoamericano de Innovación 2026 (competencia de 28 horas para equipos universitarios de ingeniería).
Evalúa la idea del equipo con honestidad y exigencia, como lo haría el jurado. No reescribas la idea ni redactes la propuesta por el equipo:
las bases descalifican el abuso de inteligencia artificial. Entrega solo diagnóstico y sugerencias concretas de qué reforzar.

Criterios del jurado (puntaje entero 1 a 5; 1 = muy débil, 3 = aceptable, 5 = excelente):
${list(criteria)}

Matriz de integración de IA (puntaje entero 1 a 5). Si la idea no usa inteligencia artificial, pon score null en todos:
${list(aiMatrix)}

Si falta información para evaluar un criterio, puntúa bajo y dilo en la justificación.

Idea del equipo:
${fields}

Responde SOLO con un objeto JSON válido, sin texto adicional, con esta forma:
{
  "criterios": [{ "id": "<id>", "score": <1-5>, "justificacion": "<1-2 frases>", "mejora": "<qué hacer para subir el puntaje>" }],
  "matriz_ia": [{ "id": "<id>", "score": <1-5 o null>, "justificacion": "<1 frase>", "mejora": "<1 frase>" }],
  "usa_ia": <true|false>,
  "fortalezas": ["<máx. 3>"],
  "mejoras_prioritarias": ["<máx. 3, las de mayor impacto en el puntaje>"],
  "veredicto": "<fuerte | prometedora | debil>",
  "resumen": "<2 frases>"
}`;
}

async function callModel(provider: string, model: string, key: string, prompt: string): Promise<string> {
    let response: Response;
    if (provider === 'gemini') {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3, responseMimeType: 'application/json' }
            })
        });
    } else if (provider === 'openai') {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({
                model, temperature: 0.3, response_format: { type: 'json_object' },
                messages: [{ role: 'user', content: prompt }]
            })
        });
    } else if (provider === 'anthropic') {
        response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model, max_tokens: 2000, temperature: 0.3, messages: [{ role: 'user', content: prompt }] })
        });
    } else {
        throw new Error(`AI_PROVIDER desconocido: ${provider}`);
    }
    const text = await response.text();
    if (!response.ok) throw new Error(`El proveedor respondió ${response.status}: ${text.slice(0, 300)}`);
    const data = JSON.parse(text);
    if (provider === 'gemini') return data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
    if (provider === 'openai') return data.choices?.[0]?.message?.content || '';
    return (data.content || []).map((p: { text?: string }) => p.text || '').join('');
}

function parseJson(text: string) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('La IA no devolvió JSON');
    return JSON.parse(text.slice(start, end + 1));
}

// Deja solo criterios conocidos y puntajes enteros 1–5; uno inválido queda en null.
function normalizeRows(rows: unknown, criteria: Criterion[]) {
    const byId = new Map((Array.isArray(rows) ? rows : []).map((r: Record<string, unknown>) => [String(r?.id), r]));
    return criteria.map(c => {
        const r = (byId.get(c.id) || {}) as Record<string, unknown>;
        const n = Math.round(Number(r.score));
        const score = n >= 1 && n <= 5 ? n : null;
        return { id: c.id, score, justificacion: clip(r.justificacion, 500), mejora: clip(r.mejora, 500) };
    });
}

function textList(value: unknown) {
    return (Array.isArray(value) ? value : []).slice(0, 3).map(v => clip(v, 300)).filter(Boolean);
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

    if (!await userFromToken(req)) return json({ error: 'Inicia sesión en el workspace para usar la evaluación con IA.' }, 401);

    const key = Deno.env.get('AI_API_KEY');
    if (!key) return json({ error: 'Falta el secret AI_API_KEY en Supabase.' }, 500);
    const provider = (Deno.env.get('AI_PROVIDER') || 'gemini').toLowerCase();
    const model = Deno.env.get('AI_MODEL') || DEFAULT_MODELS[provider] || '';

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return json({ error: 'Cuerpo inválido' }, 400);
    }
    const criteria = cleanCriteria(body.criteria);
    const aiMatrix = cleanCriteria(body.ai_matrix);
    const idea: Record<string, string> = {};
    Object.entries((body.idea || {}) as Record<string, unknown>).slice(0, 40)
        .forEach(([k, v]) => { idea[clip(k, 60)] = clip(v, 2000); });
    if (!criteria.length || !Object.values(idea).some(v => v.trim())) return json({ error: 'Faltan la idea o los criterios.' }, 400);

    try {
        const raw = parseJson(await callModel(provider, model, key, buildPrompt(idea, criteria, aiMatrix)));
        const usaIa = raw.usa_ia === true;
        const veredicto = ['fuerte', 'prometedora', 'debil'].includes(raw.veredicto) ? raw.veredicto : 'prometedora';
        return json({
            criterios: normalizeRows(raw.criterios, criteria),
            matriz_ia: normalizeRows(usaIa ? raw.matriz_ia : [], aiMatrix),
            usa_ia: usaIa,
            fortalezas: textList(raw.fortalezas),
            mejoras_prioritarias: textList(raw.mejoras_prioritarias),
            veredicto,
            resumen: clip(raw.resumen, 600),
            provider,
            model
        });
    } catch (error) {
        console.error(error);
        return json({ error: `No se pudo evaluar: ${(error as Error).message}` }, 502);
    }
});
