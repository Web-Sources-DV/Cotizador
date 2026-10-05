/**
 * ================================================================
 *  SQP LEGAL CONSULTING - Cotizador Jurídico
 *  JavaScript principal (versión final - sin IVA, 1 página, sin cortes)
 * ================================================================
 */

// ================================================================
//  CONSTANTES
// ================================================================
const USERS_KEY = 'sqp_users_v4';
const QUOTES_KEY = 'sqp_quotes';
const COUNTER_KEY = 'sqp_counter';
const TEMPLATES_KEY = 'sqp_templates';
const SUGGESTIONS_KEY = 'sqp_suggestions';
const SESSION_KEY = 'sqp_session';

// ⚠️ MENSAJE FIJO NO MODIFICABLE - Aparece siempre en el PDF
const FIXED_OBSERVATIONS_MESSAGE = "Condiciones del trámite: Una vez abonados los $25 de apertura del trámite, no se aceptan devoluciones ni cancelaciones. Transcurrido un (1) año desde el abono, la factura se cierra y no procede la devolución del dinero.";

let currentUser = null;
let currentRole = null;
let lastQuoteData = null;
let pendingGenerate = null;

// ================================================================
//  PERSISTENCIA LOCALSTORAGE
// ================================================================
function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); } catch { return {}; }
}
function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }
function getQuotes() {
    try { return JSON.parse(localStorage.getItem(QUOTES_KEY) || '[]'); } catch { return []; }
}
function saveQuotes(q) { localStorage.setItem(QUOTES_KEY, JSON.stringify(q)); }
function getCounter() {
    try { return parseInt(localStorage.getItem(COUNTER_KEY) || '0'); } catch { return 0; }
}
function incrementCounter() {
    const n = getCounter() + 1;
    localStorage.setItem(COUNTER_KEY, String(n));
    return n;
}
function getTemplates() {
    try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]'); } catch { return []; }
}
function saveTemplates(t) { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(t)); }
function getSuggestions() {
    try { return JSON.parse(localStorage.getItem(SUGGESTIONS_KEY) || '[]'); } catch { return []; }
}
function saveSuggestions(s) { localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(s)); }
function getSession() {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        const hours = (Date.now() - s.timestamp) / (1000 * 60 * 60);
        if (hours > 8) { sessionStorage.removeItem(SESSION_KEY); return null; }
        return s;
    } catch { return null; }
}
function setSession(user, role) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user, role, timestamp: Date.now() }));
}
function clearSession() { sessionStorage.removeItem(SESSION_KEY); }

// ================================================================
//  HASH (Web Crypto)
// ================================================================
function bufferToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}
async function hashPassword(password, salt = null) {
    if (!salt) {
        const s = crypto.getRandomValues(new Uint8Array(16));
        salt = bufferToBase64(s);
    }
    const data = new TextEncoder().encode(salt + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return { hash: bufferToBase64(hashBuffer), salt };
}
async function verifyPassword(password, storedHash, storedSalt) {
    const { hash } = await hashPassword(password, storedSalt);
    return hash === storedHash;
}

// ================================================================
//  UTILS
// ================================================================
function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// ================================================================
//  INICIALIZAR USUARIOS POR DEFECTO
// ================================================================
(function initUsers() {
    const users = getUsers();
    if (Object.keys(users).length === 0) {
        const defaults = {
            "Lic. Susana Sabalza": { password: null, salt: null, role: "admin", photo: "", signature: "" },
            "Lic. Eligmary Carrillo": { password: null, salt: null, role: "executive", photo: "", signature: "" },
            "Lic. Santiago Sañudo": { password: null, salt: null, role: "executive", photo: "", signature: "" },
            "Lic. Daryl Villa": { password: null, salt: null, role: "admin", photo: "", signature: "" },
            "Lic. Nayibe Sabalza": { password: null, salt: null, role: "executive", photo: "", signature: "" },
            "Lic. Linda Simmonds": { password: null, salt: null, role: "executive", photo: "", signature: "" },
            "Lic. Antony Talla": { password: null, salt: null, role: "executive", photo: "", signature: "" },
            "Lic. Oscaris Ugas": { password: null, salt: null, role: "executive", photo: "", signature: "" },
            "Lic. Linoska Ugas": { password: null, salt: null, role: "executive", photo: "", signature: "" }
        };
        saveUsers(defaults);
    }
})();

// ================================================================
//  SERVICIOS Y REQUISITOS
// ================================================================
const defaultServices = [
    { name: 'Impuesto Al Estado' }, { name: 'Honorarios' }, { name: 'Gastos Administrativos' },
    { name: 'Notificación' }, { name: 'Tribunal' }, { name: 'Honorarios + Membresia' },
    { name: 'Multa' }, { name: 'Descuento' }
];
const requirementsList = [
    'Pasaporte vigente', 'Fotos tamaño carnet', 'Copia de cédula',
    'Comprobante de solvencia económica', 'Recibo de domicilio/contrato de arrendamiento'
];
const procedureRequirements = {
    'Visa de turista.': ['Pasaporte vigente', 'Fotos tamaño carnet', 'Comprobante de solvencia económica'],
    'Visa de tránsito.': ['Pasaporte vigente', 'Fotos tamaño carnet'],
    'Estudiantes.': ['Pasaporte vigente', 'Fotos tamaño carnet', 'Copia de cédula', 'Comprobante de solvencia económica'],
    'Visa de estudiante.': ['Pasaporte vigente', 'Fotos tamaño carnet', 'Copia de cédula', 'Comprobante de solvencia económica'],
    'Reagrupación familiar.': ['Pasaporte vigente', 'Fotos tamaño carnet', 'Copia de cédula', 'Recibo de domicilio/contrato de arrendamiento'],
    'Naturalización.': ['Pasaporte vigente', 'Fotos tamaño carnet', 'Copia de cédula', 'Recibo de domicilio/contrato de arrendamiento'],
    'Residencia permanente.': ['Pasaporte vigente', 'Fotos tamaño carnet', 'Copia de cédula', 'Comprobante de solvencia económica'],
    'Residencia temporal.': ['Pasaporte vigente', 'Fotos tamaño carnet', 'Copia de cédula'],
    'Permiso de trabajo.': ['Pasaporte vigente', 'Fotos tamaño carnet', 'Copia de cédula']
};

function buildServicesList() {
    const container = document.getElementById('servicesList');
    container.innerHTML = '';
    defaultServices.forEach((s, i) => {
        const div = document.createElement('div');
        div.className = 'service-item';
        div.innerHTML = `
            <input type="checkbox" class="extra-service-check" id="service_${i}" value="${s.name}">
            <span>${s.name}</span>
            <input type="text" class="service-price-input" id="price_${i}" placeholder="$0.00" inputmode="decimal">
        `;
        container.appendChild(div);
    });
    document.querySelectorAll('.service-price-input').forEach(inp => {
        inp.addEventListener('focus', e => {
            const raw = e.target.getAttribute('data-raw');
            e.target.value = raw || e.target.value.replace(/,/g, '');
        });
        inp.addEventListener('blur', e => {
            let val = e.target.value.trim();
            if (val === '') { e.target.value = ''; e.target.setAttribute('data-raw', ''); return; }
            let num = parseFloat(val.replace(/,/g, ''));
            if (isNaN(num)) { e.target.value = ''; return; }
            e.target.setAttribute('data-raw', num.toString());
            e.target.value = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        });
        inp.addEventListener('input', e => {
            e.target.value = e.target.value.replace(/[^0-9.\-]/g, '');
        });
    });
}

function buildRequirementsList() {
    const grid = document.getElementById('requirementsGrid');
    grid.innerHTML = '';
    requirementsList.forEach(req => {
        const label = document.createElement('label');
        label.className = 'requirement-option';
        label.innerHTML = `<input type="checkbox" class="requirement-check" value="${req}"> ${req}`;
        grid.appendChild(label);
    });
}

function autoSelectRequirements(procedure) {
    const reqs = procedureRequirements[procedure] || [];
    document.querySelectorAll('.requirement-check').forEach(cb => {
        cb.checked = reqs.includes(cb.value);
    });
}

function getPriceFromInput(input) {
    let val = input.value.trim();
    if (val === '') return 0;
    let num = parseFloat(val.replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
}

// ================================================================
//  LOGO A DATA URI
// ================================================================
let cachedPdfLogoDataUri = null;
function getPdfLogoDataUri() {
    if (cachedPdfLogoDataUri) return Promise.resolve(cachedPdfLogoDataUri);
    return new Promise(resolve => {
        const svg = document.getElementById('sqpLogoSvg');
        if (!svg) { resolve(''); return; }
        const clone = svg.cloneNode(true);
        clone.removeAttribute('id');
        clone.setAttribute('width', '800');
        clone.setAttribute('height', '733');
        const markup = new XMLSerializer().serializeToString(clone);
        const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = 800; canvas.height = 733;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 800, 733);
            URL.revokeObjectURL(url);
            try { cachedPdfLogoDataUri = canvas.toDataURL('image/png'); } catch(e) { cachedPdfLogoDataUri = ''; }
            resolve(cachedPdfLogoDataUri);
        };
        img.onerror = function() { URL.revokeObjectURL(url); cachedPdfLogoDataUri = ''; resolve(''); };
        img.src = url;
    });
}

