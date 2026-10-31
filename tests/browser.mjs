import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { kstDate, RENDERING } from '../src/data.js';

const base=process.env.OFFICE_URL||'http://127.0.0.1:4173/';
const executablePath=process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:['--no-proxy-server']});
const checks=[],errors=[];
const record=(name,details={})=>{checks.push({name,...details});console.log('PASS',name,JSON.stringify(details));};
async function openPage({width=1280,height=1000,reduced='no-preference',source,dpr=2}={}){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,reducedMotion:reduced,timezoneId:'America/Los_Angeles'});
 const page=await context.newPage();
 page.on('pageerror',error=>errors.push({type:'pageerror',message:String(error)}));
 page.on('console',message=>{if(message.type()==='error')errors.push({type:'console',message:message.text()});});
 page.on('response',response=>{if(response.status()>=400)errors.push({type:'http',url:response.url(),status:response.status()});});
 if(source)await page.route('**/src/data.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:source}));
 await page.goto(base,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.documentElement.dataset.officeReady==='true',null,{timeout:25000});
 await page.evaluate(()=>document.fonts.ready);
 return {context,page};
}
const snapshot=page=>page.evaluate(()=>window.__OFFICE_DEBUG__.snapshot());
const noOverflow=async page=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
const screenshot=async(page,name,fullPage=true)=>page.screenshot({path:`test-results/${name}.png`,fullPage});
try{
 const {context,page}=await openPage();
 await noOverflow(page);
 assert.equal(await page.locator('#today-kst').getAttribute('datetime'),kstDate());
 assert.equal(await page.locator('.agent-row').count(),6);
 assert.equal(await page.locator('.monster-row').count(),3);
 assert.equal(await page.locator('[role="tab"]').count(),4);
 assert.equal((await snapshot(page)).assets.files,27);
 assert.ok((await snapshot(page)).assets.characterAnimations.includes('sit'));
 assert.ok(await page.locator('[data-thumbnail]').evaluateAll((images,size)=>images.every(i=>i.complete&&i.naturalWidth===size&&i.naturalHeight===size),RENDERING.thumbnailSize));
 assert.equal((await snapshot(page)).target.width,1752);
 assert.equal(await page.locator('#office-canvas').evaluate(canvas=>canvas.width),2*(await snapshot(page)).viewport.width);
 await screenshot(page,'desktop');
 record('1280px initial render, local assets, thumbnails and KST');
 await page.evaluate(()=>{window.__qaFrameTimes=[];const sample=t=>{window.__qaFrameTimes.push(t);window.__qaFrameRequest=requestAnimationFrame(sample);};window.__qaFrameRequest=requestAnimationFrame(sample);});
 const before=await snapshot(page),wallStart=Date.now();
 await page.waitForTimeout(10000);
 const after=await snapshot(page),wall=(Date.now()-wallStart)/1000,fps=(after.frames-before.frames)/wall;
 for(const key of ['walk','typing','led','melee','breath'])assert.ok(after.metrics[key]>0,`no ${key} within 10s`);
 const frameTimes=await page.evaluate(()=>{cancelAnimationFrame(window.__qaFrameRequest);return window.__qaFrameTimes;});
 const secondBuckets=Array.from({length:9},(_,i)=>frameTimes.filter(t=>t>=frameTimes[0]+i*1000&&t<frameTimes[0]+(i+1)*1000).length);
 const minimumOneSecondFPS=Math.min(...secondBuckets);
 assert.ok(fps>=30&&minimumOneSecondFPS>=30,`FPS below 30: average=${fps}, minimum second=${minimumOneSecondFPS}`);
 assert.equal(await page.locator('#activity-log li').count(),7);
 assert.equal(before.viewport.height,after.viewport.height,'scene height changed while logs filled');
 record('10-second autonomous activity and stable scene layout',{fps:Math.round(fps*10)/10,minimumOneSecondFPS,metrics:after.metrics});
 await screenshot(page,'desktop-active');
 // Stop motion for deterministic hit targets and accessible tab review.
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForTimeout(150);
 const frozen=await snapshot(page);
 await page.waitForTimeout(1000);
 assert.equal((await snapshot(page)).elapsed,frozen.elapsed);
 assert.equal((await snapshot(page)).frames,frozen.frames);
 record('live reduced-motion change freezes animation and simulation');
 const canvasRect=await page.locator('#office-canvas').boundingBox();
 for(const [key,expected] of [['hero','방어선은 내가 지킨다'],['pet','삐빅!'],['rack','모든 서비스 정상 동작 중']]){
  const point=(await snapshot(page))[key];await page.mouse.click(canvasRect.x+point.x,canvasRect.y+point.y);await page.waitForTimeout(40);
  assert.ok((await page.locator('#activity-log li').first().textContent()).includes(expected),`raycast ${key}`);
 }
 const state=await snapshot(page);
 for(const [point,expected] of [[state.crew[0].screen,'php2shell 패치'],[state.issues[2].screen,'nginx 슬라임']]){
  await page.mouse.click(canvasRect.x+point.x,canvasRect.y+point.y);await page.waitForTimeout(40);
  assert.ok((await page.locator('#activity-log li').first().textContent()).includes(expected),`raycast ${expected}`);
 }
 record('raycast hero, pet, rack, developer and monster status');
 await page.getByRole('tab',{name:'이력'}).focus();await page.keyboard.press('ArrowRight');
 assert.equal(await page.locator('#tab-bestiary').getAttribute('aria-selected'),'true');assert.ok(await page.locator('#panel-bestiary').isVisible());
 await page.locator('#panel-bestiary').screenshot({path:'test-results/bestiary.png'});
 await page.keyboard.press('End');assert.equal(await page.locator('#tab-party').getAttribute('aria-selected'),'true');
 await page.locator('#panel-party').screenshot({path:'test-results/party.png'});
 await page.keyboard.press('Home');assert.equal(await page.locator('#tab-history').getAttribute('aria-selected'),'true');
 await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#tab-party').getAttribute('aria-selected'),'true');
 await page.getByRole('tab',{name:'개발진'}).click();await page.locator('#panel-crew').screenshot({path:'test-results/crew.png'});
 record('all tabs, ArrowLeft/Right, Home/End and visible panels');
 await page.getByRole('tab',{name:'이력'}).click();
 for(const width of [901,900,390]){
  await page.setViewportSize({width,height:844});await page.waitForTimeout(120);await noOverflow(page);
  if(width===390){assert.equal(await page.locator('.name-label').first().evaluate(e=>getComputedStyle(e).display),'none');assert.equal(await page.locator('.monster-label').first().evaluate(e=>getComputedStyle(e).display),'none');assert.equal(await page.locator('.wall-label').first().evaluate(e=>getComputedStyle(e).display),'none');}
 }
 await screenshot(page,'mobile');for(const id of ['bestiary','crew','party']){await page.locator(`#tab-${id}`).click();await noOverflow(page);}record('901px, 900px and 390px responsive layout; mobile labels hidden; all mobile tabs fit');
 await context.close();
 const reduced=await openPage({width:390,height:844,reduced:'reduce'});
 const fixedA=await snapshot(reduced.page);await reduced.page.waitForTimeout(1200);const fixedB=await snapshot(reduced.page);
 assert.equal(fixedB.elapsed,0);assert.equal(fixedA.frames,fixedB.frames);assert.equal(fixedB.metrics.combat,0);assert.ok(await reduced.page.locator('.bubble:not([hidden])').count()>0);
 await screenshot(reduced.page,'mobile-reduced');record('initial reduced-motion preference: static frame, fixed bubbles, no combat');await reduced.context.close();
 const source=await readFile('src/data.js','utf8');
 const added=await openPage({reduced:'reduce',source:source.replace('export const ISSUES = [',"export const ISSUES = [\n  { id:'qa-low', name:'추가 이슈', grade:'low' },")});
 assert.equal((await snapshot(added.page)).issues.length,4);assert.equal(await added.page.locator('.monster-row').count(),4);assert.equal(await added.page.locator('.issue-card[data-issue="qa-low"]').count(),2);assert.ok((await added.page.locator('[data-grade="low"]').textContent()).includes('추가 이슈'));assert.ok((await added.page.locator('#issue-count').textContent()).includes('4건'));assert.ok((await added.page.locator('.timeline-summary').first().textContent()).includes('4건'));
 record('ISSUES addition updates scene, sidebar, both timelines, bestiary and count');await added.context.close();
 const changed=await openPage({reduced:'reduce',source:source.replace("id: 'nginx', name: 'nginx', grade: 'medium'","id: 'nginx', name: 'nginx', grade: 'critical'")});
 assert.equal((await snapshot(changed.page)).issues.find(i=>i.id==='nginx').grade,'critical');assert.ok((await changed.page.locator('[data-inspect="issue-nginx"]').textContent()).includes('드래곤'));assert.ok((await changed.page.locator('[data-grade="critical"]').textContent()).includes('nginx'));assert.equal(await changed.page.locator('.issue-card[data-issue="nginx"] h4').first().textContent(),'nginx 드래곤');
 record('grade change propagates to monster form and all information panels');await changed.context.close();
 const released=await openPage({reduced:'reduce',source:source.replace("ver: '4.7.4', state: 'planned'","ver: '4.7.4', state: 'released'")});
 assert.equal((await snapshot(released.page)).issues.length,0);assert.equal(await released.page.locator('.monster-row.resolved').count(),3);assert.equal(await released.page.locator('.issue-card.resolved').count(),6);assert.ok((await released.page.locator('#issue-count').textContent()).includes('0건'));assert.equal(await released.page.locator('.monster-label').count(),0);assert.ok((await released.page.locator('#release-schedule').textContent()).includes('발행 완료'));
 record('released state removes monsters and grays completed issues');await released.context.close();
 assert.deepEqual(errors,[]);record('zero console errors, page errors and HTTP errors in all scenarios');
 await writeFile('test-results/browser-report.json',JSON.stringify({date:new Date().toISOString(),url:base,browser:browser.version(),checks,errors},null,2));
}catch(error){
 console.error(error);await writeFile('test-results/browser-report.json',JSON.stringify({checks,errors,failure:String(error)},null,2));process.exitCode=1;
}finally{await browser.close();}
