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
 assert.equal(await page.locator('.scene-navigation,#zoom-in,#zoom-out,#zoom-reset,[data-pan]').count(),0,'camera buttons still cover the scene');
}
async function capture(page,name){await page.locator('.scene-panel').screenshot({path:`test-results/${name}.png`});}
async function labels(page){return page.locator('.surface-label').evaluateAll(nodes=>nodes.map(node=>{
 const m=new DOMMatrixReadOnly(getComputedStyle(node).transform);return {text:node.textContent,scale:Math.hypot(m.a,m.b),angle:Math.atan2(m.b,m.a)};
}));}

try{
 const {page,context}=await openPage();
 const canvas=page.locator('#office-canvas');
 const initial=await snapshot(page),initialLabels=await labels(page);
 assert.equal(initial.view.zoom,1);await checkLayout(page);
 let fitBounds=await canvas.boundingBox();const beforeFitDrag=await snapshot(page);await page.mouse.move(fitBounds.x+fitBounds.width*.5,fitBounds.y+fitBounds.height*.5);await page.mouse.down();await page.mouse.move(fitBounds.x+fitBounds.width*.5+40,fitBounds.y+fitBounds.height*.5+20,{steps:5});await page.mouse.up();near((await snapshot(page)).hero.x,beforeFitDrag.hero.x+40,1);await canvas.press('0');
 for(let i=0;i<4;i++)await canvas.press('+');
 const enlarged=await snapshot(page),enlargedLabels=await labels(page);
 assert.equal(enlarged.view.zoom,2);assert.ok(enlarged.target.width>initial.target.width,'zoom did not increase render detail');assert.ok(enlarged.target.width*enlarged.target.height<=8005000,'render pixel budget exceeded');
 near(enlarged.crew[0].screen.x-enlarged.crew[1].screen.x,2*(initial.crew[0].screen.x-initial.crew[1].screen.x));
 for(let i=0;i<initialLabels.length;i++){near(enlargedLabels[i].scale,initialLabels[i].scale*2,.001);near(enlargedLabels[i].angle,initialLabels[i].angle,.001);}
 await capture(page,'view-desktop-200');
 record('100–200% keyboard zoom scale the scene and wall/board text together');

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
 assert.equal((await snapshot(page)).view.zoom,3);
 await page.keyboard.press('+');assert.equal((await snapshot(page)).view.zoom,3);
 await canvas.press('-');assert.equal((await snapshot(page)).view.zoom,2.75);
 for(let i=0;i<20;i++)await page.locator('#office-canvas').press('ArrowRight');
 const edge=(await snapshot(page)).view.pan[0];await canvas.press('ArrowRight');near((await snapshot(page)).view.pan[0],edge,.001);await canvas.press('ArrowLeft');assert.ok((await snapshot(page)).view.pan[0]<edge);
 await canvas.press('0');assert.deepEqual((await snapshot(page)).view,{zoom:1,pan:[0,0]});
 record('keyboard directions work; 100–300% and pan limits are enforced; reset restores the whole office');

 bounds=await canvas.boundingBox();
 await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
 const scrollBefore=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,-160);await page.waitForTimeout(100);
 assert.ok((await snapshot(page)).view.zoom>1);near(await page.evaluate(()=>scrollY),scrollBefore,1);
 await page.mouse.wheel(0,160);await page.waitForTimeout(100);near((await snapshot(page)).view.zoom,1,.01);
 const anchored=(await snapshot(page)).hero;bounds=await canvas.boundingBox();await page.mouse.move(bounds.x+anchored.x,bounds.y+anchored.y);await page.mouse.wheel(0,-160);await page.waitForTimeout(100);
 const wheel=await snapshot(page);assert.ok(wheel.view.zoom>1);near(wheel.hero.x,anchored.x);near(wheel.hero.y,anchored.y);
 await page.mouse.move(5,100);const outsideScroll=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,100);await page.waitForTimeout(150);assert.ok(await page.evaluate(y=>scrollY>y,outsideScroll));
 record('plain wheel up/down zooms at the cursor; wheel outside the scene scrolls the page');

 await canvas.press('0');for(let i=0;i<4;i++)await canvas.press('+');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(120);await checkLayout(page);
 assert.equal((await snapshot(page)).view.zoom,2);assert.notEqual(await page.locator('.wall-label').first().evaluate(node=>getComputedStyle(node).display),'none');
 await capture(page,'view-mobile-200');
 await canvas.press('0');await capture(page,'view-mobile-100');
 const frozen=await snapshot(page);await page.waitForTimeout(300);const later=await snapshot(page);
 assert.equal(later.elapsed,0);assert.equal(later.frames,frozen.frames);assert.equal(later.metrics.combat,0);
 record('zoom survives viewport changes; 390px scene remains unobstructed; reduced motion stays paused after navigation');
 await context.close();

 const mobile=await openPage({width:390,height:844,touch:true});
 for(let i=0;i<4;i++)await mobile.page.locator('#office-canvas').press('+');
 const beforeTouch=await snapshot(mobile.page),touchBounds=await mobile.page.locator('#office-canvas').boundingBox();
 const touchLog=await mobile.page.locator('#activity-log').textContent();
 const client=await mobile.context.newCDPSession(mobile.page);
 const x=touchBounds.x+touchBounds.width*.4,y=touchBounds.y+touchBounds.height*.45;
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+40,y:y-24,id:1}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const afterTouch=await snapshot(mobile.page);near(afterTouch.hero.x,beforeTouch.hero.x+40,1);near(afterTouch.hero.y,beforeTouch.hero.y-24,1);
 assert.equal(await mobile.page.locator('#activity-log').textContent(),touchLog);
 await mobile.page.locator('#office-canvas').press('0');assert.equal((await snapshot(mobile.page)).view.zoom,1);
 await mobile.page.locator('#office-canvas').scrollIntoViewIfNeeded();
 const pinchBounds=await mobile.page.locator('#office-canvas').boundingBox(),mx=pinchBounds.x+pinchBounds.width*.45,my=pinchBounds.y+pinchBounds.height*.4;
 const baseline=await snapshot(mobile.page),baselineLog=await mobile.page.locator('#activity-log').textContent();
 const points=(distance,shift=0)=>[{x:mx-distance/2+shift,y:my,id:11},{x:mx+distance/2+shift,y:my,id:12}];
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(80)});
 for(const distance of [100,120,140,160])await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(distance)});
 const spread=await snapshot(mobile.page);near(spread.view.zoom,2,.01);near(spread.hero.x,mx-pinchBounds.x+2*(baseline.hero.x-(mx-pinchBounds.x)),1);near(spread.hero.y,my-pinchBounds.y+2*(baseline.hero.y-(my-pinchBounds.y)),1);
 assert.equal(await mobile.page.evaluate(()=>visualViewport.scale),1,'scene pinch zoomed the whole page');
 await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(160,20)});near((await snapshot(mobile.page)).hero.x,spread.hero.x+20,1);
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok((await snapshot(mobile.page)).target.width>baseline.target.width,'pinch release did not sharpen rendering');await capture(mobile.page,'view-mobile-pinch-200');
 assert.equal(await mobile.page.locator('#activity-log').textContent(),baselineLog,'pinch clicked an actor');
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(160)});
 for(const distance of [120,80,40])await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(distance)});
 near((await snapshot(mobile.page)).view.zoom,1,.001);await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(60)});await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(300)});near((await snapshot(mobile.page)).view.zoom,3,.001);
 await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await mobile.page.locator('#office-canvas').press('0');
 record('two real touch points spread/pan/shrink at their midpoint; 100–300% limits, cancel and no accidental actor click');
 const scrollStart=await mobile.page.evaluate(()=>scrollY),scrollBounds=await mobile.page.locator('#office-canvas').boundingBox();
 const sx=scrollBounds.x+scrollBounds.width*.5,sy=scrollBounds.y+scrollBounds.height*.5;
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sx,y:sy,id:21}]});
 for(let i=1;i<=5;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx,y:sy-i*12,id:21}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mobile.page.waitForFunction(y=>scrollY>y+10,scrollStart);
 record('one-finger page scrolling remains available at 100%');
 const pinchBefore=(await snapshot(mobile.page)).target.width;
 await client.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});await mobile.page.waitForFunction(width=>window.__OFFICE_DEBUG__.snapshot().target.width>width,pinchBefore);
 assert.ok(await mobile.page.evaluate(()=>visualViewport.scale>1));
 await client.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});await mobile.page.waitForFunction(width=>window.__OFFICE_DEBUG__.snapshot().target.width===width,pinchBefore);
 record('mobile browser pinch increases canvas resolution and restores it afterward');
 for(const viewport of [{width:375,height:812},{width:844,height:390}]){
  await mobile.page.setViewportSize(viewport);await mobile.page.waitForTimeout(120);await mobile.page.locator('#office-canvas').press('+');await checkLayout(mobile.page);await mobile.page.locator('#office-canvas').press('0');
 }
 await client.detach();await mobile.context.close();
 record('Chrome touch emulation: pinch, drag, keyboard reset; 375px portrait and 844px landscape controls fit');
 assert.deepEqual(errors,[]);
 await writeFile('test-results/view-controls-report.json',JSON.stringify({date:new Date().toISOString(),url,browser:browser.version(),checks,errors},null,2));
}catch(error){
 console.error(error);await writeFile('test-results/view-controls-report.json',JSON.stringify({url,checks,errors,failure:String(error)},null,2));process.exitCode=1;
}finally{await browser.close();}
