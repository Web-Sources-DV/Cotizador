function whatsappBudgetMessage(data) {
    const signature = getUsers()[currentUser]?.signature || 'Saludos cordiales,\nSQP LEGAL CONSULTING.';
    return `Hola ${data.client || 'Cliente'}, te comparto el presupuesto para "${data.procedure}" con un total de $${(data.total || 0).toFixed(2)} USD.\n\n${signature}`;
}

let businessSendInProgress = false;
function initWhatsAppBusiness() {
    const button = document.getElementById('businessWhatsAppBtn');
    const endpoint = window.WHATSAPP_BUSINESS_CONFIG?.endpoint;
    button.disabled = false;
    document.getElementById('businessWhatsAppStatus').textContent = endpoint
        ? 'WhatsApp Web descarga el PDF y abre el chat para adjuntarlo. Business usa el envío automático desde el número de la empresa.'
        : 'Ambos botones descargan el PDF y preparan el mensaje para el número del cliente. Adjunte el archivo y confirme el envío en WhatsApp. Business abre la aplicación que el dispositivo tenga asociada a WhatsApp; si tiene ambas apps, elija Business.';
    document.getElementById('webWhatsAppBtn').addEventListener('click', () => openWhatsAppWithPdf('web'));
    button.addEventListener('click', sendBusinessQuote);
}

let localWhatsAppInProgress = false;
async function openWhatsAppWithPdf(mode) {
    if (localWhatsAppInProgress || businessSendInProgress) return;
    if (!lastQuoteData) { alert('Genere una cotización primero.'); return; }
    const snapshot = structuredClone(lastQuoteData);
    const phone = normalizeWhatsAppPhone(snapshot.phone);
    if (!phone) { alert('Revise el teléfono del cliente en la cotización.'); return; }
    const message = encodeURIComponent(whatsappBudgetMessage(snapshot));
    const url = mode === 'web'
        ? `https://web.whatsapp.com/send?phone=${phone}&text=${message}`
        : `https://wa.me/${phone}?text=${message}`;
    // Reserve the tab during the click, before generating the PDF asynchronously.
    const chat = window.open('about:blank', '_blank');
    if (chat) {
        chat.opener = null;
        chat.document.title = 'Preparando cotización';
        chat.document.body.textContent = 'Preparando PDF y mensaje para WhatsApp…';
    }
    const status = document.getElementById('businessWhatsAppStatus');
    localWhatsAppInProgress = true;
    const buttons = ['webWhatsAppBtn', 'businessWhatsAppBtn'].map(id => document.getElementById(id));
    buttons.forEach(button => button.disabled = true);
    try {
        status.textContent = 'Preparando PDF y mensaje…';
        const file = await buildPdfFile(snapshot);
        downloadPdfFile(file);
        const explanation = `Se preparó la descarga del PDF para +${phone}. Adjunte ese archivo en el chat y pulse Enviar. `;
        if (chat && !chat.closed) {
            chat.location.replace(url);
            status.textContent = explanation;
        } else {
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = `Abrir chat del cliente +${phone}`;
            status.replaceChildren(document.createTextNode(explanation + 'El navegador bloqueó o cerró la ventana. '), link);
        }
    } catch (error) {
        if (chat && !chat.closed) chat.close();
        status.textContent = `No se pudo preparar el PDF: ${error.message}. No se abrió el chat del cliente.`;
    } finally {
        localWhatsAppInProgress = false;
        buttons.forEach(button => button.disabled = false);
    }
}

async function sendBusinessQuote() {
    if (businessSendInProgress || localWhatsAppInProgress || !lastQuoteData) return;
    const endpoint = window.WHATSAPP_BUSINESS_CONFIG?.endpoint;
    if (!endpoint) return openWhatsAppWithPdf('business');
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