// ================================================================
//  GENERAR HTML DEL PDF (VERSIÓN ULTRA COMPACTA - 1 PÁGINA)
// ================================================================
function generatePdfHTML(data) {
    const clientName = data.client || 'No especificado';
    const clientId = data.client_id || '-';
    const clientPhone = data.phone || '-';
    const clientEmail = data.email || '-';
    const procedure = data.procedure || 'Trámite no especificado';
    const services = data.services || [];
    const subtotal = data.subtotal || 0;
    const discount = data.discount || 0;
    const total = subtotal - discount; // ✅ SIN IVA - precio final directo
    const requirements = data.requirements || [];
    const userObs = data.observations || '';
    const executive = data.executive || 'No asignado';
    const quoteNumber = data.quote_number || data.quoteNumber || 'N/A';
    const date = new Date().toLocaleDateString('es-CR');

    let servicesRows = '';
    if (services.length === 0) {
        servicesRows = `<tr><td colspan="4" style="text-align:center; padding:5px; border:1px solid #ddd; font-size:10px;">No hay servicios adicionales</td></tr>`;
    } else {
        services.forEach(s => {
            const price = s.price || 0;
            servicesRows += `<tr>
                <td style="padding:5px 7px; border:1px solid #ddd; font-size:10px;">${escapeHtml(s.name)}</td>
                <td style="padding:5px 7px; text-align:center; border:1px solid #ddd; font-size:10px;">1</td>
                <td style="padding:5px 7px; text-align:right; border:1px solid #ddd; font-size:10px;">$${price.toFixed(2)}</td>
                <td style="padding:5px 7px; text-align:right; border:1px solid #ddd; font-size:10px;">$${price.toFixed(2)}</td>
            </tr>`;
        });
        if (discount > 0) {
            servicesRows += `<tr>
                <td style="padding:5px 7px; border:1px solid #ddd; color:#d0103a; font-size:10px;">Descuento</td>
                <td style="padding:5px 7px; text-align:center; border:1px solid #ddd; font-size:10px;">1</td>
                <td style="padding:5px 7px; text-align:right; border:1px solid #ddd; font-size:10px;">-$${discount.toFixed(2)}</td>
                <td style="padding:5px 7px; text-align:right; border:1px solid #ddd; font-size:10px;">-$${discount.toFixed(2)}</td>
            </tr>`;
        }
    }

    let reqHtml = requirements.length === 0
        ? '<li style="margin-bottom:1px; font-size:9px;">No se requieren documentos adicionales.</li>'
        : requirements.map(r => `<li style="margin-bottom:1px; font-size:9px;">${escapeHtml(r)}</li>`).join('');

    let observationsHtml = '';
    if (userObs.trim()) {
        observationsHtml += `<p style="margin: 0 0 4px 0; font-size: 9px; color: #333; white-space: pre-wrap;">${escapeHtml(userObs)}</p>`;
    }
    observationsHtml += `<p style="margin: 0; font-size: 9px; color: #555; font-style: italic; background: #f9fbfd; padding: 5px 7px; border-left: 3px solid #B7A658;">${FIXED_OBSERVATIONS_MESSAGE}</p>`;

    return `
        <div style="font-family: Arial, sans-serif; width: 720px; padding: 12px; background: #ffffff; color: #1e293b; box-sizing: border-box;">

            <!-- ENCABEZADO -->
            <table style="width: 100%; border-collapse: collapse; border-bottom: 2px solid #0B759D; margin-bottom: 10px;">
                <tr>
                    <td style="width: 60%; vertical-align: middle; padding-bottom: 6px;">
                        <table style="border-collapse: collapse;">
                            <tr>
                                <td style="vertical-align: middle; padding-right: 8px;">
                                    <img id="pdfLogoImgInner" style="height: 40px; width: auto; display: block;" alt="SQP" />
                                </td>
                                <td style="vertical-align: middle;">
                                    <div style="color: #0B759D; font-size: 15px; font-weight: bold; line-height: 1.2;">SQP LEGAL CONSULTING</div>
                                    <div style="font-size: 9px; color: #555555; line-height: 1.2;">Abogados &amp; Consultores Jurídicos</div>
                                </td>
                            </tr>
                        </table>
                    </td>
                    <td style="width: 40%; vertical-align: middle; text-align: right; padding-bottom: 6px;">
                        <div style="color: #B7A658; font-size: 18px; font-weight: bold; line-height: 1.2;">COTIZACIÓN</div>
                        <div style="font-size: 10px; color: #555555; line-height: 1.2;">Nº: <strong>${escapeHtml(quoteNumber)}</strong></div>
                    </td>
                </tr>
            </table>

            <!-- DATOS FIRMA Y CLIENTE -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9px;">
                <tr>
                    <td style="width: 50%; vertical-align: top; border: 1px solid #dddddd; padding: 6px; background: #f9fbfd;">
                        <div style="color: #0B759D; font-size: 9px; font-weight: bold; margin-bottom: 3px;">DATOS DE LA FIRMA JURÍDICA:</div>
                        <strong>RUC / Céd. Jurídica:</strong> 3-101-892341-20<br>
                        <strong>Teléfono:</strong> +506 2201-9000<br>
                        <strong>Correo:</strong> cotizaciones@sqplegal.com<br>
                        <strong>Fecha Emisión:</strong> ${date}<br>
                        <strong>Ejecutivo:</strong> ${escapeHtml(executive)}
                    </td>
                    <td style="width: 50%; vertical-align: top; border: 1px solid #dddddd; padding: 6px; background: #f9fbfd;">
                        <div style="color: #0B759D; font-size: 9px; font-weight: bold; margin-bottom: 3px;">DATOS DEL CLIENTE:</div>
                        <strong>Cliente:</strong> ${escapeHtml(clientName)}<br>
                        <strong>Identificación:</strong> ${escapeHtml(clientId)}<br>
                        <strong>Teléfono:</strong> ${escapeHtml(clientPhone)}<br>
                        <strong>Correo:</strong> ${escapeHtml(clientEmail)}
                    </td>
                </tr>
            </table>

            <!-- ASUNTO -->
            <p style="font-weight: bold; font-size: 11px; margin: 0 0 6px 0; color: #0B759D;">
                ASUNTO / TRÁMITE: <span style="color: #1e293b;">${escapeHtml(procedure)}</span>
            </p>

            <!-- TABLA DE SERVICIOS -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 10px;">
                <thead>
                    <tr style="background: #0B759D; color: #ffffff;">
                        <th style="padding: 6px 7px; text-align: left; border: 1px solid #0B759D; font-size:10px;">DESCRIPCIÓN DEL SERVICIO</th>
                        <th style="padding: 6px 7px; text-align: center; border: 1px solid #0B759D; width: 45px; font-size:10px;">CANT</th>
                        <th style="padding: 6px 7px; text-align: right; border: 1px solid #0B759D; width: 95px; font-size:10px;">PRECIO UNIT</th>
                        <th style="padding: 6px 7px; text-align: right; border: 1px solid #0B759D; width: 95px; font-size:10px;">SUBTOTAL</th>
                    </tr>
                </thead>
                <tbody>${servicesRows}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" style="text-align: right; font-weight: bold; padding: 6px 7px; border: 1px solid #0B759D; background: #e8f0f5; font-size: 11px;">TOTAL A PAGAR:</td>
                        <td style="text-align: right; font-weight: bold; padding: 6px 7px; border: 1px solid #0B759D; background: #e8f0f5; color: #0B759D; font-size: 11px;">$${total.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>

            <!-- REQUISITOS -->
            <div style="margin-bottom: 8px;">
                <div style="color: #0B759D; font-size: 9px; font-weight: bold; margin-bottom: 2px;">REQUISITOS Y DOCUMENTACIÓN REQUERIDA:</div>
                <ul style="margin: 2px 0 0 16px; padding-left: 0; list-style-type: disc;">${reqHtml}</ul>
            </div>

            <!-- OBSERVACIONES -->
            <div style="margin-bottom: 8px;">
                <div style="color: #0B759D; font-size: 9px; font-weight: bold; margin-bottom: 2px;">OBSERVACIONES Y CONDICIONES:</div>
                <div style="margin-top: 3px;">${observationsHtml}</div>
            </div>

            <!-- MÉTODOS DE PAGO -->
            <div style="margin-bottom: 8px;">
                <div style="color: #0B759D; font-size: 9px; font-weight: bold; margin-bottom: 2px;">MÉTODOS DE PAGO:</div>
                <div style="font-size: 8px; line-height: 1.4; margin-top: 3px; background: #f9fbfd; padding: 6px 7px; border-left: 3px solid #0B759D;">
                    <p style="margin: 1px 0;"><strong>Banco Nacional de Panamá</strong> — Cuenta de Ahorro — Titular: SQP Legal Consulting — Cuenta: 10000346515</p>
                    <p style="margin: 1px 0;"><strong>Banco Aliado</strong> — Cuenta de Ahorro — Titular: SQP Legal Consulting — Cuenta: 8200012913</p>
                    <p style="margin: 3px 0 0 0; font-size: 7px; color: #666666;"><em>Si tu banco solicita más dígitos, agrega dos (2) ceros al inicio del número de cuenta.</em></p>
                    <p style="margin: 3px 0 0 0; font-weight: 600;">Importante: Una vez realizado el pago, envía el comprobante para confirmar y agilizar el proceso.</p>
                    <p style="margin: 2px 0 0 0; font-style: italic; color: #B7A658;">¡Gracias por su confianza!</p>
                </div>
            </div>

            <!-- PIE DE PÁGINA -->
            <div style="border-top: 1px solid #dddddd; margin-top: 10px; padding-top: 6px; text-align: center; font-size: 8px; color: #666666;">
                Esta cotización será válida por 30 días calendario.
                <br>
                <span style="color: #B7A658;">SQP LEGAL CONSULTING</span> - Tel: +506 2201-9000 - cotizaciones@sqplegal.com
            </div>
        </div>
    `;
}

