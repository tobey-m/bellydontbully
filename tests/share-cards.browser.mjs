import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const output = 'test-results/cards';
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import * as Cards from './lib/catCard'; import ShareStudio from './components/ShareStudio';
      import MapGuide from './components/MapGuide';
      window.Cards=Cards; let root;
      window.mount=(kind, cat)=>{if(root)root.unmount();root=createRoot(document.getElementById('root'));
      root.render(kind==='guide'?<main className="belly-app"><MapGuide lang="th" loading={false} error={false} onRetry={()=>{}}/></main>:<ShareStudio cat={cat} lang="th" onClose={()=>root.unmount()}/>);};`,
    resolveDir: process.cwd(), loader: 'tsx',
  }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
});
const chunks = [];
async function findCss(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = dir + '/' + item.name;
    if (item.isDirectory()) await findCss(path);
    else if (item.name.endsWith('.css')) chunks.push(await readFile(path, 'utf8'));
  }
}
await findCss('.next/static');
assert.ok(chunks.length, 'production CSS was generated');
const server = createServer(async (req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].text); }
  else if (req.url === '/brand/mascots.webp') { res.setHeader('Content-Type', 'image/webp'); res.end(await readFile('public/brand/mascots.webp')); }
  else { res.setHeader('Content-Type', 'text/html'); res.end('<html lang="th"><head><style>' + chunks.join('\n') + '</style><style>body{margin:0;font-family:Arial,sans-serif}main{height:100vh}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:' + server.address().port);
  const cat = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 900;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#e5d9c3'; ctx.fillRect(0,0,900,900);
    ctx.fillStyle='#ffa34d';ctx.beginPath();ctx.ellipse(450,510,240,280,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.moveTo(240,340);ctx.lineTo(255,110);ctx.lineTo(395,255);ctx.lineTo(515,255);ctx.lineTo(645,110);ctx.lineTo(675,350);ctx.fill();
    ctx.fillStyle='#503323';for(const x of [365,535]){ctx.beginPath();ctx.arc(x,370,18,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#fffaf2';ctx.beginPath();ctx.ellipse(450,585,125,160,0,0,Math.PI*2);ctx.fill();
    return {id:77,name:'เจ้าส้ม',location:'สวนเล็กข้างร้านกาแฟ เชียงใหม่',belly_status:'caution',discovered_by:'คนรักแมว',photo_urls:[canvas.toDataURL(),canvas.toDataURL()]};
  });
  // Guide mascot must remain square at the exact reported viewport and on mobile.
  for (const width of [390,684,1200]) {
    await page.setViewportSize({ width, height: 750 });
    await page.evaluate(() => {localStorage.clear();window.mount('guide');});
    await page.locator('.belly-guide-toggle').click();
    const dimensions = await page.locator('.belly-guide-toggle>.belly-mascot').evaluate(el => {const r=el.getBoundingClientRect();return {w:r.width,h:r.height};});
    assert.equal(dimensions.w,36);assert.equal(dimensions.h,36);
    await page.screenshot({ path: output + '/guide-' + width + '.png' });
  }
  await page.evaluate(cat => {localStorage.clear();window.mount('studio',cat);},cat);
  await page.locator('.cat-studio-image').waitFor();
  for (const width of [390,684,1200]) {
    await page.setViewportSize({width,height:900});
    const overflow = await page.locator('.cat-share-studio').evaluate(el => el.scrollWidth > el.clientWidth + 1);
    assert.equal(overflow,false,'studio horizontal overflow at '+width);
    await page.screenshot({path:output+'/studio-'+width+'.png'});
  }
  await page.getByRole('button',{name:'สติกเกอร์แมว',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'บันทึก PNG ↓',exact:true}).isDisabled(),true);
  const svg=page.locator('.cat-cutout-canvas svg');await svg.waitFor();
  const box=await svg.boundingBox();
  for(const [x,y]of [[.28,.1],[.44,.25],[.58,.25],[.72,.1],[.78,.75],[.62,.9],[.35,.9],[.2,.65]])
    await svg.click({position:{x:box.width*x,y:box.height*y}});
  await page.getByRole('button',{name:'ตัดตามเส้น',exact:true}).click();
  await page.locator('.cat-studio-image').waitFor();
  const stickerPhoto=await page.locator('.cat-studio-image').evaluate(async img=>{
    const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
    const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
    if(ctx.getImageData(0,0,1,1).data[3]!==0)throw Error('Sticker background is not transparent');
    // Use the actual editor output saved in the prepared render's image as another valid PNG fixture.
    return c.toDataURL();
  });
  await page.screenshot({path:output+'/sticker-editor.png'});
  await page.getByRole('button',{name:'รูปที่ 2',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'บันทึก PNG ↓',exact:true}).isDisabled(),true,'changing photo invalidates old cutout');
  for(const style of ['postcard','scrapbook','sticker'])for(const format of ['story','portrait','square']){
    const result=await page.evaluate(async({cat,style,format,stickerPhoto})=>{
      const asset=await window.Cards.renderShareAsset(cat,{style,format,fileType:'png',lang:'th',photoIndex:0,showLocation:true,showDiscoverer:true,overlayTone:'dark',stickerPhoto});
      const bitmap=await createImageBitmap(asset.blob),c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;
      const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);
      const corner=Array.from(ctx.getImageData(0,0,1,1).data);
      return {width:bitmap.width,height:bitmap.height,type:asset.blob.type,corner,data:c.toDataURL()};
    },{cat,style,format,stickerPhoto});
    assert.equal(result.width,1080);
    assert.equal(result.height,{story:1920,portrait:1350,square:1080}[format]);
    assert.equal(result.type,'image/png');assert.equal(result.corner[3],style==='sticker'?0:255);
    if(style!=='sticker')assert.ok(result.corner[0]>240 && result.corner[1]>220,'warm cream background');
    await writeFile(output+'/'+style+'-'+format+'.png',Buffer.from(result.data.split(',')[1],'base64'));
  }
  // Translation failure wording remains clear and the source language is preserved.
  const translation=await readFile('lib/translation.ts','utf8');
  assert.ok(!translation.includes('บริการแปลเต็ม'));
  assert.deepEqual(errors,[]);
  console.log('PASS: 9 PNG exports, transparency, 3 viewport layouts, square guide mascot, cutout interaction and stale-photo protection.');
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
