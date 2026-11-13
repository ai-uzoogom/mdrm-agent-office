import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const url=process.env.OFFICE_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const checks=[],errors=[];
await mkdir('test-results',{recursive:true});
const snapshot=p=>p.evaluate(()=>window.__OFFICE_DEBUG__.snapshot());
const settled=p=>p.waitForFunction(()=>!window.__OFFICE_DEBUG__.snapshot().transitioning);
const record=name=>{checks.push(name);console.log('PASS',name);};
async function open(width=1280,height=1000,touch=false,reducedMotion='no-preference'){
 const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,reducedMotion});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.goto(url);await page.waitForFunction(()=>document.documentElement.dataset.officeReady==='true');
 return {page,context};
}
async function select(page,floor){await page.locator(`button[data-floor="${floor}"]`).click();await settled(page);}
async function capture(page,name){await page.locator('.scene-panel').screenshot({path:`test-results/floors-${name}.png`});}
try{
 const {page,context}=await open();const canvas=page.locator('#office-canvas');
 const initial=await snapshot(page);assert.equal(initial.floor,'office');assert.equal(initial.floorProgress,0);
 assert.equal(await page.locator('.grave-name').first().evaluate(e=>getComputedStyle(e).visibility),'hidden');
 await capture(page,'office-desktop');
 const bounds=await canvas.boundingBox(),preview=initial.basementPreview;
 await page.mouse.click(bounds.x+preview.x,bounds.y+preview.y);
 await page.waitForFunction(()=>window.__OFFICE_DEBUG__.snapshot().floorProgress>0);
 const mid=await snapshot(page);assert.equal(mid.floor,'basement');assert.ok(mid.floorProgress<1);assert.equal(mid.transitioning,true);
 const historyFocus=await page.evaluate(()=>document.activeElement.id);assert.ok(!historyFocus.startsWith('patch-'));
 await settled(page);assert.equal((await snapshot(page)).floorProgress,1);
 assert.equal(await page.locator('.wall-label').first().evaluate(e=>getComputedStyle(e).visibility),'hidden');
 assert.equal(await page.locator('.grave-name').first().evaluate(e=>getComputedStyle(e).visibility),'visible');
 await capture(page,'basement-desktop');record('default office, dim basement click, upward animation and active-floor labels');
 for(const grave of (await snapshot(page)).graves){
  await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox();
  await page.mouse.click(b.x+grave.screen.x,b.y+grave.screen.y);
  assert.equal(await page.evaluate(()=>document.activeElement.id),`patch-${grave.id}`);
 }
 record('all three basement tombstones open their matching patch record');
 await canvas.press('+');await canvas.press('ArrowRight');const saved=(await snapshot(page)).view;
 await select(page,'office');assert.deepEqual((await snapshot(page)).view,initial.view);
 await canvas.press('+');const officeView=(await snapshot(page)).view;
 await select(page,'basement');assert.deepEqual((await snapshot(page)).view,saved);
 await select(page,'office');assert.deepEqual((await snapshot(page)).view,officeView);
 record('zoom and pan are remembered independently on each floor');
 await page.locator('button[data-floor="basement"]').click();await page.waitForTimeout(150);
 await page.locator('button[data-floor="office"]').click();await settled(page);
 assert.equal((await snapshot(page)).floorProgress,0);
 await canvas.press('PageDown');await settled(page);assert.equal((await snapshot(page)).floor,'basement');
 await canvas.press('PageUp');await settled(page);assert.equal((await snapshot(page)).floor,'office');
 record('reversed transition settles correctly and PageDown/PageUp change floors');
 await page.locator('button[data-floor="basement"]').click();await page.emulateMedia({reducedMotion:'reduce'});await settled(page);
 assert.equal((await snapshot(page)).floorProgress,1);await select(page,'office');
 const frozen=await snapshot(page);await page.waitForTimeout(200);assert.equal((await snapshot(page)).frames,frozen.frames);
 record('reduced motion completes pending transition and remains static');
 await context.close();
 const mobile=await open(390,844,true,'reduce'),p=mobile.page;
 const c=p.locator('#office-canvas');await c.scrollIntoViewIfNeeded();
 const mb=await c.boundingBox(),mp=(await snapshot(p)).basementPreview;
 await p.touchscreen.tap(mb.x+mp.x,mb.y+mp.y);assert.equal((await snapshot(p)).floor,'basement');
 for(const grave of (await snapshot(p)).graves){
  await c.scrollIntoViewIfNeeded();const b=await c.boundingBox();
  await p.touchscreen.tap(b.x+grave.screen.x,b.y+grave.screen.y);
  assert.equal(await p.evaluate(()=>document.activeElement.id),`patch-${grave.id}`);
 }
 await capture(p,'basement-mobile');
 const client=await mobile.context.newCDPSession(p);await c.scrollIntoViewIfNeeded();const b=await c.boundingBox();
 const points=d=>[{id:1,x:b.x+b.width/2-d/2,y:b.y+b.height/2},{id:2,x:b.x+b.width/2+d/2,y:b.y+b.height/2}];
 const before=(await snapshot(p)).view.zoom;
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(70)});
 await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(110)});
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok((await snapshot(p)).view.zoom>before);
 await client.detach();record('390px real touch events select basement, open each grave and pinch zoom');
 await select(p,'office');await capture(p,'office-mobile');
 for(const size of [{width:375,height:812},{width:844,height:390}]){
  await p.setViewportSize(size);await select(p,'basement');await c.press('0');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await p.locator('button[data-floor="office"]').evaluate(e=>e.getBoundingClientRect().height>=44));
  await capture(p,`basement-${size.width}`);await select(p,'office');
 }
 await mobile.context.close();record('375px portrait and 844px landscape fit with 44px keyboard-accessible floor controls');
 assert.deepEqual(errors,[]);
 await writeFile('test-results/floors-report.json',JSON.stringify({url,checks,errors},null,2));
}catch(e){console.error(e);process.exitCode=1;await writeFile('test-results/floors-report.json',JSON.stringify({url,checks,errors,failure:String(e)},null,2));}
finally{await browser.close();}
