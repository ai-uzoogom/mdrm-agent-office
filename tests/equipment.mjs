import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const executablePath=process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const base=process.env.OFFICE_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({executablePath,headless:true,args:['--no-proxy-server']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:650},deviceScaleFactor:2});
 page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.goto(new URL('tests/character-review.html',base).href);await page.waitForFunction(()=>document.documentElement.dataset.reviewReady==='true');
 const data=await page.evaluate(()=>window.__CHARACTER_REVIEW__);
 assert.equal(data.headVisible,false,'original hair is still rendered through the helmet');
 assert.equal(data.swordParent,'arm-right');assert.equal(data.shieldParent,'arm-left');
 assert.ok(data.reports.slice(0,3).every(pose=>pose.gearFloorMin>=0),'weapon or shield intersects the floor');
 for(const frame of data.frames){assert.deepEqual(frame.sword,data.anchors.sword);assert.deepEqual(frame.shield,data.anchors.shield);assert.ok([...frame.swordWorld,...frame.shieldWorld].every(Number.isFinite));}
 for(const equipment of ['sword','shield']){
  const positions=data.frames.map(f=>f[equipment+'World']);
  assert.ok(positions.some(p=>Math.hypot(...p.map((value,i)=>value-positions[0][i]))>.3),equipment+' stayed behind while its hand animated');
 }
 assert.ok(Math.hypot(...data.reports[1].sword.map((v,i)=>v-data.reports[0].sword[i]))>.5,'attack did not move the sword hand');
 assert.ok(Math.hypot(...data.reports[2].shield.map((v,i)=>v-data.reports[0].shield[i]))>.5,'guard did not move the shield hand');
 assert.equal(data.female,'character-female-e');assert.equal(data.phoneParent,'arm-right');assert.equal(data.waves,true);
 assert.deepEqual(errors,[]);await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/character-equipment.png',fullPage:true});
 await writeFile('test-results/equipment-report.json',JSON.stringify({date:new Date().toISOString(),poses:data.reports,animationFrames:data.frames.length,gripsStayAttached:true,originalHairHidden:true,coordinator:data.female,errors},null,2));
 console.log('PASS helmet, 60 animated hand-grip samples, attack/guard poses, and female coordinator prop');
}finally{await browser.close();}
