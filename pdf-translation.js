const PDF_LANGUAGES = { es:'Español', en:'Inglés', pt:'Portugués', fr:'Francés', de:'Alemán', it:'Italiano', nl:'Neerlandés', pl:'Polaco', ro:'Rumano', ru:'Ruso', sv:'Sueco', tr:'Turco' };
// Short legal/quotation labels need context that generic translation may miss.
const PDF_TERMS = {
    en: { 'COTIZACIÓN':'QUOTATION', 'DATOS DE LA FIRMA JURÍDICA:':'LAW FIRM DETAILS:', 'Cantidad':'QUANTITY', 'Precio unitario':'UNIT PRICE', 'MÉTODOS DE PAGO:':'PAYMENT METHODS:', 'Fotos tamaño carnet':'Passport-sized photos', 'Pasaporte vigente':'Valid passport' },
    pt: { 'COTIZACIÓN':'ORÇAMENTO', 'DATOS DE LA FIRMA JURÍDICA:':'DADOS DO ESCRITÓRIO DE ADVOCACIA:', 'Cantidad':'QUANTIDADE', 'Precio unitario':'PREÇO UNITÁRIO', 'MÉTODOS DE PAGO:':'FORMAS DE PAGAMENTO:', 'Fotos tamaño carnet':'Fotografias tipo passe', 'Pasaporte vigente':'Passaporte válido' },
    fr: { 'COTIZACIÓN':'DEVIS', 'DATOS DE LA FIRMA JURÍDICA:':"COORDONNÉES DU CABINET D’AVOCATS :", 'Cantidad':'QUANTITÉ', 'Precio unitario':'PRIX UNITAIRE', 'MÉTODOS DE PAGO:':'MODES DE PAIEMENT :', 'Fotos tamaño carnet':"Photos d’identité", 'Pasaporte vigente':'Passeport en cours de validité' },
    de: { 'COTIZACIÓN':'ANGEBOT' }, it: { 'COTIZACIÓN':'PREVENTIVO' }, nl: { 'COTIZACIÓN':'OFFERTE' },
    pl: { 'COTIZACIÓN':'WYCENA' }, ro: { 'COTIZACIÓN':'OFERTĂ' }, ru: { 'COTIZACIÓN':'КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ' },
    sv: { 'COTIZACIÓN':'OFFERT' }, tr: { 'COTIZACIÓN':'FİYAT TEKLİFİ' }
};
let clientPdfTranslation = null;
let pdfTranslationAbort = null;
const pdfTranslationCache = new Map();

function resetPdfTranslation() {
    pdfTranslationAbort?.abort();
    clientPdfTranslation = null;
    const status = document.getElementById('pdfLanguageStatus');
    if (status) status.textContent = 'PDF del cliente: español original. La interfaz del ejecutivo permanece en español.';
}

function clientPdfHTML(data) {
    const original = generatePdfHTML(data);
    if (clientPdfTranslation?.original === original) return clientPdfTranslation.html;
    if (clientPdfTranslation) resetPdfTranslation();
    return original;
}

function clientPdfLanguage(data) {
    return clientPdfTranslation?.original === generatePdfHTML(data) ? clientPdfTranslation.language : 'es';
}

function translationNumbers(text) {
    return JSON.stringify(text.match(/\d+(?:[.,]\d+)*/g) || []);
}