// ================================================================
//  LOGIN
// ================================================================
async function handleLogin() {
    const username = document.getElementById('loginUserSelect').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    if (!username) { errorDiv.textContent = 'Seleccione un usuario.'; return; }
    if (!password) { errorDiv.textContent = 'Ingrese una contraseña.'; return; }

    const users = getUsers();
    const user = users[username];
    if (!user) { errorDiv.textContent = 'Usuario no válido.'; return; }

    try {
        if (user.password === null || user.password === undefined) {
            const { hash, salt } = await hashPassword(password);
            user.password = hash;
            user.salt = salt;
            saveUsers(users);
        } else {
            const match = await verifyPassword(password, user.password, user.salt);
            if (!match) { errorDiv.textContent = 'Contraseña incorrecta.'; return; }
        }

        currentUser = username;
        currentRole = user.role;
        setSession(username, user.role);

        document.getElementById('loginScreen').style.transform = 'scale(0)';
        document.getElementById('loginScreen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loginScreen').style.display = 'none';
            showApp();
        }, 300);
        errorDiv.textContent = '';
    } catch (err) {
        errorDiv.textContent = 'Error inesperado.';
        console.error(err);
    }
}

function handleLogout() {
    currentUser = null;
    currentRole = null;
    clearSession();
    const mainApp = document.getElementById('mainApp');
    mainApp.style.transform = 'scale(0)';
    mainApp.style.opacity = '0';
    setTimeout(() => {
        mainApp.style.display = 'none';
        const ls = document.getElementById('loginScreen');
        ls.style.display = 'block';
        ls.style.transform = 'scale(1)';
        ls.style.opacity = '1';
        document.getElementById('loginPassword').value = '';
        document.getElementById('loginError').textContent = '';
    }, 300);
}

