import { PRODUCT, RENDERING, GRADES, ISSUES, RELEASES, CREW, AS_OF_DATE, dDay, clockTime, longDate, kstDate, activeIssues, issueLabel, resolvedIds, releaseIssues, targetVersion, validateData } from './data.js';
import { OfficeScene } from './scene.js';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const done=resolvedIds();
const badge=grade=>`<span class="grade-badge" style="--grade-color:${GRADES[grade].color}">${GRADES[grade].ko}</span>`;
const img=(key,cls='thumb',alt='')=>`<img class="${cls}" data-thumbnail="${esc(key)}" alt="${esc(alt)}" width="${RENDERING.thumbnailSize}" height="${RENDERING.thumbnailSize}">`;
const intro=(title,copy)=>`<div class="section-intro"><h2>${title}</h2><p>${copy}</p></div>`;
let office;
const logEntries=[];
function log(text,tone=''){
 const time=clockTime();logEntries.unshift({text,tone,time});logEntries.length=Math.min(7,logEntries.length);
 const row=document.createElement('li');row.className=`log-${tone}`;const stamp=document.createElement('time');stamp.textContent=time;const message=document.createElement('span');message.textContent=text;row.append(stamp,message);const list=$('#activity-log');list.prepend(row);while(list.children.length>7)list.lastElementChild.remove();
}
function updateCalendar(){
 document.querySelectorAll('[data-dday]').forEach(el=>el.textContent=dDay(el.dataset.dday||PRODUCT.releaseDate));
 const date=$('#today-kst');date.textContent=`${longDate()} KST`;date.dateTime=kstDate();
}
function renderUI(){
 validateData();
 $('#version-current').textContent=`${PRODUCT.name} v${PRODUCT.current}`;$('#version-next').textContent=`v${PRODUCT.next}`;
 const next=RELEASES.find(r=>r.ver===PRODUCT.next);$('#release-schedule').textContent=`${PRODUCT.releaseDate} ${next?.state==='released'?'발행 완료':'발행 예정'}`;
 $('#issue-count').textContent=`작업 중 이슈 ${activeIssues().length}건`;
 $('#crew-count').textContent=String(CREW.length).padStart(2,'0');
 $('#agent-list').innerHTML=CREW.map((p,i)=>`<button class="agent-row" type="button" data-inspect="crew-${i}" aria-label="${esc(p.role)} 상태 보기"><span class="crew-dot" style="--crew-color:${p.shirt}"></span><span>${esc(p.role)}</span><span class="agent-status" id="crew-status-${i}">${esc(p.statuses?.[0]??p.stops[0])}</span></button>`).join('');
 $('#defense-list').innerHTML=`<button type="button" class="defender-row" data-inspect="hero" aria-label="MDRM 용사 상태 보기">${img('hero','mini-thumb')}<span class="defender-info"><strong><span class="rank-label">HERO</span>MDRM 용사</strong><small>v${PRODUCT.current} · 서버실 방어선</small></span><span class="defender-status">방어 중</span></button><button type="button" class="defender-row" data-inspect="pet" aria-label="AGENT 상태 보기">${img('pet','mini-thumb')}<span class="defender-info"><strong><span class="rank-label pet">PET</span>AGENT</strong><small>MDRM의 작은 동료</small></span><span class="defender-status">순찰 중</span></button><div class="monster-list">${ISSUES.map(issue=>`<button type="button" class="monster-row ${done.has(issue.id)?'resolved':''}" data-inspect="issue-${esc(issue.id)}" ${done.has(issue.id)?'disabled':''} aria-label="${esc(issueLabel(issue))} ${done.has(issue.id)?'퇴치 완료':'상태 보기'}">${badge(issue.grade)}<span class="monster-copy"><span>${esc(issueLabel(issue))}</span><span class="monster-target">${done.has(issue.id)?'퇴치 완료':`${targetVersion(issue)} 퇴치`}</span></span></button>`).join('')||'<p class="empty-note">현재 출현 중인 몬스터가 없습니다.</p>'}</div>`;
 $('#panel-history').innerHTML=intro('한 단계씩, 더 단단하게','작은 패치들이 모여 다음 챕터가 됩니다.')+`<ol class="timeline">${RELEASES.map(r=>{
  const issues=releaseIssues(r),state={planned:'발행 예정',current:'현재 운영 중',released:'발행 완료'}[r.state],count=issues.length;
  const summary=r.state==='released'?`수정 완료 ${count}건`:(r.head??(r.state==='current'?`알려진 이슈 ${count}건`:`수정 예정 ${count}건`)).replace(/\d+\s*건/g,`${count}건`);
  return `<li class="timeline-entry ${r.state}"><div class="timeline-title"><h3>v${esc(r.ver)}</h3><span class="release-state">${state}</span>${r.date?`<span class="timeline-date">${esc(r.date)}${r.state==='planned'?` · <strong data-dday="${r.date}"></strong>`:''}</span>`:''}</div><p class="timeline-summary">${summary}</p><div class="issue-cards">${issues.map(issue=>{
   const isDone=done.has(issue.id);return `<article class="issue-card ${isDone?'resolved':''}" data-issue="${esc(issue.id)}">${img(issue.grade)}<div><h4>${esc(issueLabel(issue))}</h4>${badge(issue.grade)}<p>${isDone?'퇴치 완료':r.state==='planned'?'패치 준비 중':'방어 중 · 패치 예정'}</p></div></article>`;
  }).join('')||'<p class="empty-note">등록된 이슈가 없습니다.</p>'}</div></li>`;
 }).join('')}</ol>`;
 $('#panel-bestiary').innerHTML=intro('알아두면 덜 무서운 몬스터','보안 이슈를 네 가지 모습으로 만나요.')+`<div class="card-grid">${Object.entries(GRADES).map(([key,g])=>`<article class="bestiary-card" data-grade="${key}" style="--grade-color:${g.color}">${img(key,'thumb',g.form)}<p class="grade-code">${g.en}</p><h3>${g.form}</h3>${badge(key)}<p>${activeIssues().filter(i=>i.grade===key).map(i=>esc(i.name)).join(' · ')||'현재 출현 없음'}</p></article>`).join('')}</div>`;
 $('#panel-crew').innerHTML=intro('오늘의 오피스 메이커스','각자의 자리에서, 같은 릴리스를 향해.')+`<div class="crew-grid">${CREW.map((p,i)=>`<article class="crew-card">${img(`crew-${i}`,'thumb',p.role+' 캐릭터')}<div><h3><span class="crew-dot" style="--crew-color:${p.shirt}"></span>${esc(p.role)}</h3><p>${i===4?'회의실':'개발실'} · ${p.walker?'이동 근무':'개발 워크스테이션'}</p></div></article>`).join('')}</div>`;
 $('#panel-party').innerHTML=intro('우리의 든든한 용사단','서버실의 평범한 하루를 지키는 특별한 동료들.')+`<div class="party-grid"><article class="party-card">${img('hero','thumb','파란 갑옷과 은색 투구의 MDRM 용사')}<div><h3>MDRM</h3><p class="party-role">용사 · 서버실 방어선</p><p>IT 운영 자동화와 재해복구(DR)를 맡은 Mantech의 제품. 지금은 v${PRODUCT.current}, ${Number(PRODUCT.releaseDate.slice(5,7))}월 ${Number(PRODUCT.releaseDate.slice(8,10))}일 v${PRODUCT.next}로 강화됩니다.</p></div></article><article class="party-card">${img('pet','thumb','청록색 로봇 AGENT')}<div><h3>AGENT</h3><p class="party-role">펫 · MDRM의 동료</p><p>작은 안테나로 변화를 감지하고, 언제나 용사의 곁을 지켜요. “삐빅! 함께라면 문제없어!”</p></div></article></div>`;
 $('#footer-note').textContent=`정보 기준일 ${AS_OF_DATE}. 몬스터 등급, 개발진 역할, 활동 로그와 전투는 연출용 설정입니다.`;
 updateCalendar();
}
function setCrew(i,status){const el=$(`#crew-status-${i}`);if(!el)return;el.textContent=status;el.classList.toggle('warn',/확인 필요/.test(status));el.classList.toggle('good',/커밋|통과/.test(status));}
function setView({zoom,canZoomIn,canZoomOut,pan}){
 $('#zoom-level').value=`${Math.round(zoom*100)}%`;
 $('#zoom-in').disabled=!canZoomIn;$('#zoom-out').disabled=!canZoomOut;$('#zoom-reset').disabled=!canZoomOut;
 $('#scene-pan-controls').hidden=!canZoomOut;
 document.querySelectorAll('[data-pan]').forEach(button=>button.disabled=!pan[button.dataset.pan]);
}
function setupViewControls(){
 $('#zoom-in').addEventListener('click',()=>office.zoomBy(1));
 $('#zoom-out').addEventListener('click',()=>office.zoomBy(-1));
 $('#zoom-reset').addEventListener('click',()=>office.resetView());
 document.querySelectorAll('[data-pan]').forEach(button=>button.addEventListener('click',()=>office.moveView(button.dataset.pan)));
}
function setupTabs(){
 const tabs=[...document.querySelectorAll('[role="tab"]')];
 const activate=tab=>{tabs.forEach(other=>{const active=tab===other;other.setAttribute('aria-selected',String(active));other.tabIndex=active?0:-1;document.getElementById(other.getAttribute('aria-controls')).hidden=!active;});};
 tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>activate(tab));tab.addEventListener('keydown',event=>{let n;if(event.key==='ArrowRight')n=(i+1)%tabs.length;else if(event.key==='ArrowLeft')n=(i-1+tabs.length)%tabs.length;else if(event.key==='Home')n=0;else if(event.key==='End')n=tabs.length-1;else return;event.preventDefault();activate(tabs[n]);tabs[n].focus();});});
}
function markReady(instance){
 $('#scene-stage').setAttribute('aria-busy','false');$('#scene-loading').hidden=true;
 document.querySelectorAll('[data-thumbnail]').forEach(el=>{el.src=instance.thumbnails[el.dataset.thumbnail];});
 document.documentElement.dataset.officeReady='true';
 // Read-only diagnostics keep local QA observable without creating game controls.
 Object.defineProperty(window,'__OFFICE_DEBUG__',{value:Object.freeze({snapshot:()=>instance.snapshot()}),configurable:false,writable:false});
}
async function start(){
 try{
  renderUI();setupTabs();
  office=new OfficeScene({canvas:$('#office-canvas'),stage:$('#scene-stage'),overlay:$('#scene-overlays'),onLog:log,onCrew:setCrew,onView:setView,onMotion:text=>{const el=$('#motion-state');el.replaceChildren();const dot=document.createElement('i');dot.className='status-dot';el.append(dot,document.createTextNode(text));},onReady:markReady});
  setupViewControls();
  document.addEventListener('click',event=>{const button=event.target.closest('[data-inspect]');if(button&&!button.disabled&&office.ready)office.inspect(button.dataset.inspect);});
  window.addEventListener('office:calendar',updateCalendar);await office.init();
 }catch(error){
  console.error('MDRM office initialization failed',error);const loading=$('#scene-loading');loading.hidden=false;loading.classList.add('error');loading.replaceChildren();const title=document.createElement('strong');title.textContent='오피스 화면을 불러오지 못했어요';const desc=document.createElement('span');desc.textContent='WebGL을 지원하는 브라우저에서 로컬 HTTP 서버로 열어 주세요. 새로고침하면 다시 연결합니다.';loading.append(title,desc);$('#scene-stage').setAttribute('aria-busy','false');
 }
}
start();
