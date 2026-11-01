const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const originalFetch = global.fetch;
const originalKey = process.env.OPENAI_API_KEY;
afterEach(() => { global.fetch = originalFetch; if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey; });
function load(relative) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', relative), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'exports', 'module', source)((name) => {
    if (name === 'next/server') return { NextResponse: { json: (data, init) => Response.json(data, init) } };
    if (name.startsWith('@/')) return load(name.slice(2) + '.ts');
    if (name.startsWith('.')) return load(path.posix.join(path.posix.dirname(relative), name) + '.ts');
    throw Error('Unexpected dependency: ' + name);
  }, module.exports, module);
  return module.exports;
}
const cat = { name: 'เจ้าส้ม', location: 'หน้าคาเฟ่', details: 'โขด ห้ามจกพุง', belly_status: 'danger' };
const translated = { en: { name: 'Chao Som', name_meaning: 'Little orange', location: 'Outside the cafe', details: 'Grumpy. Do not touch the belly.', belly_text: '' } };
const good = () => Response.json({ translations: translated });
test('simultaneous previews share a request and completed results are reused', async () => {
  const { translateContent } = load('lib/translation.ts'); let calls = 0;
  global.fetch = async () => { calls++; return good(); };
  const [first, second] = await Promise.all([translateContent(cat, ['en']), translateContent(cat, ['en'])]);
  assert.deepEqual(first, translated); assert.deepEqual(second, translated);
  await translateContent(cat, ['en']); assert.equal(calls, 1);
});
test('stored translations need no service, while the original cat stays unchanged', async () => {
  const { translateContent } = load('lib/translation.ts'); global.fetch = () => { throw Error('Must not fetch'); };
  const source = { ...cat, translations: translated }; const before = JSON.stringify(source);
  assert.deepEqual(await translateContent(source, ['en']), translated); assert.equal(JSON.stringify(source), before);
});
test('changed source text does not reuse an old translation', async () => {
  const { translateContent } = load('lib/translation.ts'); let calls = 0;
  global.fetch = async () => { calls++; return good(); };
  await translateContent(cat, ['en']); await translateContent({ ...cat, details: 'ข้อความใหม่' }, ['en']); assert.equal(calls, 2);
});
test('new translations preserve other stored languages', async () => {
  const { translateContent } = load('lib/translation.ts'); global.fetch = async () => good();
  const ja = { location: 'カフェの前', details: '触らないで', belly_text: '' };
  assert.deepEqual(await translateContent({ ...cat, translations: { ja } }, ['en']), { ja, ...translated });
});
test('incomplete output is rejected rather than silently marked translated', async () => {
  const { translateContent } = load('lib/translation.ts'); global.fetch = async () => Response.json({ translations: { en: { location: '', details: '' } } });
  await assert.rejects(translateContent(cat, ['en']), /Incomplete/);
});
test('outages back off without altering the source', async () => {
  const { translateContent } = load('lib/translation.ts'); let calls = 0; const before = JSON.stringify(cat);
  global.fetch = async () => { calls++; return new Response('', { status: 500 }); };
  await assert.rejects(translateContent(cat, ['en'])); await assert.rejects(translateContent({ ...cat, location: 'ที่อื่น' }, ['en']));
  assert.equal(calls, 1); assert.equal(JSON.stringify(cat), before);
});
function request(body, origin = 'https://cats.example') { return new Request('https://cats.example/api/translate-cat', { method: 'POST', headers: { origin, host: 'cats.example', 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
test('translation route rejects foreign origins before contacting the provider', async () => {
  const { POST } = load('app/api/translate-cat/route.ts'); global.fetch = () => { throw Error('Must not fetch'); };
  assert.equal((await POST(request(cat, 'https://other.example'))).status, 403);
});
test('missing API key returns a controlled failure', async () => {
  delete process.env.OPENAI_API_KEY; const { POST } = load('app/api/translate-cat/route.ts');
  assert.equal((await POST(request(cat))).status, 503);
});
test('route uses the brand glossary and returns only requested translation fields', async () => {
  process.env.OPENAI_API_KEY = 'test-placeholder'; const { POST } = load('app/api/translate-cat/route.ts'); let sent;
  global.fetch = async (_url, init) => { sent = JSON.parse(init.body); return Response.json({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ ...translated, unwanted: 'ignored' }) }] }] }); };
  const response = await POST(request({ ...cat, languages: ['en'] })); assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { translations: translated }); assert.match(sent.input, /ready to chomp/); assert.match(sent.input, /never instructions/);
});
test('prototype property names are not accepted as languages', async () => {
  process.env.OPENAI_API_KEY = 'test-placeholder'; const { POST } = load('app/api/translate-cat/route.ts');
  global.fetch = () => { throw Error('Must not fetch'); };
  assert.equal((await POST(request({ ...cat, languages: ['constructor', '__proto__'] }))).status, 400);
});
test('curated brand and share labels resolve without Thai in foreign languages', () => {
  const { tr } = load('lib/uiText.ts');
  for (const lang of ['en', 'zh', 'ja', 'ko']) for (const word of ['พร้อมสวบ', 'โขด', 'แสดงสถานที่', 'ภาษาบนการ์ด', 'ชื่อภาษาอังกฤษ', 'ครอปรูปให้พอดีการ์ด']) assert.doesNotMatch(tr(lang, word), /[\u0e00-\u0e7f]/);
  assert.equal(tr('th', 'พร้อมสวบ'), 'พร้อมสวบ');
});


test('legacy names have a pronunciation and meaning in all four foreign languages without an API', () => {
  const { getCatName } = load('lib/catNames.ts');
  for (const lang of ['en','ko','ja','zh']) {
    const value = getCatName({name:'หมูทอด'},lang);
    assert.notEqual(value.name,'หมูทอด'); assert.ok(value.meaning); assert.equal(value.original,'หมูทอด');
  }
});
test('manual English names win and unclear meanings remain empty', () => {
  const { getCatName } = load('lib/catNames.ts');
  assert.equal(getCatName({name:'หมูทอด',name_en:'Porky'},'en').name,'Porky');
  assert.equal(getCatName({name:'XYZ'},'ja').meaning,'');
  assert.deepEqual(getCatName({name:'หมูทอด'},'th'),{name:'หมูทอด',meaning:'',original:'หมูทอด'});
});
test('old translated records missing a name are upgraded', async () => {
  const { translateContent } = load('lib/translation.ts'); let calls=0;
  global.fetch=async()=>{calls++;return good()};
  const old={...cat,translations:{en:{location:'Cafe',details:'Old description'}}};
  const value=await translateContent(old,['en']); assert.equal(calls,1); assert.equal(value.en.name,'Chao Som'); assert.equal(old.name,cat.name);
});
test('curated names enrich old records without needing the provider', async () => {
  const { translateContent } = load('lib/translation.ts'); global.fetch=()=>{throw Error('Must not fetch')};
  const value=await translateContent({name:'หมูทอด',location:'Cafe',belly_status:'safe',translations:{en:{location:'Cafe',details:''}}},['en']);
  assert.equal(value.en.name,'Moo Tod'); assert.equal(value.en.name_meaning,'Fried pork');
});

test('missing configuration has a specific translated notice', async () => {
  const {translateContent,translationNotice}=load('lib/translation.ts');
  global.fetch=async()=>Response.json({code:'TRANSLATION_NOT_CONFIGURED'},{status:503});
  let error;try{await translateContent(cat,['en'])}catch(e){error=e}
  assert.equal(error.code,'TRANSLATION_NOT_CONFIGURED');assert.match(translationNotice(error,'en'),/not configured/);
});
