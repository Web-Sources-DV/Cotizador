const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('usage-report.js','utf8');
function harness(rpc) {
 const elements=new Map();
 function element() { return {hidden:false,disabled:false,value:'',textContent:'',children:[],classList:{add(){},remove(){}},
  replaceChildren(){this.children=[]},appendChild(child){this.children.push(child)},addEventListener(){} }; }
 const get=id=>{if(!elements.has(id))elements.set(id,element()); return elements.get(id)};
 let ready;
 const context=vm.createContext({Intl,Date,Number,String,currentAuthUserId:'owner',
  sqpSupabase:{rpc,auth:{onAuthStateChange(){}}},
  document:{getElementById:get,createElement:element,addEventListener(name,fn){ready=fn}}});
 vm.runInContext(source+'\nglobalThis.report=usageReport;',context);
 ready();
 return {context,get,report:context.report};
}
test('denied user cannot see or invoke report',async()=>{
 let calls=0; const h=harness(async()=>{calls++;return {data:false}});
 await h.report.refreshAccess(); await h.report.load(); h.report.open();
 assert.equal(h.get('usageReportBtn').hidden,true); assert.equal(calls,1);
});
test('authorized report renders safe text and 30 calendar days',async()=>{
 let args;
 const h=harness(async(name,params)=>name==='can_view_cotizador_usage'?{data:true}:
  (args=params,{data:[{executive_name:'<img src=x onerror=alert(1)>',active:true,total:3,average_per_day:.1}]}));
 await h.report.refreshAccess(); assert.equal(h.get('usageReportBtn').hidden,false);
 h.report.open(); await new Promise(setImmediate);
 assert.equal((Date.parse(args.end_date)-Date.parse(args.start_date))/86400000+1,30);
 assert.equal(h.get('usageReportBody').children[0].children[0].textContent,'<img src=x onerror=alert(1)>');
 assert.equal(h.get('usageReportBody').children[0].children[2].textContent,'3');
});
test('logout discards a report response in flight',async()=>{
 let finish;
 const h=harness(async name=>name==='can_view_cotizador_usage'?{data:true}:new Promise(resolve=>finish=resolve));
 await h.report.refreshAccess();
 h.get('usageReportStart').value='2026-01-01';h.get('usageReportEnd').value='2026-01-01';
 const pending=h.report.load();
 h.context.currentAuthUserId=null; h.report.reset();
 finish({data:[{executive_name:'Private',active:true,total:1,average_per_day:1}]}); await pending;
 assert.equal(h.get('usageReportBody').children.length,0);
 assert.equal(h.get('usageReportBtn').hidden,true);
 assert.equal(h.get('usageReportRefresh').disabled,false);
});
test('invalid range does not invoke report RPC',async()=>{
 let calls=0;const h=harness(async()=>{calls++;return {data:true}});
 await h.report.refreshAccess();
 h.get('usageReportStart').value='2026-01-02';h.get('usageReportEnd').value='2026-01-01';
 await h.report.load();assert.equal(calls,1);
 assert.match(h.get('usageReportStatus').textContent,/Selecciona/);
});
test('RPC permission revoked clears already displayed results',async()=>{
 const h=harness(async name=>name==='can_view_cotizador_usage'?{data:true}:{error:{code:'42501'}});
 await h.report.refreshAccess();
 h.get('usageReportStart').value='2026-01-01';h.get('usageReportEnd').value='2026-01-01';
 await h.report.load(); assert.equal(h.get('usageReportBtn').hidden,true);
 assert.equal(h.get('usageReportBody').children.length,0);
});
test('permission endpoint outage leaves quoting independent',async()=>{
 const h=harness(async()=>{throw Error('offline')});
 await h.report.refreshAccess();assert.equal(h.get('usageReportBtn').hidden,true);
});
