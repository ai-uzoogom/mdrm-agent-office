import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const url=process.env.OFFICE_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const checks=[],errors=[];
const record=name=>{checks.push(name);console.log('PASS',name);};
const snap=page=>page.evaluate(()=>window.__OFFICE_DEBUG__.snapshot());
const bubbles=page=>page.locator('.bubble:not(.battle-pop):not([hidden])').allTextContents();
await mkdir('test-results',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(url);await page.waitForFunction(()=>document.documentElement.dataset.officeReady==='true');await page.evaluate(()=>document.fonts.ready);
 const first=await snap(page);
 const visibleLabels=()=>page.locator('.hover-label').evaluateAll(els=>els.filter(el=>getComputedStyle(el).visibility!=='hidden').map(el=>el.dataset.actor));
 assert.deepEqual(await visibleLabels(),[],'role signs should be hidden without hover');
 assert.equal((await bubbles(page)).length,1);
 assert.match((await bubbles(page))[0],/java4shell 분석/);
 await page.evaluate(()=>{
  window.speechSamples=[];
  window.speechSampler=setInterval(()=>window.speechSamples.push(window.__OFFICE_DEBUG__.snapshot()),20);
 });
 await page.waitForTimeout(30000);
 const samples=await page.evaluate(()=>{clearInterval(window.speechSampler);return window.speechSamples;});
 const ordinary=s=>s.bubbles.filter(b=>!b.battle);
 assert.ok(samples.every(s=>ordinary(s).length<=3&&s.bubbles.filter(b=>b.battle).length<=1),'speaker cap exceeded');
 assert.ok(samples.every(s=>new Set(ordinary(s).map(b=>b.actor)).size===ordinary(s).length),'same actor speaking twice');
 assert.ok(samples.some(s=>ordinary(s).length===3),'never reached three speakers');
 assert.ok(samples.some(s=>ordinary(s).length<3),'speaker count never varies');
 const actors=new Set(samples.flatMap(s=>ordinary(s).map(b=>b.actor)));
 assert.ok(actors.size>=4,'too few different speakers');
 const after=await snap(page);
 assert.ok(after.metrics.teamSpeech-first.metrics.teamSpeech>=12,'random conversations too infrequent');
 assert.ok(after.metrics.encouragementSpeech-first.metrics.encouragementSpeech>=2,'encouragement missing');
 const starts=[];
 for(const actor of actors){
  const runs=[];
  for(const s of samples){
   const message=ordinary(s).find(b=>b.actor===actor),key=message?.text??null;
   if(key!==runs.at(-1)?.key){runs.push({key,start:s.elapsed,end:s.elapsed});if(key)starts.push(s.elapsed);}
   else runs.at(-1).end=s.elapsed;
  }
  for(const run of runs.filter(r=>r.key&&r.start>samples[0].elapsed+.1&&r.end<samples.at(-1).elapsed-.1))assert.ok(run.end-run.start>=2.65,'conversation cut short');
 }
 starts.sort((a,b)=>a-b);const intervals=starts.slice(1).map((t,i)=>t-starts[i]);
 assert.ok(Math.max(...intervals)-Math.min(...intervals)>.2,'speech intervals are not varying');
 assert.equal(first.viewport.height,after.viewport.height);
 record('30 seconds: randomized speakers and intervals, up to three conversations, no duplicates, full reading time and encouragement');
 await page.locator('[data-inspect="crew-6"]').click();
 assert.ok((await bubbles(page)).some(text=>text.includes('일정 독려')));
 await page.waitForFunction(()=>{const s=window.__OFFICE_DEBUG__.snapshot();return s.battle?.shieldRaised&&s.bubbles.some(b=>b.text==='방어!');});
 assert.deepEqual(await page.locator('.battle-pop:not([hidden])').allTextContents(),['방어!']);
 assert.ok((await bubbles(page)).some(text=>text.includes('일정 독려')),'defense interrupted the selected conversation');
 await page.locator('.scene-panel').screenshot({path:'test-results/random-dialogue-defense-desktop.png'});
 await page.locator('[data-inspect="pet"]').click();
 assert.ok((await bubbles(page)).includes('삐빅'));assert.ok((await bubbles(page)).length<=3);
 record('selected conversation stays readable while defense displays on time');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
 const frozen=await snap(page),fixedText=await bubbles(page);await page.waitForTimeout(300);
 assert.equal((await snap(page)).frames,frozen.frames);assert.deepEqual(await bubbles(page),fixedText);
 assert.ok(fixedText.length<=3);
 await page.locator('#office-canvas').scrollIntoViewIfNeeded();
 const rect=await page.locator('#office-canvas').boundingBox();
 for(const key of ['crew-0','crew-5','crew-6']){
  const actor=(await snap(page)).crew.find(a=>a.key===key);
  await page.mouse.move(rect.x+actor.screen.x,rect.y+actor.screen.y);
  assert.deepEqual(await visibleLabels(),[key],`hover did not isolate ${key}`);
 }
 await page.mouse.move(0,0);assert.deepEqual(await visibleLabels(),[]);
 assert.equal((await snap(page)).frames,frozen.frames,'hover restarted the reduced-motion renderer');
 record('role signs appear only over the hovered character, clear on exit, and work with reduced motion');
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
  if(width===1440||width===390)await page.screenshot({path:`test-results/random-dialogue-${width}.png`,fullPage:true});
 }
 record('12px secondary text, 44px rows, all tabs and seven desktop/mobile sizes fit');
 await page.setViewportSize({width:390,height:844});
 await page.locator('button[data-floor="basement"]').focus();await page.keyboard.press('Enter');
 assert.equal((await snap(page)).floor,'basement');
 assert.ok(await page.locator('button[data-floor="basement"]').evaluate(el=>getComputedStyle(el).outlineStyle==='solid'));
 assert.equal(await page.locator('.bubble:not([hidden])').evaluateAll(els=>els.filter(el=>getComputedStyle(el).visibility!=='hidden').length),0);
 await page.locator('.scene-panel').screenshot({path:'test-results/random-dialogue-basement.png'});
 await page.locator('button[data-floor="office"]').click();assert.equal((await snap(page)).floor,'office');
 record('keyboard floor selection has visible focus; basement hides office bubbles');
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 mobile.on('pageerror',e=>errors.push(String(e)));
 await mobile.goto(url);await mobile.waitForFunction(()=>document.documentElement.dataset.officeReady==='true');
 assert.equal((await bubbles(mobile)).length,1,'initial reduced motion shows more than one bubble');
 await mobile.locator('[data-inspect="crew-5"]').tap();
 assert.ok((await bubbles(mobile)).some(text=>text.includes('운영 지원')));assert.ok((await bubbles(mobile)).length<=3);
 assert.equal(await mobile.locator('.hover-label').evaluateAll(els=>els.filter(el=>getComputedStyle(el).visibility!=='hidden').length),0);
 await mobile.locator('#office-canvas').scrollIntoViewIfNeeded();
 await mobile.locator('.scene-panel').screenshot({path:'test-results/random-dialogue-touch.png'});
 await mobile.close();
 record('mobile tap still opens character details without sticky hover signs or exceeding the speaker cap');
 assert.deepEqual(errors,[]);record('zero page, console and HTTP errors');
 await writeFile('test-results/polish-report.json',JSON.stringify({url,checks,contrast,errors},null,2));
}catch(e){console.error(e);process.exitCode=1;await writeFile('test-results/polish-report.json',JSON.stringify({url,checks,errors,failure:String(e)},null,2));}
finally{await browser.close();}