function showApp() {
    if (!currentUser) return;
    const mainApp = document.getElementById('mainApp');
    mainApp.style.display = 'block';
    mainApp.style.transform = 'scale(1)';
    mainApp.style.opacity = '1';
    document.getElementById('currentUserDisplay').textContent =
        `${currentUser} (${currentRole === 'admin' ? 'Administrador' : 'Ejecutivo'})`;
    const isAdmin = (currentRole === 'admin');
    document.getElementById('adminDashboardBtn').style.display = isAdmin ? 'inline-flex' : 'none';
    document.getElementById('adminHistoryBtn').style.display = isAdmin ? 'inline-flex' : 'none';
    document.getElementById('adminUsersBtn').style.display = isAdmin ? 'inline-flex' : 'none';
    updateProfilePic();
    resetForm();
    if (localStorage.getItem('sqp_darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeToggle').textContent = '☀️';
    }
    getPdfLogoDataUri().then(uri => {
        if (uri) document.getElementById('faviconLink').href = uri;
    }).catch(() => {});
    checkProgrammerAccess();
}

// ================================================================
//  CÁLCULO Y GENERACIÓN
// ================================================================
function calculateQuote() {
    const procedureText = document.getElementById('procedureSearch').value.trim();
    if (!procedureText) { alert('Seleccione un trámite.'); return null; }
    const people = parseInt(document.getElementById('peopleCount').value) || 1;
    const services = [];
    let subtotal = 0, discount = 0;
    document.querySelectorAll('.extra-service-check').forEach((cb, idx) => {
        if (cb.checked) {
            const price = getPriceFromInput(document.getElementById(`price_${idx}`));
            if (cb.value === 'Descuento') { discount = Math.abs(price); }
            else { services.push({ name: cb.value, price }); subtotal += price; }
        }
    });
    const reqs = Array.from(document.querySelectorAll('.requirement-check:checked')).map(cb => cb.value);
    return {
        procedure: procedureText, people, services, subtotal, discount,
        total: subtotal - discount,
        requirements: reqs,
        observations: document.getElementById('observations').value.trim(),
        executive: currentUser, status: 'pendiente'
    };
}

function showSummary() {
    const clientName = document.getElementById('clientName').value.trim();
    if (!clientName) { alert('Nombre del cliente obligatorio.'); return; }
    const data = calculateQuote();
    if (!data) return;
    pendingGenerate = data;

    const summaryDiv = document.getElementById('summaryContent');
    const totalFinal = data.subtotal - data.discount;

    let html = `
        <p><strong>Cliente:</strong> ${escapeHtml(clientName)}</p>
        <p><strong>Trámite:</strong> ${escapeHtml(data.procedure)}</p>
        <p><strong>Cantidad de personas:</strong> ${data.people}</p>
        <p><strong>Servicios:</strong></p><ul style="margin-left:1.5rem;">
    `;
    if (data.services.length === 0) html += '<li>Ninguno</li>';
    else data.services.forEach(s => { html += `<li>${escapeHtml(s.name)}: $${s.price.toFixed(2)}</li>`; });
    if (data.discount > 0) html += `<li>Descuento: -$${data.discount.toFixed(2)}</li>`;
    html += `</ul>
        <p><strong style="color:var(--gold); font-size:1.1rem;">TOTAL: $${totalFinal.toFixed(2)} USD</strong></p>
    `;
    summaryDiv.innerHTML = html;
    document.getElementById('summaryModal').classList.add('active');
}

function confirmGenerate() {
    if (!pendingGenerate) return;
    const data = pendingGenerate;
    const clientName = document.getElementById('clientName').value.trim();
    const clientId = document.getElementById('clientId').value.trim();
    const email = document.getElementById('clientEmail').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();

    if (lastQuoteData && lastQuoteData.quote_number) {
        const quotes = getQuotes();
        const idx = quotes.findIndex(q => q.quote_number === lastQuoteData.quote_number);
        if (idx !== -1) {
            quotes[idx] = {
                ...quotes[idx], ...data,
                client: clientName, client_id: clientId, email, phone,
                total: data.subtotal - data.discount
            };
            saveQuotes(quotes);
            lastQuoteData = quotes[idx];
            displayQuote(lastQuoteData);
            document.getElementById('summaryModal').classList.remove('active');
            pendingGenerate = null;
            return;
        }
    }

    const counter = incrementCounter();
    const year = new Date().getFullYear();
    const quoteNumber = `COT-${year}-${String(counter).padStart(4, '0')}`;

    const quoteData = {
        ...data,
        client: clientName, client_id: clientId, email, phone,
        quote_number: quoteNumber,
        total: data.subtotal - data.discount,
        date: new Date().toISOString(),
        reminder_sent: false
    };
    const quotes = getQuotes();
    quotes.push(quoteData);
    saveQuotes(quotes);
    lastQuoteData = quoteData;
    displayQuote(quoteData);
    document.getElementById('summaryModal').classList.remove('active');
    pendingGenerate = null;
}

function cancelGenerate() {
    document.getElementById('summaryModal').classList.remove('active');
    pendingGenerate = null;
}

function displayQuote(data) {
    const html = generatePdfHTML(data);
    document.getElementById('printableQuote').innerHTML = html;
    getPdfLogoDataUri().then(uri => {
        const logo = document.getElementById('pdfLogoImgInner');
        if (logo && uri) logo.src = uri;
    }).catch(() => {});
    document.getElementById('formSection').style.display = 'none';
    document.getElementById('quoteResult').classList.add('active');
    lastQuoteData = data;
}

