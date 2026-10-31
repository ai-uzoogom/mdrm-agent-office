import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-proxy-server']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:650},deviceScaleFactor:2});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(new URL('tests/workstation-review.html',process.env.OFFICE_URL||'http://127.0.0.1:4173/').href);await page.waitForFunction(()=>document.documentElement.dataset.reviewReady==='true');
 const data=await page.evaluate(()=>window.__WORKSTATION_REVIEW__);
 const report={chairFacing:data.chairFacing,kneeSpace:data.kneeSpace,bodies:data.samples[0].map((_,actor)=>({actor,torso:data.samples[0][actor].torso,desk:data.samples[0][actor].desk})),hands:data.samples[0].map((_,actor)=>['left','right'].map((side,hand)=>{
  const frames=data.samples.map(s=>s[actor].hands[hand]),positions=frames.map(f=>f.position),keyboard=data.samples[0][actor].keyboard;
  return {actor,side,minClearance:Math.min(...frames.map(f=>f.minimum[1]-keyboard.max.y)),motion:Math.max(...positions.map(p=>Math.hypot(...p.map((v,i)=>v-positions[0][i])))),range:[0,1,2].map(axis=>[Math.min(...positions.map(p=>p[axis])),Math.max(...positions.map(p=>p[axis]))])};
 })).flat(),displays:data.displays,errors};
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/workstations.png',fullPage:true});await writeFile('test-results/workstations-report.json',JSON.stringify(report,null,2));
 assert.deepEqual(errors,[]);
 for(const frame of data.samples)for(const actor of frame)assert.ok(actor.torso.min.z-actor.desk.max.z>=.12,'torso intersects the desk front');
 for(const desk of data.kneeSpace)for(const gap of desk)assert.ok(gap===Infinity||gap>.5,'closed desk panel blocks the knees');
 for(const hand of report.hands){assert.ok(hand.minClearance>=0,`actor ${hand.actor} ${hand.side} hand clips the keys`);assert.ok(hand.minClearance<.16,'hand never approaches the keyboard');assert.ok(hand.motion>.12,'typing is barely moving');}
 for(const frames of data.samples)for(const actor of frames)for(const hand of actor.hands){
  assert.deepEqual(hand.scale,[1,1,1],'typing stretches the arm');assert.ok(hand.position[0]>actor.keyboard.min.x&&hand.position[0]<actor.keyboard.max.x,'hand is outside the keyboard width');
  assert.ok(hand.position[2]>actor.keyboard.min.z-.1&&hand.position[2]<actor.keyboard.max.z+.1,'hand is outside the keyboard depth');
 }
 for(const chair of data.chairFacing)assert.ok(chair.backDotTable<-.4,'chair back faces into the table');
 assert.equal(report.displays.length,5);
 for(const display of report.displays){assert.ok(display.changedPixels>150,'display animation is visually static');for(const point of display.contact){assert.ok(point&&point.gap<.005,'display floats away from its native LCD');assert.ok(point.alignment>.9999,'display does not follow the native LCD tilt');}}
 await page.setViewportSize({width:390,height:844});await page.goto(process.env.OFFICE_URL||'http://127.0.0.1:4173/');await page.waitForFunction(()=>window.__OFFICE_DEBUG__?.snapshot().ready);
 for(const selector of ['.name-label','.wall-label','.monster-label','.board-label'])assert.notEqual(await page.locator(selector).first().evaluate(e=>getComputedStyle(e).display),'none');
 for(let i=0;i<5;i++)await page.getByRole('button',{name:'사무실 확대',exact:true}).click();
 assert.equal(await page.locator('#zoom-level').textContent(),'225%');await page.locator('#scene-stage').screenshot({path:'test-results/workstations-mobile-225.png'});
 assert.deepEqual(errors,[]);
 console.log(`PASS ${data.samples.length*10} hand samples, original arm lengths, and 5 animated screens attached to their native LCD faces`);
}finally{await browser.close();}
