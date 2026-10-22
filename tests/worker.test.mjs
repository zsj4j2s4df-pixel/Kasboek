import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.mjs';
test('all public responses carry browser protection and no-store',()=>{
  for(const path of ['/','/app.js','/security.js','/manifest.json','/icon-192.png','/missing']){
    const r=worker.fetch(new Request('https://example.test'+path));
    assert.equal(r.headers.get('x-frame-options'),'DENY');
    assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);
    assert.match(r.headers.get('content-security-policy'),/connect-src 'none'/);
    assert.doesNotMatch(r.headers.get('content-security-policy'),/script-src[^;]*unsafe-inline/);
    assert.equal(r.headers.get('cache-control'),'no-store');
  }
});
test('private and source files are not served; only GET/HEAD accepted',()=>{
  for(const path of ['/README.md','/.env','/worker.mjs','/tests/security.spec.cjs','/constructor','/__proto__'])assert.equal(worker.fetch(new Request('https://example.test'+path)).status,404);
  assert.equal(worker.fetch(new Request('https://example.test/',{method:'POST',body:'sensitive'})).status,405);
  assert.equal(worker.fetch(new Request('https://example.test/',{method:'HEAD'})).body,null);
});