async function onlinePdfText(text, source, target, signal) {
    // MyMemory's documented q limit is 500 UTF-8 bytes, not 500 characters.
    const chunks = [];
    let chunk = '';
    for (const word of text.match(/\S+\s*|\s+/gu) || []) {
        if (new TextEncoder().encode(word).length > 450) throw new Error('Hay un bloque de texto demasiado largo sin espacios. Sepárelo antes de traducir en línea.');
        if (new TextEncoder().encode(chunk + word).length > 450) { chunks.push(chunk.trim()); chunk = ''; }
        chunk += word;
    }
    if (chunk.trim()) chunks.push(chunk.trim());
    const translated = [];
    for (const part of chunks) {
        signal.throwIfAborted();
        const url = new URL('https://api.mymemory.translated.net/get');
        url.searchParams.set('q', part);
        url.searchParams.set('langpair', `${source}|${target}`);
        const response = await fetch(url, { signal:AbortSignal.any([signal, AbortSignal.timeout(30000)]), referrerPolicy:'no-referrer' });
        if (!response.ok) throw new Error('El servicio de traducción no está disponible. Intente más tarde.');
        const data = await response.json();
        if (Number(data.responseStatus) !== 200 || data.quotaFinished || !data.responseData?.translatedText) {
            throw new Error('El servicio de traducción rechazó la solicitud o alcanzó su límite diario. No se generó un PDF parcialmente traducido.');
        }
        // Fuzzy memory matches can add requirements that were not in the quote.
        const words = value => value.normalize('NFC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
        const exact = data.matches?.find(match => typeof match.segment === 'string' && words(match.segment) === words(part));
        let result = exact?.translation || (Number(data.responseData.match) === 1 ? data.responseData.translatedText : null);
        if (typeof result !== 'string' || !result.trim()) throw new Error('No se obtuvo una traducción del texto exacto. Intente de nuevo o use un navegador con traducción integrada.');
        const punctuation = part.match(/[:;]$/)?.[0];
        if (punctuation && !result.endsWith(punctuation)) result += punctuation;
        const decoder = document.createElement('textarea');
        decoder.innerHTML = result;
        translated.push(decoder.value);
    }
    return translated.join(' ');
}

async function pdfTextTranslator(source, target, signal, status) {
    if (source === target) return { translate:async text=>text, destroy() {} };
    if ('Translator' in window) {
        try {
            const availability = await window.Translator.availability({ sourceLanguage:source, targetLanguage:target });
            if (availability !== 'unavailable') {
                const translator = await window.Translator.create({ sourceLanguage:source, targetLanguage:target, signal, monitor(monitor) {
                    monitor.addEventListener('downloadprogress', event => {
                        status.textContent = `Descargando traductor del navegador: ${Math.round(event.loaded * 100)}%.`;
                    });
                }});
                if (signal.aborted) { translator.destroy(); signal.throwIfAborted(); }
                return { translate:text=>translator.translate(text, { signal }), destroy:()=>translator.destroy() };
            }
        } catch (error) { if (signal.aborted) throw error; }
    }
    status.textContent = 'Traduciendo en línea con MyMemory. Se envían los textos a traducir; el servicio tiene límites de uso.';
    return { translate:text=>onlinePdfText(text, source, target, signal), destroy() {} };
}

function pdfTranslationNodes(root, customSource) {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
        const node = walker.currentNode;
        const text = node.nodeValue.trim();
        if (!/\p{L}/u.test(text) || node.parentElement.closest('[translate="no"], script, style, svg')) continue;
        const expanded = { 'CANT':'Cantidad', 'PRECIO UNIT':'Precio unitario', 'Nº:':'Número:' }[text] || text;
        nodes.push({ node, text:typeof expanded === 'string' ? expanded : text, originalText:text, source:node.parentElement.closest('[data-translation-source="custom"]') ? customSource : 'es' });
    }
    return nodes;
}

