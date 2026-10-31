import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const url=process.env.OFFICE_URL||'http://127.0.0.1:4173/';
const executablePath=process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser=await chromium.launch({executablePath,headless:true,args:['--no-proxy-server']});
const checks=[],errors=[];
await mkdir('test-results',{recursive:true});
const snapshot=page=>page.evaluate(()=>window.__OFFICE_DEBUG__.snapshot());
const record=name=>{checks.push(name);console.log('PASS',name);};
const near=(actual,expected,tolerance=.5)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} differs from ${expected}`);
async function openPage({width=1280,height=1000,touch=false}={}){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:touch,isMobile:touch});
 const page=await context.newPage();
 page.on('pageerror',error=>errors.push(String(error)));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
 await page.goto(url,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.documentElement.dataset.officeReady==='true');
 await page.evaluate(()=>document.fonts.ready);
 return {page,context};
}
async function checkLayout(page){
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
 const stage=await page.locator('#scene-stage').boundingBox();
 for(const button of await page.locator('.scene-navigation button:visible').all()){
  const bounds=await button.boundingBox();assert.ok(bounds.width>=44&&bounds.height>=44,'small touch target');
  assert.ok(bounds.x>=stage.x&&bounds.y>=stage.y&&bounds.x+bounds.width<=stage.x+stage.width&&bounds.y+bounds.height<=stage.y+stage.height,'control outside stage');
 }
}
async function capture(page,name){await page.locator('.scene-panel').screenshot({path:`test-results/${name}.png`});}
async function labels(page){return page.locator('.surface-label').evaluateAll(nodes=>nodes.map(node=>{
 const m=new DOMMatrixReadOnly(getComputedStyle(node).transform);return {text:node.textContent,scale:Math.hypot(m.a,m.b),angle:Math.atan2(m.b,m.a)};
}));}

try{
 const {page,context}=await openPage();
 const canvas=page.locator('#office-canvas');
 const initial=await snapshot(page),initialLabels=await labels(page);
 assert.equal(initial.view.zoom,1);assert.ok(await page.locator('#zoom-out').isDisabled());assert.ok(await page.locator('#zoom-reset').isDisabled());
 assert.ok(await page.locator('#scene-pan-controls').isHidden());await checkLayout(page);
 for(let i=0;i<4;i++)await page.locator('#zoom-in').click();
 const enlarged=await snapshot(page),enlargedLabels=await labels(page);
 assert.equal(enlarged.view.zoom,2);assert.equal(await page.locator('#zoom-level').textContent(),'200%');
 near(enlarged.crew[0].screen.x-enlarged.crew[1].screen.x,2*(initial.crew[0].screen.x-initial.crew[1].screen.x));
 for(let i=0;i<initialLabels.length;i++){near(enlargedLabels[i].scale,initialLabels[i].scale*2,.001);near(enlargedLabels[i].angle,initialLabels[i].angle,.001);}
 await capture(page,'view-desktop-200');
 record('100–200% buttons scale the scene and wall/board text together');

 let bounds=await canvas.boundingBox();
 await page.mouse.click(bounds.x+enlarged.hero.x,bounds.y+enlarged.hero.y);
 assert.match(await page.locator('#activity-log li').first().textContent(),/방어선은 내가 지킨다/);
 const logBefore=await page.locator('#activity-log').textContent();
 await page.mouse.move(bounds.x+enlarged.hero.x,bounds.y+enlarged.hero.y);await page.mouse.down();
 await page.mouse.move(bounds.x+enlarged.hero.x+64,bounds.y+enlarged.hero.y-30,{steps:8});await page.mouse.up();
 const dragged=await snapshot(page);
 near(dragged.hero.x,enlarged.hero.x+64);near(dragged.hero.y,enlarged.hero.y-30);
 assert.equal(await page.locator('#activity-log').textContent(),logBefore,'drag triggered actor click');
 record('zoomed raycast works; drag moves the view without an accidental click');

 await canvas.focus();await page.keyboard.press('ArrowRight');
 assert.ok((await snapshot(page)).view.pan[0]>dragged.view.pan[0]);
 await page.keyboard.press('0');assert.deepEqual((await snapshot(page)).view,{zoom:1,pan:[0,0]});
 await page.keyboard.press('-');assert.equal((await snapshot(page)).view.zoom,1);
 for(let i=0;i<10;i++)await page.keyboard.press('+');
 assert.equal((await snapshot(page)).view.zoom,3);assert.ok(await page.locator('#zoom-in').isDisabled());
 await page.keyboard.press('+');assert.equal((await snapshot(page)).view.zoom,3);
 await page.locator('#zoom-out').click();assert.equal((await snapshot(page)).view.zoom,2.75);
 for(let i=0;i<20;i++)await page.locator('#office-canvas').press('ArrowRight');
 assert.ok(await page.locator('[data-pan="right"]').isDisabled());
 await page.locator('[data-pan="left"]').click();assert.ok(await page.locator('[data-pan="right"]').isEnabled());
 await page.locator('#zoom-reset').click();assert.deepEqual((await snapshot(page)).view,{zoom:1,pan:[0,0]});
 record('keyboard and direction buttons work; 100–300% and pan limits are enforced; reset restores the whole office');

 bounds=await canvas.boundingBox();
 await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
 const scrollBefore=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,100);await page.waitForTimeout(150);
 assert.ok(await page.evaluate(y=>scrollY>y,scrollBefore),'ordinary wheel no longer scrolls the page');
 assert.equal((await snapshot(page)).view.zoom,1);
 bounds=await canvas.boundingBox();const anchored=(await snapshot(page)).hero;
 await page.mouse.move(bounds.x+anchored.x,bounds.y+anchored.y);await page.keyboard.down('Control');await page.mouse.wheel(0,-160);await page.keyboard.up('Control');await page.waitForTimeout(100);
 const wheel=await snapshot(page);assert.ok(wheel.view.zoom>1);near(wheel.hero.x,anchored.x);near(wheel.hero.y,anchored.y);
 record('ordinary wheel scrolls the page; Ctrl+wheel zooms around the pointed character');

 await page.locator('#zoom-reset').click();for(let i=0;i<4;i++)await page.locator('#zoom-in').click();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(120);await checkLayout(page);
 assert.equal((await snapshot(page)).view.zoom,2);assert.equal(await page.locator('.wall-label').first().evaluate(node=>getComputedStyle(node).display),'none');
 await capture(page,'view-mobile-200');
 await page.locator('#zoom-reset').click();await capture(page,'view-mobile-100');
 const frozen=await snapshot(page);await page.waitForTimeout(300);const later=await snapshot(page);
 assert.equal(later.elapsed,0);assert.equal(later.frames,frozen.frames);assert.equal(later.metrics.combat,0);
 record('zoom survives viewport changes; 390px controls fit; reduced motion stays paused after navigation');
 await context.close();

 const mobile=await openPage({width:390,height:844,touch:true});
 for(let i=0;i<4;i++)await mobile.page.locator('#zoom-in').tap();
 const beforeTouch=await snapshot(mobile.page),touchBounds=await mobile.page.locator('#office-canvas').boundingBox();
 const touchLog=await mobile.page.locator('#activity-log').textContent();
 const client=await mobile.context.newCDPSession(mobile.page);
 const x=touchBounds.x+touchBounds.width*.4,y=touchBounds.y+touchBounds.height*.45;
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+40,y:y-24,id:1}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const afterTouch=await snapshot(mobile.page);near(afterTouch.hero.x,beforeTouch.hero.x+40,1);near(afterTouch.hero.y,beforeTouch.hero.y-24,1);
 assert.equal(await mobile.page.locator('#activity-log').textContent(),touchLog);
 await mobile.page.locator('#zoom-reset').tap();assert.equal((await snapshot(mobile.page)).view.zoom,1);
 for(const viewport of [{width:375,height:812},{width:844,height:390}]){
  await mobile.page.setViewportSize(viewport);await mobile.page.waitForTimeout(120);await mobile.page.locator('#zoom-in').tap();await checkLayout(mobile.page);await mobile.page.locator('#zoom-reset').tap();
 }
 await client.detach();await mobile.context.close();
 record('Chrome touch emulation: tap, drag, reset; 375px portrait and 844px landscape controls fit');
 assert.deepEqual(errors,[]);
 await writeFile('test-results/view-controls-report.json',JSON.stringify({date:new Date().toISOString(),url,browser:browser.version(),checks,errors},null,2));
}catch(error){
 console.error(error);await writeFile('test-results/view-controls-report.json',JSON.stringify({url,checks,errors,failure:String(error)},null,2));process.exitCode=1;
}finally{await browser.close();}
