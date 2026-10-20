const MAX_BODY = 6 * 1024 * 1024;
const MAX_PDF = 5 * 1024 * 1024;

async function sameKey(a, b) {
    const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    const [left, right] = await Promise.all([digest(a), digest(b)]);
    let diff = 0;
    for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
    return diff === 0;
}

export async function handleRequest(request, env, fetchMeta = fetch) {
    const origin = request.headers.get('Origin');
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
    if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) return reply(403, { error: 'Origen no autorizado.' });
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    if (new URL(request.url).pathname !== '/send-quote') return reply(404, { error: 'Ruta no encontrada.' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { error: 'Método no permitido.' });
    if (!env.API_SHARED_KEY || !env.META_ACCESS_TOKEN || !/^\d+$/.test(env.META_PHONE_NUMBER_ID || '')) {
        return reply(503, { error: 'WhatsApp Business aún no está configurado en el servidor.' });
    }
    const auth = request.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ') || !await sameKey(auth.slice(7), env.API_SHARED_KEY)) return reply(401, { error: 'Clave de envío no válida.' });
    if (!request.headers.get('Content-Type')?.startsWith('multipart/form-data;')) return reply(400, { error: 'Se requiere PDF, teléfono y mensaje.' });
    let form;
    try {
        const reader = request.body.getReader();
        const chunks = []; let size = 0;
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > MAX_BODY) { await reader.cancel(); return reply(413, { error: 'El PDF no puede superar 5 MB.' }); }
            chunks.push(value);
        }
        form = await new Response(new Blob(chunks), { headers: { 'Content-Type': request.headers.get('Content-Type') } }).formData();
    } catch { return reply(400, { error: 'No se pudo leer el documento.' }); }
    const file = form.get('file');
    const to = String(form.get('phone') || '');
    const caption = String(form.get('message') || '');
    if (!/^[1-9]\d{7,14}$/.test(to)) return reply(400, { error: 'Teléfono internacional no válido.' });
    if (!caption.trim() || Array.from(caption).length > 1024) return reply(400, { error: 'El mensaje debe tener entre 1 y 1024 caracteres.' });
    if (!file || typeof file.arrayBuffer !== 'function' || file.type !== 'application/pdf' || file.size > MAX_PDF || file.size < 5) return reply(400, { error: 'Seleccione un PDF válido de hasta 5 MB.' });
    if (await file.slice(0, 5).text() !== '%PDF-') return reply(400, { error: 'El archivo no es un PDF.' });
    const filename = String(file.name || 'Presupuesto.pdf').replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 120);
    const base = `https://graph.facebook.com/v23.0/${env.META_PHONE_NUMBER_ID}`;
    const metaHeaders = { Authorization: `Bearer ${env.META_ACCESS_TOKEN}` };
    const metaError = data => {
        const code = data?.error?.code;
        if (code === 131047) return 'Meta requiere una plantilla aprobada fuera de la ventana de atención de 24 horas. Solicite al cliente que escriba al número de la empresa antes de enviar esta cotización.';
        if (code === 131030) return 'El destinatario no está autorizado en el modo de prueba de Meta.';
        return 'Meta no aceptó el envío. Revise el número, permisos y configuración de WhatsApp Business.';
    };
    try {
        const upload = new FormData();
        upload.set('messaging_product', 'whatsapp');
        upload.set('type', 'application/pdf');
        upload.set('file', file, filename);
        const mediaResponse = await fetchMeta(`${base}/media`, { method: 'POST', headers: metaHeaders, body: upload });
        const media = await mediaResponse.json();
        if (!mediaResponse.ok || !media.id) return reply(502, { error: metaError(media) });
        const sendResponse = await fetchMeta(`${base}/messages`, {
            method: 'POST', headers: { ...metaHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'document', document: { id: media.id, caption, filename } })
        });
        const sent = await sendResponse.json();
        if (!sendResponse.ok || !sent.messages?.[0]?.id) return reply(502, { error: metaError(sent) });
        return reply(200, { accepted: true, messageId: sent.messages[0].id });
    } catch { return reply(502, { error: 'No se pudo confirmar el envío con Meta. Revise antes de reintentar para evitar duplicados.' }); }
}

export default { fetch(request, env) { return handleRequest(request, env); } };
