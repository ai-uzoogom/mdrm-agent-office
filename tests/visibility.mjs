import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writeFile,mkdir,mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const executablePath=process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url=process.env.OFFICE_URL||'http://127.0.0.1:4173/';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const result={date:new Date().toISOString()};
await mkdir('test-results',{recursive:true});

async function checkWalking(){
 const browser=await chromium.launch({executablePath,headless:true,args:['--no-proxy-server']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:960}});await page.goto(url);await page.waitForFunction(()=>!!window.__OFFICE_DEBUG__);
  const collisions=[],stops=new Set(),start=Date.now();
  while(Date.now()-start<23000){
   const s=await page.evaluate(()=>window.__OFFICE_DEBUG__.snapshot());
   for(const actor of s.crew.slice(4)){
    stops.add(`${actor.key}:${actor.status}`);const [x,,z]=actor.position;
    for(const obstacle of s.walkObstacles){
     const dx=Math.max(obstacle.min[0]-x,0,x-obstacle.max[0]),dz=Math.max(obstacle.min[2]-z,0,z-obstacle.max[2]);
     if(Math.hypot(dx,dz)<.8)collisions.push({actor:actor.key,obstacle:obstacle.name,position:actor.position});
    }
   }
   await page.waitForTimeout(200);
  }
  assert.deepEqual(collisions,[],'walker intersected furniture');
  assert.equal(stops.size,6,'not all walking stops observed');
  result.walking={seconds:23,collisions,observedStops:[...stops]};console.log('PASS full walking routes avoid furniture');
 }finally{await browser.close();}
}
async function checkNativeVisibility(){
 // An attached debugger can keep Chromium visible. Observe actual visibility events
 // while no page debugger is attached; never override document.hidden or dispatch fake events.
 const profile=await mkdtemp(join(tmpdir(),'mdrm-native-visibility-'));
 const child=spawn(executablePath,['--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--no-proxy-server','about:blank'],{stdio:'ignore'});
 let socket,id=0;const pending=new Map();
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
  const callId=++id;const timer=setTimeout(()=>{pending.delete(callId);reject(new Error('CDP timeout: '+method));},8000);
  pending.set(callId,{resolve,reject,timer});socket.send(JSON.stringify({id:callId,method,params,...(sessionId?{sessionId}:{})}));
 });
 try{
  let address;
  for(let i=0;i<80;i++){try{const [port,path]=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n');address=`ws://127.0.0.1:${port}${path}`;break;}catch{await sleep(100);}}
  assert.ok(address,'Chrome debugger did not start');socket=new WebSocket(address);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  socket.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const call=pending.get(message.id);if(!call)return;pending.delete(message.id);clearTimeout(call.timer);if(message.error)call.reject(new Error(JSON.stringify(message.error)));else call.resolve(message.result);};
  const {targetId}=await send('Target.createTarget',{url});await send('Target.activateTarget',{targetId});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  let ready=false;
  for(let i=0;i<100;i++){const response=await send('Runtime.evaluate',{expression:'!!window.__OFFICE_DEBUG__',returnByValue:true},sessionId);if(response.result.value){ready=true;break;}await sleep(100);}
  assert.ok(ready,'office did not initialize');
  await send('Runtime.evaluate',{expression:`window.__visibilityCapture=[];document.addEventListener('visibilitychange',()=>{const s=window.__OFFICE_DEBUG__.snapshot();window.__visibilityCapture.push({hidden:document.hidden,elapsed:s.elapsed,frames:s.frames,metrics:s.metrics})});`,returnByValue:true},sessionId);
  await send('Target.detachFromTarget',{sessionId});
  const foreground=await send('Target.createTarget',{url:'about:blank',background:false});await send('Target.activateTarget',{targetId:foreground.targetId});await sleep(2000);
  await send('Target.activateTarget',{targetId});await sleep(500);
  const resumed=await send('Target.attachToTarget',{targetId,flatten:true});
  const response=await send('Runtime.evaluate',{expression:'({events:window.__visibilityCapture,current:window.__OFFICE_DEBUG__.snapshot()})',returnByValue:true},resumed.sessionId);
  const observation=response.result.value;const hidden=observation.events.find(e=>e.hidden),visible=observation.events.find(e=>!e.hidden);
  assert.ok(hidden&&visible,'no actual background/foreground visibility events');
  assert.equal(hidden.frames,visible.frames);assert.equal(hidden.elapsed,visible.elapsed);assert.deepEqual(hidden.metrics,visible.metrics);
  assert.ok(observation.current.frames>visible.frames,'did not resume');assert.ok(observation.current.elapsed-visible.elapsed<1,'background time was replayed on resume');
  result.visibility={actualDocumentHidden:true,hiddenSeconds:2,framesDuringHidden:visible.frames-hidden.frames,simulationDeltaDuringHidden:visible.elapsed-hidden.elapsed,resumedDelta:observation.current.elapsed-visible.elapsed,events:observation.events};
  console.log('PASS actual hidden tab: zero frames and zero simulation time; normal resume');
  await send('Browser.close');
 }finally{
  for(const call of pending.values())clearTimeout(call.timer);socket?.close();child.kill('SIGTERM');await sleep(600);await rm(profile,{recursive:true,force:true});
 }
}
try{await checkWalking();await checkNativeVisibility();}
catch(error){result.failure=String(error);console.error(error);process.exitCode=1;}
finally{await writeFile('test-results/visibility-report.json',JSON.stringify(result,null,2));}
