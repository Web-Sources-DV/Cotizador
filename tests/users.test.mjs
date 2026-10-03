import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../supabase/functions/cotizador-users/handler.mjs';
const caller='00000000-0000-4000-8000-000000000001';
const valid={name:'Test Executive',email:'test@example.invalid',password:'Fixture-only-123!',role:'EXECUTIVE'};
function setup({role='ADMIN',active=true,auth=true,createStatus=201,createBody={id:'new-id'}}={}){
 const calls=[];
 const handler=createHandler({supabaseUrl:'https://example.invalid',anonKey:'public-test-key',serviceKey:'server-test-key',
 fetchImpl:async(url,options)=>{
  calls.push({url,options});
  if(url.endsWith('/auth/v1/user'))return new Response(JSON.stringify(auth?{id:caller}:{}),{status:auth?200:401});
  if(url.includes('/rest/v1/sqp_profiles'))return Response.json([{role,active}]);
  return new Response(JSON.stringify(createBody),{status:createStatus});
 }});
 return {handler,calls};
}
const request=(body=valid,token='test-token',origin='https://web-sources-dv.github.io')=>new Request('https://edge.invalid',{
 method:'POST',headers:{Authorization:'Bearer '+token,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('active admin creates a new account with selected role, no existing account update',async()=>{
 const h=setup();const response=await h.handler(request());
 assert.equal(response.status,201);assert.equal(h.calls.length,3);
 const create=h.calls[2]; assert.ok(create.url.endsWith('/auth/v1/admin/users'));
 assert.equal(create.options.method,'POST');
 const payload=JSON.parse(create.options.body);
 assert.equal(payload.app_metadata.role,'EXECUTIVE');assert.equal(payload.user_metadata.full_name,valid.name);
 const output=await response.text();assert.ok(!output.includes(valid.password));assert.ok(!output.includes('server-test-key'));
});
test('all existing roles can be assigned by an authorized admin',async()=>{
 for(const role of ['ADMIN','SUPERVISOR','EXECUTIVE','VIEWER']){
  const h=setup();assert.equal((await h.handler(request({...valid,role}))).status,201);
  assert.equal(JSON.parse(h.calls[2].options.body).app_metadata.role,role);
 }
});
test('executive, viewer, supervisor and inactive admin cannot create users',async()=>{
 for(const config of [{role:'EXECUTIVE'},{role:'VIEWER'},{role:'SUPERVISOR'},{active:false}]){
  const h=setup(config);assert.equal((await h.handler(request())).status,403);assert.equal(h.calls.length,2);
 }
});
test('invalid or missing authentication never reaches admin API',async()=>{
 const h=setup({auth:false});assert.equal((await h.handler(request())).status,401);assert.equal(h.calls.length,1);
 const noHeader=new Request('https://edge.invalid',{method:'POST',body:'{}'});
 assert.equal((await h.handler(noHeader)).status,401);assert.equal(h.calls.length,1);
});
test('bad origin rejected and preflight has no side effects',async()=>{
 const h=setup();assert.equal((await h.handler(request(valid,'test','https://evil.invalid'))).status,403);
 assert.equal((await h.handler(new Request('https://edge.invalid',{method:'OPTIONS'}))).status,204);
 assert.equal(h.calls.length,0);
});
test('invalid input, extra privilege fields and duplicates cannot overwrite a user',async()=>{
 for(const body of [{...valid,role:'OWNER'},{...valid,email:'bad'},{...valid,password:'short'},null]){
  const h=setup();assert.equal((await h.handler(request(body))).status,400);assert.equal(h.calls.length,2);
 }
 const h=setup({createStatus:422,createBody:{code:'email_exists'}});
 assert.equal((await h.handler(request({...valid,id:caller,app_metadata:{superuser:true}}))).status,409);
 assert.equal(h.calls.length,3);
 assert.equal(JSON.parse(h.calls[2].options.body).id,undefined);
});
test('network failure gives a safe error without credentials',async()=>{
 const handler=createHandler({supabaseUrl:'https://example.invalid',anonKey:'a',serviceKey:'s',fetchImpl:()=>{throw Error('s')}});
 const response=await handler(request());assert.equal(response.status,503);
 assert.match((await response.json()).error,/Servicio no disponible/);
});
