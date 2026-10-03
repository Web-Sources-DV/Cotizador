const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(role='ADMIN',result={data:{id:'new-user'}}) {
 const elements=new Map(); let invoked;
 const get=id=>{
  if(!elements.has(id))elements.set(id,{value:'',textContent:'',disabled:false,checkValidity:()=>true,classList:{remove(){}}});
  return elements.get(id);
 };
 const context=vm.createContext({Map,Set,Promise,JSON,console,alert(){},
  document:{getElementById:get,addEventListener(){}},
  window:{supabase:{createClient:()=>({functions:{invoke:async(name,args)=>{invoked={name,args};return result}}})}}});
 vm.runInContext(fs.readFileSync('app.js','utf8'),context);
 vm.runInContext("currentAuthRole="+JSON.stringify(role)+";currentAuthUserId='admin';renderUsersList=async()=>{};",context);
 get('newUsername').value='Fixture';get('newUserEmail').value='fixture@example.invalid';
 get('newUserPassword').value='Test-password-123!';get('newUserRole').value='SUPERVISOR';
 return {context,get,invoke:()=>vm.runInContext('addUser()',context),request:()=>invoked};
}
test('admin creates selected role through server and clears password',async()=>{
 const h=setup();await h.invoke();
 assert.equal(h.request().name,'cotizador-users');
 assert.equal(h.request().args.body.role,'SUPERVISOR');
 assert.equal(h.get('newUserPassword').value,'');
 assert.equal(h.get('addUserBtn').disabled,false);
 assert.match(h.get('newUserStatus').textContent,/Usuario creado/);
});
test('executive cannot submit account creation',async()=>{
 const h=setup('EXECUTIVE');await h.invoke();assert.equal(h.request(),undefined);
});
test('failed creation clears password and shows useful server message',async()=>{
 const h=setup('ADMIN',{error:{context:{json:async()=>({error:'Correo ya registrado'})}}});
 await h.invoke();assert.equal(h.get('newUserPassword').value,'');
 assert.equal(h.get('newUserStatus').textContent,'Correo ya registrado');
 assert.equal(h.get('addUserBtn').disabled,false);
});
test('invalid new password prevents API request',async()=>{
 const h=setup();h.get('newUserPassword').value='short';await h.invoke();
 assert.equal(h.request(),undefined);
});
