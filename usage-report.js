/* Report authorization is checked by the RPC on every request. */
const usageReport = (() => {
    let allowed = false;
    let version = 0;
    const el = id => document.getElementById(id);
    const today = () => new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    function reset() {
        allowed = false;
        version++;
        el('usageReportRefresh').disabled = false;
        el('usageReportBtn').hidden = true;
        el('usageReportModal').classList.remove('active');
        el('usageReportBody').replaceChildren();
        el('usageReportStatus').textContent = '';
    }
    async function refreshAccess() {
        reset();
        const request = version;
        try {
            const { data, error } = await sqpSupabase.rpc('can_view_cotizador_usage');
            if (request !== version || !currentAuthUserId) return;
            allowed = !error && data === true;
            el('usageReportBtn').hidden = !allowed;
        } catch { /* Optional report must never block normal quoting. */ }
    }
    function defaultRange() {
        const end = today();
        const start = new Date(end + 'T12:00:00Z');
        start.setUTCDate(start.getUTCDate() - 29);
        el('usageReportStart').value = start.toISOString().slice(0, 10);
        el('usageReportEnd').value = end;
        el('usageReportStart').max = end;
        el('usageReportEnd').max = end;
    }
    async function load() {
        if (!allowed || !currentAuthUserId) return;
        const start = el('usageReportStart').value;
        const end = el('usageReportEnd').value;
        const days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
        el('usageReportBody').replaceChildren();
        if (!Number.isInteger(days) || days < 1 || days > 366 || end > today()) {
            el('usageReportStatus').textContent = 'Selecciona de 1 a 366 días, sin fechas futuras.';
            return;
        }
        const request = ++version;
        el('usageReportStatus').textContent = 'Cargando…';
        el('usageReportRefresh').disabled = true;
        try {
            const { data, error } = await sqpSupabase.rpc('cotizador_usage_report', {
                start_date: start, end_date: end
            });
            if (request !== version || !currentAuthUserId) return;
            if (error) throw error;
            for (const row of data || []) {
                const tr = document.createElement('tr');
                for (const value of [
                    row.executive_name || row.executive_id,
                    row.active ? 'Activo' : 'Inactivo',
                    String(row.total),
                    Number(row.average_per_day).toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                ]) {
                    const td = document.createElement('td');
                    td.textContent = value;
                    tr.appendChild(td);
                }
                el('usageReportBody').appendChild(tr);
            }
            el('usageReportStatus').textContent = (data || []).length
                ? days + ' días calendario. Promedio = total ÷ días del período.'
                : 'No hay ejecutivos registrados para mostrar.';
        } catch (error) {
            if (request !== version) return;
            if (error.code === '42501') {
                reset();
            } else {
                el('usageReportStatus').textContent = 'No se pudo cargar el reporte. Inténtalo de nuevo.';
            }
        } finally {
            if (request === version) el('usageReportRefresh').disabled = false;
        }
    }
    function open() {
        if (!allowed || !currentAuthUserId) return;
        defaultRange();
        el('usageReportModal').classList.add('active');
        load();
    }
    function close() {
        version++;
        el('usageReportModal').classList.remove('active');
        el('usageReportBody').replaceChildren();
        el('usageReportRefresh').disabled = false;
    }
    document.addEventListener('DOMContentLoaded', () => {
        sqpSupabase.auth.onAuthStateChange(event => {
            if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') reset();
        });
        el('usageReportBtn').addEventListener('click', open);
        el('usageReportClose').addEventListener('click', close);
        el('usageReportRefresh').addEventListener('click', load);
    });
    return { refreshAccess, reset, open, load, close };
})();