function resetForm() {
    document.getElementById('formSection').style.display = 'block';
    document.getElementById('quoteResult').classList.remove('active');
    document.querySelectorAll('.extra-service-check').forEach(cb => cb.checked = false);
    document.querySelectorAll('.requirement-check').forEach(cb => cb.checked = false);
    document.querySelectorAll('.service-price-input').forEach(inp => { inp.value = ''; inp.setAttribute('data-raw', ''); });
    document.getElementById('clientName').value = '';
    document.getElementById('clientId').value = '';
    document.getElementById('clientEmail').value = '';
    document.getElementById('clientPhone').value = '';
    document.getElementById('procedureSearch').value = '';
    document.getElementById('observations').value = '';
    lastQuoteData = null;
    pendingGenerate = null;
}

// ================================================================
//  PDF — CAPTURA COMPLETA + ESCALADO A 1 PÁGINA (SIN CORTES)
// ================================================================
function showLoader(text = 'Generando PDF…') {
    document.getElementById('loaderText').textContent = text;
    document.getElementById('loaderOverlay').classList.add('active');
}
function hideLoader() {
    document.getElementById('loaderOverlay').classList.remove('active');
}

function buildPdfFile() {
    return new Promise((resolve, reject) => {
        if (!lastQuoteData) { reject('No hay cotización'); return; }
        showLoader('Generando PDF…');

        const element = document.getElementById('printableQuote');

        // ✅ Forzar visibilidad total
        const originalDisplay = element.style.display;
        element.style.display = 'block';
        element.style.visibility = 'visible';
        element.style.position = 'relative';
        element.style.background = '#ffffff';
        element.style.width = '720px';

        const clientName = lastQuoteData.client || 'SQP';
        const sanitized = clientName.replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ\s]/g, '').trim().replace(/\s+/g, '_');
        const filename = `Presupuesto_${sanitized}.pdf`;

        // ✅ Esperar a que el logo cargue completamente
        const waitForLogo = () => new Promise(res => {
            const logo = document.getElementById('pdfLogoImgInner');
            if (!logo || !logo.src) { res(); return; }
            if (logo.complete && logo.naturalWidth > 0) { res(); return; }
            logo.onload = res;
            logo.onerror = res;
            setTimeout(res, 2500);
        });

        waitForLogo()
            .then(() => new Promise(res => setTimeout(res, 500)))
            .then(() => {
                // ✅ Capturar TODO el contenido como imagen (una sola pieza)
                return html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                    scrollX: 0,
                    scrollY: 0,
                    width: element.scrollWidth,
                    height: element.scrollHeight,
                    windowWidth: element.scrollWidth,
                    windowHeight: element.scrollHeight
                });
            })
            .then(canvas => {
                const imgData = canvas.toDataURL('image/jpeg', 0.95);

                // ✅ Crear PDF con jsPDF directamente (evita cortes)
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'letter'
                });

                const pageWidth = pdf.internal.pageSize.getWidth();   // 215.9 mm
                const pageHeight = pdf.internal.pageSize.getHeight(); // 279.4 mm

                // Márgenes de 8mm a cada lado
                const margin = 8;
                const availableWidth = pageWidth - (margin * 2);
                const availableHeight = pageHeight - (margin * 2);

                // Escalar la imagen proporcionalmente
                const imgRatio = canvas.height / canvas.width;
                let finalWidth = availableWidth;
                let finalHeight = finalWidth * imgRatio;

                // Si es más alto que la página, escalar por altura
                if (finalHeight > availableHeight) {
                    finalHeight = availableHeight;
                    finalWidth = finalHeight / imgRatio;
                }

                // Centrar horizontalmente
                const x = (pageWidth - finalWidth) / 2;
                const y = margin;

                // ✅ Añadir toda la imagen en 1 sola página
                pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight);

                const blob = pdf.output('blob');
                element.style.display = originalDisplay;
                hideLoader();
                resolve(new File([blob], filename, { type: 'application/pdf' }));
            })
            .catch(err => {
                element.style.display = originalDisplay;
                hideLoader();
                console.error('Error PDF:', err);
                alert('❌ Error al generar el PDF: ' + err.message);
                reject(err);
            });
    });
}