async function translateClientPdf() {
    if (!lastQuoteData || pdfTranslationAbort) return;
    const source = document.getElementById('pdfSourceLanguage').value;
    const target = document.getElementById('pdfTargetLanguage').value;
    if (!Object.hasOwn(PDF_LANGUAGES, source) || !Object.hasOwn(PDF_LANGUAGES, target)) return;
    const data = structuredClone(lastQuoteData);
    const original = generatePdfHTML(data);
    const root = document.createElement('div');
    root.innerHTML = original;
    const nodes = pdfTranslationNodes(root, source);
    const status = document.getElementById('pdfTranslationProgress');
    const button = document.getElementById('confirmPdfTranslation');
    const controller = new AbortController();
    pdfTranslationAbort = controller;
    button.disabled = true;
    const translators = new Map();
    try {
        status.textContent = 'Preparando la traducción completa del documento…';
        await Promise.all([...new Set(nodes.map(item=>item.source))].map(async language => {
            translators.set(language, await pdfTextTranslator(language, target, controller.signal, status));
        }));
        for (let index = 0; index < nodes.length; index++) {
            controller.signal.throwIfAborted();
            const {node,text,originalText,source:language} = nodes[index];
            const key = JSON.stringify([language,target,text]);
            const term = language === 'es' ? PDF_TERMS[target]?.[text] : null;
            let translated = typeof term === 'string' ? term : pdfTranslationCache.get(key);
            if (!translated) {
                translated = await translators.get(language).translate(text);
                if (typeof translated !== 'string' || !translated.trim()) throw new Error('El traductor devolvió un texto vacío.');
                if (translationNumbers(text) !== translationNumbers(translated)) throw new Error('La traducción cambió un número del documento. Revise el texto antes de continuar.');
                pdfTranslationCache.set(key, translated);
            }
            node.nodeValue = node.nodeValue.replace(originalText, () => translated);
            status.textContent = `Traduciendo documento: ${index + 1} de ${nodes.length} textos.`;
        }
        controller.signal.throwIfAborted();
        if (original !== generatePdfHTML(lastQuoteData)) throw new Error('La cotización cambió. Vuelva a traducir la versión actual.');
        root.firstElementChild.lang = target;
        const translatedDocument = { original, html:root.innerHTML, language:target };
        const file = await buildPdfFile(data, translatedDocument);
        controller.signal.throwIfAborted();
        if (original !== generatePdfHTML(lastQuoteData)) throw new Error('La cotización cambió mientras se preparaba el PDF. Vuelva a traducir.');
        clientPdfTranslation = translatedDocument;
        document.getElementById('pdfLanguageStatus').textContent = `PDF del cliente: ${PDF_LANGUAGES[target]}. Descargas, vista previa y WhatsApp utilizarán esta versión; el formulario sigue en español.`;
        downloadPdfFile(file);
        document.getElementById('pdfTranslationModal').classList.remove('active');
    } catch (error) {
        if (error.name !== 'AbortError') status.textContent = `No se completó la traducción: ${error.message}`;
    } finally {
        translators.forEach(translator=>translator.destroy());
        pdfTranslationAbort = null;
        button.disabled = false;
    }
}

function initPdfTranslation() {
    for (const id of ['pdfSourceLanguage','pdfTargetLanguage']) {
        const select = document.getElementById(id);
        for (const [code,name] of Object.entries(PDF_LANGUAGES)) {
            const option = document.createElement('option'); option.value=code; option.textContent=name; select.appendChild(option);
        }
    }
    document.getElementById('pdfSourceLanguage').value = 'es';
    document.getElementById('pdfTargetLanguage').value = 'en';
    document.getElementById('translateQuoteBtn').addEventListener('click', () => {
        if (!lastQuoteData) return;
        document.getElementById('pdfTranslationProgress').textContent = '';
        document.getElementById('pdfTranslationModal').classList.add('active');
    });
    document.getElementById('confirmPdfTranslation').addEventListener('click', translateClientPdf);
    document.getElementById('cancelPdfTranslation').addEventListener('click', () => {
        pdfTranslationAbort?.abort();
        document.getElementById('pdfTranslationModal').classList.remove('active');
    });
    document.getElementById('pdfTranslationModal').addEventListener('click', event => {
        if (event.target === event.currentTarget) { pdfTranslationAbort?.abort(); event.currentTarget.classList.remove('active'); }
    });
    document.getElementById('originalPdfBtn').addEventListener('click', resetPdfTranslation);
    resetPdfTranslation();
}
