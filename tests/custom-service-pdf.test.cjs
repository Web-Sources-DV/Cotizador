const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
for(const file of ['index.html','app.js']) {
 const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 const pdf=source.slice(source.indexOf('function generatePdfHTML('),source.indexOf('//  LOGIN',source.indexOf('function generatePdfHTML(')));
 const pricing=source.slice(source.indexOf('function quotePricingFromForm()'),source.indexOf('function updateQuotePricing()'));
 function setup(customName='Antecedentes apostillados') {
  const fields={peopleCount:{value:'2'},price_0:{value:'500'},otherServiceName:{value:customName},proceduresList:{options:[]}};
  const context=vm.createContext({document:{getElementById:id=>fields[id],querySelectorAll:()=>[{checked:true,value:'Otros'}]},getPriceFromInput:field=>Number(field.value),FIXED_OBSERVATIONS_MESSAGE:'Condiciones fijas',escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')});
  vm.runInContext(pdf+pricing,context);return context;
 }
 test(`${file}: custom service keeps its name, stable key and per-person price`,()=>{
  const ctx=setup();const quote=vm.runInContext('quotePricingFromForm()',ctx);
  assert.equal(quote.total,1000);assert.equal(quote.services[0].name,'Antecedentes apostillados');assert.equal(quote.services[0].serviceKey,'Otros');assert.equal(quote.services[0].quantity,2);assert.equal(quote.services[0].unitPrice,500);
  ctx.quote=quote;const html=vm.runInContext('generatePdfHTML(quote)',ctx);
  assert.match(html,/Antecedentes apostillados/);assert.match(html,/data-translation-source="custom"/);
  assert.equal(vm.runInContext('quotePricingFromForm().services[0].name',setup('   ')),'Otros');
 });
 test(`${file}: absent requirements omit the entire block; selected requirements still appear`,()=>{
  const ctx=setup();const empty=vm.runInContext('generatePdfHTML({requirements:[]})',ctx);
  assert.ok(!empty.includes('REQUISITOS Y DOCUMENTACIÓN REQUERIDA'));assert.ok(!empty.includes('No se requieren documentos adicionales'));
  assert.ok(empty.includes('OBSERVACIONES Y CONDICIONES'));assert.ok(empty.includes('Condiciones fijas'));
  const selected=vm.runInContext("generatePdfHTML({requirements:['Pasaporte vigente']})",ctx);
  assert.ok(selected.includes('REQUISITOS Y DOCUMENTACIÓN REQUERIDA'));assert.ok(selected.includes('Pasaporte vigente'));
 });
 test(`${file}: custom names render as text instead of HTML`,()=>{
  const ctx=setup('<img src=x onerror=alert(1)>');const html=vm.runInContext('generatePdfHTML(quotePricingFromForm())',ctx);
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));assert.ok(!html.includes('<img src=x'));
 });
}