function downloadPdfFile(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function generateAndDownloadPDF(showAlert = true) {
    if (!lastQuoteData) { alert('Primero genere un presupuesto.'); return Promise.reject(); }
    return buildPdfFile().then(file => {
        downloadPdfFile(file);
        if (showAlert) alert('✅ Presupuesto descargado exitosamente.');
    });
}

// ================================================================
//  WHATSAPP
// ================================================================
function getSignature() {
    const users = getUsers();
    const user = users[currentUser];
    return user.signature || 'Saludos cordiales,\nSQP LEGAL CONSULTING.';
}

function sendWhatsApp() {
    if (!lastQuoteData) { alert('Genere una cotización primero.'); return; }
    const phone = (lastQuoteData.phone || '').replace(/[^0-9+]/g, '');
    let cleanPhone = phone.replace(/^\+/, '').replace(/\s/g, '');
    if (!cleanPhone) { alert('El cliente no tiene un número de teléfono válido.'); return; }

    const client = lastQuoteData.client || 'Cliente';
    const total = (lastQuoteData.total || 0).toFixed(2);
    const procedure = lastQuoteData.procedure;
    const signature = getSignature();
    const msg = `Hola ${client}, te comparto el presupuesto para "${procedure}" con un total de $${total} USD.\n\n${signature}`;

    const markSent = confirm('¿Marcar esta cotización como ENVIADA en el historial?');
    if (markSent && lastQuoteData.quote_number) {
        const quotes = getQuotes();
        const idx = quotes.findIndex(q => q.quote_number === lastQuoteData.quote_number);
        if (idx !== -1) {
            quotes[idx].status = 'enviada';
            saveQuotes(quotes);
            lastQuoteData.status = 'enviada';
        }
    }

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    alert('📎 Recuerda descargar el PDF con el botón "📥 Descargar PDF" y adjuntarlo manualmente al chat.');
}

// ================================================================
//  VISTA PREVIA
// ================================================================
function openPreview() {
    if (!lastQuoteData) { alert('Genere una cotización primero.'); return; }
    showLoader('Generando vista previa…');
    buildPdfFile().then(file => {
        hideLoader();
        const url = URL.createObjectURL(file);
        const iframe = document.getElementById('previewIframe');
        iframe.src = url;
        document.getElementById('previewModal').classList.add('active');
    }).catch(() => hideLoader());
}
function closePreview() { document.getElementById('previewModal').classList.remove('active'); }
function downloadFromPreview() {
    generateAndDownloadPDF(true).then(() => closePreview()).catch(() => {});
}

// ================================================================
//  DASHBOARD
// ================================================================
function openDashboard() {
    if (currentRole !== 'admin') { alert('Acceso denegado.'); return; }
    const quotes = getQuotes();
    const counts = {};
    quotes.forEach(q => { counts[q.executive] = (counts[q.executive] || 0) + 1; });
    const tbody = document.getElementById('dashboardBody');
    tbody.innerHTML = '';
    const users = getUsers();
    Object.keys(users).filter(u => users[u].role === 'executive').forEach(exec => {
        tbody.innerHTML += `<tr><td>${exec}</td><td>${counts[exec] || 0}</td></tr>`;
    });
    document.getElementById('dashboardModal').classList.add('active');
}
function closeDashboard() { document.getElementById('dashboardModal').classList.remove('active'); }

// ================================================================
//  HISTORIAL
// ================================================================
function openHistoryModal() {
    if (currentRole !== 'admin') { alert('Acceso denegado.'); return; }
    renderHistory(getQuotes());
    document.getElementById('historyModal').classList.add('active');
}
function closeHistoryModal() { document.getElementById('historyModal').classList.remove('active'); }

function renderHistory(quotes) {
    const tbody = document.getElementById('historyBody');
    tbody.innerHTML = '';
    if (quotes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No hay cotizaciones</td></tr>';
        return;
    }
    quotes.slice().reverse().forEach(q => {
        const statusClass = {
            'pendiente': 'status-pendiente', 'aprobada': 'status-aprobada',
            'rechazada': 'status-rechazada', 'convertida': 'status-convertida', 'enviada': 'status-enviada'
        }[q.status] || 'status-pendiente';
        const statusLabel = {
            'pendiente': 'Pendiente', 'aprobada': 'Aprobada',
            'rechazada': 'Rechazada', 'convertida': 'Convertida', 'enviada': 'Enviada'
        }[q.status] || 'Pendiente';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${q.quote_number || 'N/A'}</td>
            <td>${new Date(q.date).toLocaleString()}</td>
            <td>${q.executive}</td>
            <td>${escapeHtml(q.client)}</td>
            <td>${escapeHtml(q.procedure)}</td>
            <td>$${(q.total || 0).toFixed(2)}</td>
            <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
            <td>
                <select class="status-select" data-quote="${q.quote_number}">
                    <option value="pendiente" ${q.status === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="enviada" ${q.status === 'enviada' ? 'selected' : ''}>Enviada</option>
                    <option value="aprobada" ${q.status === 'aprobada' ? 'selected' : ''}>Aprobada</option>
                    <option value="rechazada" ${q.status === 'rechazada' ? 'selected' : ''}>Rechazada</option>
                    <option value="convertida" ${q.status === 'convertida' ? 'selected' : ''}>Convertida</option>
                </select>
            </td>`;
        tbody.appendChild(tr);
    });
    document.querySelectorAll('.status-select').forEach(sel => {
        sel.addEventListener('change', function() {
            const qn = this.dataset.quote;
            const quotes = getQuotes();
            const idx = quotes.findIndex(q => q.quote_number === qn);
            if (idx !== -1) { quotes[idx].status = this.value; saveQuotes(quotes); }
            renderHistory(getQuotes());
        });
    });
}

function applyFilters() {
    const client = document.getElementById('filterClient').value.toLowerCase().trim();
    const exec = document.getElementById('filterExecutive').value.toLowerCase().trim();
    const proc = document.getElementById('filterProcedure').value.toLowerCase().trim();
    const from = document.getElementById('filterDateFrom').value;
    const to = document.getElementById('filterDateTo').value;
    let filtered = getQuotes().filter(q => {
        if (client && !(q.client || '').toLowerCase().includes(client)) return false;
        if (exec && !(q.executive || '').toLowerCase().includes(exec)) return false;
        if (proc && !(q.procedure || '').toLowerCase().includes(proc)) return false;
        if (from && new Date(q.date) < new Date(from)) return false;
        if (to) {
            const t = new Date(to); t.setHours(23, 59, 59);
            if (new Date(q.date) > t) return false;
        }
        return true;
    });
    renderHistory(filtered);
}
function clearFilters() {
    ['filterClient', 'filterExecutive', 'filterProcedure', 'filterDateFrom', 'filterDateTo'].forEach(id => {
        document.getElementById(id).value = '';
    });
    renderHistory(getQuotes());
}

// ================================================================
//  USUARIOS
// ================================================================
function openUsersModal() {
    if (currentRole !== 'admin') { alert('Acceso denegado.'); return; }
    renderUsersList();
    document.getElementById('usersModal').classList.add('active');
}
function closeUsersModal() { document.getElementById('usersModal').classList.remove('active'); }

function renderUsersList() {
    const users = getUsers();
    const container = document.getElementById('usersList');
    container.innerHTML = '';
    Object.entries(users).forEach(([name, data]) => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:0.5rem; border-bottom:1px solid var(--border);';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = data.role === 'admin';
        checkbox.addEventListener('change', function() {
            const users = getUsers();
            users[name].role = this.checked ? 'admin' : 'executive';
            saveUsers(users);
            renderUsersList();
        });
        const label = document.createElement('label');
        label.className = 'toggle-switch';
        label.appendChild(checkbox);
        const slider = document.createElement('span');
        slider.className = 'slider';
        label.appendChild(slider);
        const delBtn = document.createElement('button');
        delBtn.textContent = '🗑️';
        delBtn.addEventListener('click', () => {
            if (name === currentUser) { alert('No puedes eliminarte a ti mismo.'); return; }
            if (confirm(`¿Eliminar a ${name}?`)) {
                const users = getUsers();
                delete users[name];
                saveUsers(users);
                renderUsersList();
            }
        });
        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex; gap:0.5rem; align-items:center;';
        actions.appendChild(label);
        actions.appendChild(delBtn);
        div.innerHTML = `<span>${name} (${data.role})</span>`;
        div.appendChild(actions);
        container.appendChild(div);
    });
}

function addUser() {
    if (currentRole !== 'admin') { alert('Acceso denegado.'); return; }
    const name = document.getElementById('newUsername').value.trim();
    const role = document.getElementById('newUserRole').value;
    if (!name) { alert('Nombre requerido.'); return; }
    const users = getUsers();
    if (users[name]) { alert('El usuario ya existe.'); return; }
    users[name] = { password: null, salt: null, role, photo: '', signature: '' };
    saveUsers(users);
    renderUsersList();
    document.getElementById('newUsername').value = '';
}

// ================================================================
//  PERFIL
// ================================================================
function openProfileModal() {
    const users = getUsers();
    const user = users[currentUser];
    document.getElementById('profileSignature').value = user.signature || '';
    document.getElementById('profileModal').classList.add('active');
}
function closeProfileModal() { document.getElementById('profileModal').classList.remove('active'); }

function optimizeProfileImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 200; canvas.height = 200;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, 200, 200);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function updateProfile() {
    const newPass = document.getElementById('profileNewPassword').value;
    const confirm = document.getElementById('profileConfirmPassword').value;
    const errorDiv = document.getElementById('profileError');
    if (newPass && newPass !== confirm) { errorDiv.textContent = 'Las contraseñas no coinciden.'; return; }

    try {
        const users = getUsers();
        const signature = document.getElementById('profileSignature').value.trim();
        if (signature) users[currentUser].signature = signature;
        else delete users[currentUser].signature;

        const file = document.getElementById('profilePicInput').files[0];
        if (file) users[currentUser].photo = await optimizeProfileImage(file);

        if (newPass) {
            const { hash, salt } = await hashPassword(newPass);
            users[currentUser].password = hash;
            users[currentUser].salt = salt;
        }
        saveUsers(users);
        updateProfilePic();
        closeProfileModal();
        alert('Perfil actualizado.');
        errorDiv.textContent = '';
    } catch (err) {
        errorDiv.textContent = 'Error: ' + err.message;
    }
}

function updateProfilePic() {
    const users = getUsers();
    const photo = users[currentUser]?.photo || '';
    const pic = document.getElementById('profilePicDisplay');
    const preview = document.getElementById('profilePicPreview');
    if (photo) {
        pic.src = photo;
        pic.style.display = 'inline-block';
        if (preview) preview.src = photo;
    } else {
        const av = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="35" r="25" fill="%23ccc"/%3E%3Cpath d="M25 80 Q50 95 75 80" fill="%23ccc"/%3E%3C/svg%3E';
        pic.src = av;
        pic.style.display = 'none';
        if (preview) preview.src = av;
    }
}

// ================================================================
//  PLANTILLAS
// ================================================================
function openTemplatesModal() {
    renderTemplates();
    document.getElementById('templatesModal').classList.add('active');
}
function closeTemplatesModal() { document.getElementById('templatesModal').classList.remove('active'); }

function renderTemplates() {
    const templates = getTemplates();
    const container = document.getElementById('templatesList');
    container.innerHTML = '';
    if (templates.length === 0) { container.innerHTML = '<p>No hay plantillas guardadas.</p>'; return; }
    templates.forEach((t, idx) => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:0.5rem; border-bottom:1px solid var(--border);';
        div.innerHTML = `
            <span><strong>${escapeHtml(t.name)}</strong> (${t.services.length} servicios)</span>
            <div>
                <button data-idx="${idx}" class="load-template" style="background:none; border:none; cursor:pointer; font-size:1.2rem;">📂</button>
                <button data-idx="${idx}" class="del-template" style="background:none; border:none; cursor:pointer; font-size:1.2rem;">🗑️</button>
            </div>`;
        container.appendChild(div);
    });
    document.querySelectorAll('.load-template').forEach(btn => {
        btn.addEventListener('click', function() { loadTemplate(parseInt(this.dataset.idx)); });
    });
    document.querySelectorAll('.del-template').forEach(btn => {
        btn.addEventListener('click', function() {
            if (confirm('¿Eliminar plantilla?')) {
                const templates = getTemplates();
                templates.splice(parseInt(this.dataset.idx), 1);
                saveTemplates(templates);
                renderTemplates();
            }
        });
    });
}

function saveCurrentTemplate() {
    const name = document.getElementById('templateName').value.trim();
    if (!name) { alert('Ingrese un nombre.'); return; }
    const services = [];
    document.querySelectorAll('.extra-service-check:checked').forEach((cb, idx) => {
        const price = getPriceFromInput(document.getElementById(`price_${idx}`));
        services.push({ name: cb.value, price });
    });
    if (services.length === 0) { alert('Seleccione al menos un servicio.'); return; }
    const templates = getTemplates();
    templates.push({ name, services, procedure: document.getElementById('procedureSearch').value.trim() });
    saveTemplates(templates);
    document.getElementById('templateName').value = '';
    renderTemplates();
    alert('Plantilla guardada.');
}

function loadTemplate(idx) {
    const template = getTemplates()[idx];
    if (!template) return;
    document.querySelectorAll('.extra-service-check').forEach(cb => cb.checked = false);
    document.querySelectorAll('.service-price-input').forEach(inp => { inp.value = ''; inp.setAttribute('data-raw', ''); });
    template.services.forEach(s => {
        const i = defaultServices.findIndex(d => d.name === s.name);
        if (i !== -1) {
            const cb = document.getElementById(`service_${i}`);
            if (cb) cb.checked = true;
            const pi = document.getElementById(`price_${i}`);
            if (pi) { pi.value = s.price.toFixed(2); pi.setAttribute('data-raw', s.price.toString()); }
        }
    });
    if (template.procedure) document.getElementById('procedureSearch').value = template.procedure;
    closeTemplatesModal();
}

// ================================================================
//  SUGERENCIAS
// ================================================================
function renderSuggestions() {
    const suggestions = getSuggestions();
    const list = document.getElementById('suggestionList');
    list.innerHTML = '';
    if (suggestions.length === 0) { list.innerHTML = '<p>No hay sugerencias aún.</p>'; return; }
    suggestions.slice().reverse().forEach(s => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerHTML = `
            <div><strong>${escapeHtml(s.name)}</strong> ${s.email ? '&lt;' + escapeHtml(s.email) + '&gt;' : ''}</div>
            <div>${escapeHtml(s.message)}</div>
            <div class="meta">${new Date(s.timestamp).toLocaleString()}</div>`;
        list.appendChild(div);
    });
}

function checkProgrammerAccess() {
    const area = document.getElementById('programmerArea');
    if (currentUser === 'Lic. Daryl Villa') {
        area.style.display = 'block';
        renderSuggestions();
    } else {
        area.style.display = 'none';
    }
}

// ================================================================
//  SEGUIMIENTO
// ================================================================
function openFollowUp() {
    const quotes = getQuotes();
    const now = new Date();
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() - 7);
    const pendingOld = quotes.filter(q => {
        const d = new Date(q.date);
        return q.status === 'pendiente' && d < threshold && !q.reminder_sent;
    });
    const tbody = document.getElementById('followUpBody');
    tbody.innerHTML = '';
    if (pendingOld.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">✅ No hay cotizaciones pendientes antiguas.</td></tr>';
    } else {
        pendingOld.forEach(q => {
            const days = Math.floor((now - new Date(q.date)) / (1000 * 60 * 60 * 24));
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${q.quote_number}</td>
                <td>${escapeHtml(q.client)}</td>
                <td>${escapeHtml(q.procedure)}</td>
                <td>${days} días</td>
                <td><button class="btn-sm follow-send" data-qn="${q.quote_number}" style="background:#25D366; color:white; border:none; border-radius:6px; padding:0.3rem 0.8rem;">📨 Enviar recordatorio</button></td>`;
            tbody.appendChild(tr);
        });
        document.querySelectorAll('.follow-send').forEach(btn => {
            btn.addEventListener('click', function() {
                const qn = this.dataset.qn;
                const quotes = getQuotes();
                const q = quotes.find(x => x.quote_number === qn);
                if (!q) return;
                const phone = (q.phone || '').replace(/[^0-9+]/g, '').replace(/^\+/, '');
                const msg = `Hola ${q.client}, te recordamos el presupuesto para "${q.procedure}" por un total de $${(q.total || 0).toFixed(2)} USD. ¿Te gustaría avanzar?`;
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                const idx = quotes.findIndex(x => x.quote_number === qn);
                if (idx !== -1) { quotes[idx].reminder_sent = true; saveQuotes(quotes); }
                openFollowUp();
            });
        });
    }
    document.getElementById('followUpModal').classList.add('active');
}
function closeFollowUp() { document.getElementById('followUpModal').classList.remove('active'); }

// ================================================================
//  MODO OSCURO
// ================================================================
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const dark = document.body.classList.contains('dark-mode');
    localStorage.setItem('sqp_darkMode', dark ? 'true' : 'false');
    document.getElementById('darkModeToggle').textContent = dark ? '☀️' : '🌙';
}

