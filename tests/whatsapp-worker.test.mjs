import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../whatsapp-worker/worker.mjs';
const env = { ALLOWED_ORIGIN:'https://web-sources-dv.github.io', API_SHARED_KEY:'unit-test-server-key', META_ACCESS_TOKEN:'unit-test-meta-token', META_PHONE_NUMBER_ID:'123456789' };
function request({ phone='50760001234', message='Presupuesto de prueba $300', key=env.API_SHARED_KEY, origin=env.ALLOWED_ORIGIN, file='%PDF-1.7 test', type='application/pdf' } = {}) {
    const body = new FormData();
    body.set('phone', phone); body.set('message', message);
    body.set('file', new File([file], 'Presupuesto.pdf', { type }));
    return new Request('https://worker.test/send-quote', { method:'POST', headers:{ Origin:origin, Authorization:`Bearer ${key}` }, body });
}
const mustNotFetch = () => { throw new Error('Meta must not be called'); };

test('uploads actual PDF and sends document with the exact recipient and caption', async () => {
    const calls = [];
    const response = await handleRequest(request(), env, async (url, options) => {
        calls.push(url);
        assert.equal(options.headers.Authorization, `Bearer ${env.META_ACCESS_TOKEN}`);
        if (url.endsWith('/media')) {
            assert.equal(options.body.get('messaging_product'), 'whatsapp');
            assert.equal(await options.body.get('file').text(), '%PDF-1.7 test');
            return Response.json({ id:'media-id' });
        }
        const sent = JSON.parse(options.body);
        assert.equal(sent.to, '50760001234');
        assert.equal(sent.type, 'document');
        assert.equal(sent.document.id, 'media-id');
        assert.equal(sent.document.caption, 'Presupuesto de prueba $300');
        return Response.json({ messages:[{ id:'message-id' }] });
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { accepted:true, messageId:'message-id' });
    assert.equal(calls.length, 2);
});

test('rejects unauthenticated and foreign-origin requests before calling Meta', async () => {
    assert.equal((await handleRequest(request({ key:'wrong' }),env,mustNotFetch)).status,401);
    assert.equal((await handleRequest(request({ origin:'https://foreign.test' }),env,mustNotFetch)).status,403);
});

test('rejects malformed phone, text, and fake PDF', async () => {
    for (const options of [{ phone:'6000' }, { message:'x'.repeat(1025) }, { file:'not a PDF' }, { type:'text/plain' }]) {
        assert.equal((await handleRequest(request(options), env, mustNotFetch)).status,400);
    }
});

test('does not send a message if upload fails', async () => {
    let calls=0;
    const response=await handleRequest(request(), env, async () => { calls++; return Response.json({ error:{ code:190 } },{ status:401 }); });
    assert.equal(response.status,502); assert.equal(calls,1);
    assert.ok(!JSON.stringify(await response.json()).includes(env.META_ACCESS_TOKEN));
});

test('reports the Meta 24-hour conversation restriction', async () => {
    const response=await handleRequest(request(), env, async url => url.endsWith('/media')
        ? Response.json({ id:'media-id' })
        : Response.json({ error:{ code:131047 } },{ status:400 }));
    assert.equal(response.status,502); assert.match((await response.json()).error,/24 horas/);
});

test('missing configuration stays blocked and preflight uses an exact origin', async () => {
    assert.equal((await handleRequest(request(), {ALLOWED_ORIGIN:env.ALLOWED_ORIGIN}, mustNotFetch)).status,503);
    const response = await handleRequest(new Request('https://worker.test/send-quote',{ method:'OPTIONS',headers:{Origin:env.ALLOWED_ORIGIN}}),env,mustNotFetch);
    assert.equal(response.status,204);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'),env.ALLOWED_ORIGIN);
});
