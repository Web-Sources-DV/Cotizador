const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
for(const file of ['index.html','app.js']) {
 const code=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 const fieldCode=code.slice(code.indexOf('function hasPasswordlessAccess('),code.indexOf('function usageDay('));
 const loginCode=code.slice(code.indexOf('async function handleLogin('),code.indexOf('function handleLogout('));
 function setup(username,password='') {
  const fields={loginUserSelect:{value:username},loginPassword:{value:password,hidden:false,disabled:false},loginError:{textContent:''},loginScreen:{style:{}}};
  const users={ 'Lic. Oscaris Ugas':{password:'saved-hash',salt:'saved-salt',role:'executive'}, 'Lic. Daryl Villa':{password:'saved-hash',salt:'saved-salt',role:'admin'}, 'Lic. Susana Sabalza':{password:'saved-hash',salt:'saved-salt',role:'admin'} };
  let session=null;
  const context=vm.createContext({document:{getElementById:id=>fields[id]},getUsers:()=>users,saveUsers(){},verifyPassword:async value=>value==='correct',hashPassword:async()=>{throw new Error('No password should be created')},setSession:(user,role)=>session={user,role},showApp(){},setTimeout:fn=>fn(),console,currentUser:null,currentRole:null});
  vm.runInContext(fieldCode+loginCode,context);
  return {context,fields,users,session:()=>session};
 }
 test(`${file}: Oscaris and Daryl bypass and clear old passwords without changing roles`,async()=>{
  for(const [username,role] of [['Lic. Oscaris Ugas','executive'],['Lic. Daryl Villa','admin']]) {
   const state=setup(username);vm.runInContext('updateLoginPasswordField()',state.context);assert.equal(state.fields.loginPassword.hidden,true);assert.equal(state.fields.loginPassword.disabled,true);
   await vm.runInContext('handleLogin()',state.context);
   assert.deepEqual(state.session(),{user:username,role});assert.equal(state.users[username].password,null);assert.equal(state.users[username].salt,null);assert.equal(state.users[username].role,role);
  }
 });
 test(`${file}: other accounts still require and verify their saved password`,async()=>{
  const state=setup('Lic. Susana Sabalza');vm.runInContext('updateLoginPasswordField()',state.context);assert.equal(state.fields.loginPassword.hidden,false);assert.equal(state.fields.loginPassword.disabled,false);
  await vm.runInContext('handleLogin()',state.context);assert.match(state.fields.loginError.textContent,/Ingrese una contraseña/);assert.equal(state.session(),null);
  state.fields.loginPassword.value='wrong';await vm.runInContext('handleLogin()',state.context);assert.match(state.fields.loginError.textContent,/incorrecta/);assert.equal(state.session(),null);
  state.fields.loginPassword.value='correct';await vm.runInContext('handleLogin()',state.context);assert.equal(state.session().user,'Lic. Susana Sabalza');assert.equal(state.users['Lic. Susana Sabalza'].password,'saved-hash');
  assert.equal(vm.runInContext("hasPasswordlessAccess('Otro usuario')",state.context),false);
 });
}