// ================================================================
//  AYUDA
// ================================================================
function openHelpModal() {
    document.getElementById('helpModal').classList.add('active');
    if (currentUser === 'Lic. Daryl Villa') renderSuggestions();
}
function closeHelpModal() { document.getElementById('helpModal').classList.remove('active'); }

// ================================================================
//  EVENTOS
// ================================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Cotizador iniciado');

    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('loginPassword').addEventListener('keypress', e => {
        if (e.key === 'Enter') { e.preventDefault(); handleLogin(); }
    });
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    document.getElementById('profileBtn').addEventListener('click', openProfileModal);
    document.getElementById('closeProfileBtn').addEventListener('click', closeProfileModal);
    document.getElementById('updateProfileBtn').addEventListener('click', updateProfile);

    document.getElementById('adminDashboardBtn').addEventListener('click', openDashboard);
    document.getElementById('closeDashboardBtn').addEventListener('click', closeDashboard);
    document.getElementById('adminHistoryBtn').addEventListener('click', openHistoryModal);
    document.getElementById('closeHistoryBtn').addEventListener('click', closeHistoryModal);
    document.getElementById('adminUsersBtn').addEventListener('click', openUsersModal);
    document.getElementById('closeUsersBtn').addEventListener('click', closeUsersModal);
    document.getElementById('addUserBtn').addEventListener('click', addUser);
    document.getElementById('applyFiltersBtn').addEventListener('click', applyFilters);
    document.getElementById('clearFiltersBtn').addEventListener('click', clearFilters);

    document.getElementById('templatesBtn').addEventListener('click', openTemplatesModal);
    document.getElementById('closeTemplatesBtn').addEventListener('click', closeTemplatesModal);
    document.getElementById('saveTemplateBtn').addEventListener('click', saveCurrentTemplate);

    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);

    document.getElementById('followUpBtn').addEventListener('click', openFollowUp);
    document.getElementById('closeFollowUpBtn').addEventListener('click', closeFollowUp);

    document.getElementById('helpBtn').addEventListener('click', openHelpModal);
    document.getElementById('closeHelpBtn').addEventListener('click', closeHelpModal);

    document.getElementById('forgotPasswordLink').addEventListener('click', function() {
        document.getElementById('passwordModal').classList.add('active');
    });
    document.getElementById('closePasswordModalBtn').addEventListener('click', function() {
        document.getElementById('passwordModal').classList.remove('active');
    });
    document.getElementById('showPasswordBtn').addEventListener('click', function() {
        document.getElementById('passwordDisplay').textContent =
            '🔐 Las contraseñas están encriptadas. Contacta al administrador para restablecerla.';
    });

    document.getElementById('generateQuote').addEventListener('click', showSummary);
    document.getElementById('confirmGenerateBtn').addEventListener('click', confirmGenerate);
    document.getElementById('cancelGenerateBtn').addEventListener('click', cancelGenerate);

    document.getElementById('editQuote').addEventListener('click', function() {
        document.getElementById('formSection').style.display = 'block';
        document.getElementById('quoteResult').classList.remove('active');
    });
    document.getElementById('newQuote').addEventListener('click', resetForm);

    document.getElementById('whatsappBtn').addEventListener('click', sendWhatsApp);
    document.getElementById('previewPdfBtn').addEventListener('click', openPreview);
    document.getElementById('downloadPdfBtn').addEventListener('click', () => generateAndDownloadPDF(true));
    document.getElementById('closePreviewBtn').addEventListener('click', closePreview);
    document.getElementById('downloadPdfFromPreview').addEventListener('click', downloadFromPreview);

    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });
    });

    document.getElementById('procedureSearch').addEventListener('change', function() {
        autoSelectRequirements(this.value);
    });
    document.getElementById('procedureSearch').addEventListener('input', function() {
        const opts = document.getElementById('proceduresList').options;
        for (let o of opts) {
            if (o.value === this.value) { autoSelectRequirements(this.value); break; }
        }
    });

    document.getElementById('clientPhone').addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9+]/g, '');
    });

    document.getElementById('suggestionForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const message = document.getElementById('suggestionMessage').value.trim();
        if (!message) { alert('Escribe un mensaje.'); return; }
        const suggestions = getSuggestions();
        suggestions.push({
            name: document.getElementById('suggestionName').value.trim() || 'Anónimo',
            email: document.getElementById('suggestionEmail').value.trim(),
            message,
            timestamp: Date.now()
        });
        saveSuggestions(suggestions);
        document.getElementById('suggestionMessage').value = '';
        document.getElementById('suggestionName').value = '';
        document.getElementById('suggestionEmail').value = '';
        document.getElementById('suggestionStatus').textContent = '✅ Sugerencia enviada, ¡gracias!';
        setTimeout(() => document.getElementById('suggestionStatus').textContent = '', 3000);
        if (currentUser === 'Lic. Daryl Villa') renderSuggestions();
    });

    document.getElementById('clearSuggestionsBtn')?.addEventListener('click', function() {
        if (confirm('¿Borrar todas las sugerencias?')) {
            saveSuggestions([]);
            renderSuggestions();
        }
    });

    const session = getSession();
    if (session) {
        currentUser = session.user;
        currentRole = session.role;
        document.getElementById('loginScreen').style.display = 'none';
        showApp();
    } else {
        document.getElementById('loginScreen').style.display = 'block';
        document.getElementById('mainApp').style.display = 'none';
    }

    buildServicesList();
    buildRequirementsList();
});
