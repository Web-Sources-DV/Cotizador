function whatsappBudgetMessage(data) {
    const signature = getUsers()[currentUser]?.signature || 'Saludos cordiales,\nSQP LEGAL CONSULTING.';
    return `Hola ${data.client || 'Cliente'}, te comparto el presupuesto para "${data.procedure}" con un total de $${(data.total || 0).toFixed(2)} USD.\n\n${signature}`;
}

let businessSendInProgress = false;
function initWhatsAppBusiness() {
    const button = document.getElementById('businessWhatsAppBtn');
    const endpoint = window.WHATSAPP_BUSINESS_CONFIG?.endpoint;
    button.disabled = !endpoint;
    document.getElementById('businessWhatsAppStatus').textContent = endpoint
        ? 'El envío automático usa el número de WhatsApp Business de la empresa. Meta debe autorizar al destinatario o la conversación.'
        : 'El envío de PDF y mensaje por WhatsApp aún no está activado. Solicite al administrador que habilite el servicio.';
    button.addEventListener('click', sendBusinessQuote);
}

async function sendBusinessQuote() {
    if (businessSendInProgress || !lastQuoteData) return;
    const endpoint = window.WHATSAPP_BUSINESS_CONFIG?.endpoint;
    if (!endpoint) { alert('Falta activar WhatsApp Business Cloud API y el servidor de envío.'); return; }
    let url;
    try { url = new URL(endpoint); if (url.protocol !== 'https:' || url.pathname !== '/send-quote') throw new Error(); }
    catch { alert('La dirección del servidor WhatsApp Business no es válida.'); return; }
    const phone = normalizeWhatsAppPhone(lastQuoteData.phone);
    if (!phone) { alert('Revise el teléfono del cliente en la cotización.'); return; }
    const message = whatsappBudgetMessage(lastQuoteData);
    if (Array.from(message).length > 1024) { alert('Acorte la firma o el mensaje a un máximo de 1024 caracteres para enviarlo junto al PDF.'); return; }
    if (!confirm(`¿Enviar PDF y mensaje al +${phone} desde el WhatsApp Business de la empresa?`)) return;
    // Never store the operator key or the Meta token in the public site or localStorage.
    const key = prompt('Clave de envío del servidor de WhatsApp Business (solicítela al administrador):');
    if (!key) return;
    const snapshot = structuredClone(lastQuoteData);
    const button = document.getElementById('businessWhatsAppBtn');
    const status = document.getElementById('businessWhatsAppStatus');
    businessSendInProgress = true;
    button.disabled = true;
    try {
        const file = await buildPdfFile(snapshot);
        const body = new FormData();
        body.set('file', file); body.set('phone', phone); body.set('message', message);
        status.textContent = 'Enviando PDF y mensaje a WhatsApp Business…';
        const response = await fetch(url.href, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body });
        const result = await response.json();
        if (!response.ok || !result.accepted || !result.messageId) throw new Error(result.error || 'Meta no confirmó la recepción del documento.');
        status.textContent = `Meta aceptó el PDF y el mensaje para +${phone}. Esto no confirma entrega ni lectura.`;
        const quotes = getQuotes();
        const stored = quotes.find(quote => quote.quote_number === snapshot.quote_number);
        if (stored) {
            stored.whatsapp_message_id = result.messageId;
            stored.whatsapp_accepted_at = new Date().toISOString();
            saveQuotes(quotes);
        }
    } catch (error) {
        status.textContent = `No se pudo confirmar el envío: ${error.message}. Revise antes de reintentar para evitar duplicados.`;
    } finally { businessSendInProgress = false; button.disabled = false; }
}
