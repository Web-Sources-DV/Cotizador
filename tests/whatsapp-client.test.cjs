const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function setup({ popupBlocked = false, failPdf = false, phone = '50760001234' } = {}) {
    const rows = {};
    const element = id => rows[id] ||= { disabled:false, textContent:'', addEventListener() {}, replaceChildren(...children) { this.children = children; } };
    const popup = { opener:{}, closed:false, document:{ body:{} }, location:{ replace(url) { popup.url=url; } }, close() { this.closed=true; } };
    let downloads=0, alerts=0, opened=0;
    const file = { name:'Presupuesto.pdf' };
    const context = vm.createContext({
        window: { WHATSAPP_BUSINESS_CONFIG:{ endpoint:'' }, open() { opened++;return popupBlocked ? null : popup; } },
        document:{ getElementById:element, createElement:()=>({}), createTextNode:text=>text },
        lastQuoteData:{ phone, client:'Prueba', procedure:'Visa', total:100 }, currentUser:'Ejecutivo', getUsers:()=>({}),
        normalizeWhatsAppPhone:value=>/^\d{11}$/.test(value) ? value : null,
        buildPdfFile:async () => { if(failPdf)throw new Error('PDF falló');return file; },
        downloadPdfFile:actual=>{ assert.equal(actual,file);downloads++; },
        alert:()=>alerts++, structuredClone, URL
    });
    vm.runInContext(readFileSync(path.join(__dirname,'../whatsapp-business.js'),'utf8'),context);
    return { context,popup,rows,stats:()=>({ downloads,alerts,opened }) };
}
for(const mode of ['web','business']) test(`${mode}: downloads PDF and keeps the exact recipient and message`,async()=>{
    const state=setup();await vm.runInContext(`openWhatsAppWithPdf('${mode}')`,state.context);
    const url=new URL(state.popup.url);
    assert.equal(url.hostname,mode==='web'?'web.whatsapp.com':'wa.me');
    assert.equal(mode==='web'?url.searchParams.get('phone'):url.pathname.slice(1),'50760001234');
    assert.match(url.searchParams.get('text'),/\$100\.00/);
    assert.equal(state.stats().downloads,1);
    assert.equal(state.popup.opener,null);
});
test('blocked popup offers a link to the same client after downloading PDF',async()=>{
    const state=setup({popupBlocked:true});await vm.runInContext("openWhatsAppWithPdf('web')",state.context);
    assert.equal(state.stats().downloads,1);
    const link=state.rows.businessWhatsAppStatus.children[1];
    assert.equal(new URL(link.href).searchParams.get('phone'),'50760001234');
});
test('invalid phone and failed PDF never open the client chat',async()=>{
    const invalid=setup({phone:''});await vm.runInContext("openWhatsAppWithPdf('web')",invalid.context);
    assert.equal(invalid.stats().opened,0);assert.equal(invalid.stats().downloads,0);
    const broken=setup({failPdf:true});await vm.runInContext("openWhatsAppWithPdf('business')",broken.context);
    assert.equal(broken.popup.closed,true);assert.equal(broken.popup.url,undefined);assert.equal(broken.stats().downloads,0);
});
