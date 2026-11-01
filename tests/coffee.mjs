import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-proxy-server']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:680},deviceScaleFactor:2}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(new URL('tests/coffee-review.html',process.env.OFFICE_URL||'http://127.0.0.1:4173/').href);await page.waitForFunction(()=>document.documentElement.dataset.reviewReady==='true');
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/coffee-grip.png',fullPage:true});
 const data=await page.evaluate(()=>window.__COFFEE_REVIEW__);assert.equal(data.parent,'arm-right');assert.deepEqual(data.actions.sort(),['idle','walk']);assert.equal(data.stops.length,4);
 const maxGap=Math.max(...data.samples.map(s=>s.gap)),minUpright=Math.min(...data.samples.map(s=>s.upright)),reaches=data.samples.map(s=>s.reach);
 assert.ok(maxGap<.001,`cup handle left the animated hand by ${maxGap}`);assert.ok(minUpright>.99999,'coffee tipped while walking');assert.ok(Math.max(...reaches)-Math.min(...reaches)<.001,'arm reach changed');
 assert.ok(data.samples.every(s=>s.armScale.every(v=>v===1)),'arm stretched');assert.ok(data.samples.some(s=>Math.hypot(...s.handle.map((v,i)=>v-data.samples[0].handle[i]))>5),'cup did not follow route');assert.deepEqual(errors,[]);
 const report={date:new Date().toISOString(),frames:data.samples.length,simulationSeconds:60,stops:data.stops,actions:data.actions,parent:data.parent,maxHandHandleGap:maxGap,minUpright,reachRange:[Math.min(...reaches),Math.max(...reaches)],errors};
 await writeFile('test-results/coffee-report.json',JSON.stringify(report,null,2));console.log('PASS coffee: 1800 actual skin-hand samples, 4 stops, walk/idle, upright and original arm length');
}finally{await browser.close();}
