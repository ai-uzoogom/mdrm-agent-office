import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const url=process.env.OFFICE_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const checks=[],errors=[];
const record=name=>{checks.push(name);console.log('PASS',name);};
const snap=page=>page.evaluate(()=>window.__OFFICE_DEBUG__.snapshot());
const bubbles=page=>page.locator('.bubble:not([hidden])').allTextContents();
await mkdir('test-results',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(url);await page.waitForFunction(()=>document.documentElement.dataset.officeReady==='true');await page.evaluate(()=>document.fonts.ready);
 const first=await snap(page);
 assert.ok((await bubbles(page)).length>1,'character bubbles should appear independently');
 const initialText=(await bubbles(page)).join(' ');
 assert.match(initialText,/java4shell 분석/);
 assert.match(initialText,/기존 패치 재검증/);
 assert.match(initialText,/패치 일정 미정/);
 assert.doesNotMatch(initialText,/php2shell 패치|nginx 패치|Java 인증서 패치|오늘도 이상 무/);
 for(let i=0;i<10;i++){
  const state=await snap(page);
  for(const actor of state.crew){
   const bubble=state.bubbles.find(b=>b.actor===actor.key);
   if(bubble)assert.equal(bubble.text,actor.status,'a stale queued message is showing');
  }
  await page.waitForTimeout(500);
 }
 const after=await snap(page);assert.equal(first.viewport.height,after.viewport.height,'activity changed scene height');
 record('independent bubbles show current java4shell work without delayed messages');
 await page.locator('[data-inspect="crew-6"]').click();
 assert.match(await page.locator('.bubble[data-actor="crew-6"]').textContent(),/일정 독려/);
 await page.locator('[data-inspect="pet"]').click();
 assert.equal(await page.locator('.bubble[data-actor="pet"]').textContent(),'삐빅');
 assert.equal(await page.locator('.bubble[data-actor="crew-6"]').getAttribute('hidden'),null);
 record('selecting another character does not dismiss the previous character bubble');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
 const frozen=await snap(page),fixedText=await bubbles(page);await page.waitForTimeout(300);
 assert.equal((await snap(page)).frames,frozen.frames);assert.deepEqual(await bubbles(page),fixedText);
 assert.ok(fixedText.length>1);
 record('reduced motion freezes independent bubbles and stops rendering');
 const contrast=await page.evaluate(()=>{
  const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number);
  const over=(a,b)=>{const alpha=a[3]??1;return a.slice(0,3).map((v,i)=>v*alpha+b[i]*(1-alpha));};
  const bg=el=>{if(!el)return [12,10,29];return over(rgb(getComputedStyle(el).backgroundColor),bg(el.parentElement));};
  const luminance=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  return [...document.querySelectorAll('.micro-label,.scene-live,.scene-caption,.agent-status,.simulation-tag,.floor-navigation button,.timeline-date,.empty-note')].map(el=>{
   const back=bg(el),front=over(rgb(getComputedStyle(el).color),back),a=luminance(front),b=luminance(back);
   return {text:el.textContent.trim(),ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
  });
 });
 for(const row of contrast)assert.ok(row.ratio>=4.5,`low contrast ${row.text}: ${row.ratio}`);
 record('secondary labels, status text and floor controls exceed 4.5:1 contrast');
 for(const {width,height} of [{width:1440,height:1000},{width:1280,height:1000},{width:901,height:844},{width:900,height:844},{width:390,height:844},{width:375,height:812},{width:844,height:390}]){
  await page.setViewportSize({width,height});await page.waitForTimeout(80);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}: horizontal overflow`);
  if(width>900){
   const metrics=await page.locator('.side-panels').evaluate(el=>({client:el.clientHeight,scroll:el.scrollHeight}));
   assert.ok(metrics.scroll<=metrics.client+1,`${width}: sidebar overflows ${JSON.stringify(metrics)}`);
  }
  const overlaps=await page.locator('.name-label').evaluateAll(nodes=>{
   const visible=nodes.filter(el=>getComputedStyle(el).visibility!=='hidden').map(el=>({text:el.textContent,b:el.getBoundingClientRect()}));
   const pairs=[];visible.forEach((a,i)=>visible.slice(i+1).forEach(b=>{
    if(Math.min(a.b.right,b.b.right)-Math.max(a.b.left,b.b.left)>1&&Math.min(a.b.bottom,b.b.bottom)-Math.max(a.b.top,b.b.top)>1)pairs.push([a.text,b.text]);
   }));return pairs;
  });
  assert.deepEqual(overlaps,[],`${width}: overlapping name labels`);
  const sizes=await page.locator('.micro-label,.agent-status,.panel-count,.simulation-tag').evaluateAll(els=>els.map(el=>parseFloat(getComputedStyle(el).fontSize)));
  assert.ok(sizes.every(size=>size>=12));
  assert.ok(await page.locator('[data-inspect="crew-0"]').evaluate(el=>el.getBoundingClientRect().height>=44));
  for(const tab of ['history','bestiary','crew','party']){
   await page.locator(`#tab-${tab}`).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.locator('#tab-history').click();await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  if(width===1440||width===390)await page.screenshot({path:`test-results/dialogue-restored-${width}.png`,fullPage:true});
 }
 record('12px secondary text, 44px rows, all tabs and seven desktop/mobile sizes fit');
 await page.setViewportSize({width:390,height:844});
 await page.locator('button[data-floor="basement"]').focus();await page.keyboard.press('Enter');
 assert.equal((await snap(page)).floor,'basement');
 assert.ok(await page.locator('button[data-floor="basement"]').evaluate(el=>getComputedStyle(el).outlineStyle==='solid'));
 assert.equal(await page.locator('.bubble:not([hidden])').evaluateAll(els=>els.filter(el=>getComputedStyle(el).visibility!=='hidden').length),0);
 await page.locator('.scene-panel').screenshot({path:'test-results/dialogue-restored-basement.png'});
 await page.locator('button[data-floor="office"]').click();assert.equal((await snap(page)).floor,'office');
 record('keyboard floor selection has visible focus; basement hides office bubbles');
 assert.deepEqual(errors,[]);record('zero page, console and HTTP errors');
 await writeFile('test-results/polish-report.json',JSON.stringify({url,checks,contrast,errors},null,2));
}catch(e){console.error(e);process.exitCode=1;await writeFile('test-results/polish-report.json',JSON.stringify({url,checks,errors,failure:String(e)},null,2));}
finally{await browser.close();}
