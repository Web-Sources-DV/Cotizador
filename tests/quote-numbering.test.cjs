const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
for(const filename of ['index.html','app.js']) {
 const source=fs.readFileSync(path.join(__dirname,'..',filename),'utf8');
 const numbering=source.slice(source.indexOf('function getCounter()'),source.indexOf('function getTemplates()'));
 const saving=source.slice(source.indexOf('let quoteSaveInProgress'),source.indexOf('function cancelGenerate()'));
 function setup({history=[],stored='0',failSave=false}={}) {
  const storage=new Map([['sqp_counter',stored]]);let quotes=structuredClone(history);const alerts=[];
  const fields={clientName:{value:'Cliente'},clientId:{value:''},clientEmail:{value:''},confirmGenerateBtn:{disabled:false},summaryModal:{classList:{remove(){}}}};
  const context=vm.createContext({COUNTER_KEY:'sqp_counter',localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},getQuotes:()=>structuredClone(quotes),saveQuotes:value=>{if(failSave)throw new Error('almacenamiento lleno');quotes=structuredClone(value)},crypto:webcrypto,Uint8Array,Intl,Date,structuredClone,navigator:{locks:{request:async(_name,save)=>{await Promise.resolve();return save()}}},document:{getElementById:id=>fields[id]},clientPhoneValue:()=>'+50760001234',alert:msg=>alerts.push(msg),displayQuote(){},pendingGenerate:{subtotal:100,discount:0,services:[]},lastQuoteData:null});
  vm.runInContext(numbering+saving,context);
  return {context,storage,quotes:()=>quotes,alerts,fields};
 }
 test(`${filename}: recovers the next count from history even with reset or malformed counter`,()=>{
  for(const stored of ['0','NaN','-1','1.5']) {
   const state=setup({stored,history:[{quote_number:'COT-2025-0120'},{quote_number:'COT-2026-0034-ABC'}]});
   assert.equal(vm.runInContext('incrementCounter()',state.context),121);
   assert.equal(state.storage.get('sqp_counter'),'121');assert.equal(state.quotes().length,2);
  }
 });
 test(`${filename}: separate clean browsers produce distinct complete references`,()=>{
  const a=setup(),b=setup();const refs=new Set();
  for(let i=0;i<500;i++)refs.add(vm.runInContext('createQuoteNumber(1,[])',i%2?a.context:b.context));
  assert.equal(refs.size,500);for(const ref of refs)assert.match(ref,/^COT-\d{4}-0001-[0-9A-F]{32}$/);
 });
 test(`${filename}: double confirmation saves once; editing retains number and counter`,async()=>{
  const state=setup();await Promise.all([vm.runInContext('confirmGenerate()',state.context),vm.runInContext('confirmGenerate()',state.context)]);
  assert.equal(state.quotes().length,1);const first=state.quotes()[0].quote_number;
  assert.equal(state.storage.get('sqp_counter'),'1');
  vm.runInContext('pendingGenerate={subtotal:200,discount:0,services:[]}',state.context);
  await vm.runInContext('confirmGenerate()',state.context);
  assert.equal(state.quotes().length,1);assert.equal(state.quotes()[0].quote_number,first);assert.equal(state.quotes()[0].total,200);assert.equal(state.storage.get('sqp_counter'),'1');
 });
 test(`${filename}: failed save retains the confirmation for retry without reporting success`,async()=>{
  const state=setup({failSave:true});await vm.runInContext('confirmGenerate()',state.context);
  assert.equal(state.quotes().length,0);assert.equal(state.alerts.length,1);assert.ok(vm.runInContext('pendingGenerate',state.context));assert.equal(state.fields.confirmGenerateBtn.disabled,false);
 });
}
