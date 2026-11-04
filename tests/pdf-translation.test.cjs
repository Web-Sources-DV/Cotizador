const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function setup({native,fetch}={}) {
 const fields={pdfLanguageStatus:{textContent:''}};
 const context=vm.createContext({window:native?{Translator:native}:{}, document:{getElementById:id=>fields[id],createElement:()=>({set innerHTML(text){this.value=text},value:''})},fetch:fetch||(()=>{throw new Error('No request expected')}),URL,TextEncoder,AbortController,AbortSignal,NodeFilter:{SHOW_TEXT:4},generatePdfHTML:data=>data.html});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../pdf-translation.js'),'utf8'),context);
 return {context,fields};
}
test('uses native translation when supported without sending text to the network',async()=>{
 let destroyed=false;
 const {context}=setup({native:{availability:async()=> 'available',create:async()=>({translate:async text=>'EN '+text,destroy(){destroyed=true}})}});
 const result=await vm.runInContext("(async()=>{const t=await pdfTextTranslator('es','en',new AbortController().signal,{textContent:''});const text=await t.translate('Presupuesto');t.destroy();return text})()",context);
 assert.equal(result,'EN Presupuesto');assert.equal(destroyed,true);
});
test('online fallback respects UTF-8 limits and keeps words intact',async()=>{
 const calls=[];
 const {context}=setup({fetch:async url=>{const text=url.searchParams.get('q');calls.push(text);return {ok:true,json:async()=>({responseStatus:200,responseData:{translatedText:text,match:1}})}}});
 const text='documentación válida '.repeat(70).trim();context.text=text;
 assert.equal(await vm.runInContext("onlinePdfText(text,'es','en',new AbortController().signal)",context),text);
 assert.ok(calls.length>1);for(const chunk of calls){assert.ok(new TextEncoder().encode(chunk).length<=450);assert.match(chunk,/^(documentación|válida)/);assert.match(chunk,/(documentación|válida)$/)}
});
test('rejects fuzzy memory and selects the translation of the exact original text',async()=>{
 const {context}=setup({fetch:async()=>({ok:true,json:async()=>({responseStatus:200,responseData:{translatedText:'2 passport photos',match:0.9},matches:[{segment:'2 fotos tamaño carnet',translation:'2 passport photos'},{segment:'Fotos tamaño carnet',translation:'Passport-sized photos'}]})})});
 assert.equal(await vm.runInContext("onlinePdfText('Fotos tamaño carnet','es','en',new AbortController().signal)",context),'Passport-sized photos');
});
test('translation service quota errors do not count as translated content',async()=>{
 const {context}=setup({fetch:async()=>({ok:true,json:async()=>({responseStatus:403,quotaFinished:true,responseData:{translatedText:'LIMIT'}})})});
 await assert.rejects(vm.runInContext("onlinePdfText('Presupuesto','es','fr',new AbortController().signal)",context),/límite diario/);
});
test('only quote prose is translated; protected identities and numeric cells are excluded',()=>{
 const {context}=setup();const specs=[['COTIZACIÓN',false,false],['Jean Test',true,false],['$250.00',false,false],['Please bring a passport.',false,true],['FEES',false,false],['constructor',false,true]];
 const nodes=specs.map(([text,protectedValue,custom])=>({nodeValue:text,parentElement:{closest:selector=>selector.includes('translate="no"')?protectedValue:custom}}));
 context.root={ownerDocument:{createTreeWalker(){let i=-1;return {nextNode(){i++;this.currentNode=nodes[i];return i<nodes.length}}}}};
 const result=JSON.parse(vm.runInContext("JSON.stringify(pdfTranslationNodes(root,'en').map(({text,source})=>({text,source})))",context));
 assert.deepEqual(result,[{text:'COTIZACIÓN',source:'es'},{text:'Please bring a passport.',source:'en'},{text:'FEES',source:'es'},{text:'constructor',source:'en'}]);
});
test('customer language only applies to the identical original quote and can be reverted',()=>{
 const {context,fields}=setup();vm.runInContext("clientPdfTranslation={original:'original',html:'translated',language:'en'}",context);
 assert.equal(vm.runInContext("clientPdfHTML({html:'original'})",context),'translated');
 assert.equal(vm.runInContext("clientPdfLanguage({html:'original'})",context),'en');
 assert.equal(vm.runInContext("clientPdfHTML({html:'edited'})",context),'edited');
 assert.match(fields.pdfLanguageStatus.textContent,/español original/);
 assert.equal(vm.runInContext("clientPdfLanguage({html:'original'})",context),'es');
});

test('catalog procedures stay Spanish source while free text keeps its selected origin',()=>{
 for(const filename of ['index.html','app.js']) {
  const source=fs.readFileSync(path.join(__dirname,'..',filename),'utf8');
  const fn=source.slice(source.indexOf('function generatePdfHTML('),source.indexOf('//  LOGIN',source.indexOf('function generatePdfHTML(')));
  const context=vm.createContext({document:{getElementById:()=>({options:[{value:'Permiso de trabajo.'}]})},escapeHtml:text=>String(text),FIXED_OBSERVATIONS_MESSAGE:'Condiciones fijas'});
  vm.runInContext(fn,context);
  assert.match(vm.runInContext("generatePdfHTML({procedure:'Permiso de trabajo.',observations:'Please bring your passport.'})",context),/data-translation-source="es"[^>]*>Permiso de trabajo\.</);
  assert.match(vm.runInContext("generatePdfHTML({procedure:'Work permit application'})",context),/data-translation-source="custom"[^>]*>Work permit application</);
 }
});
