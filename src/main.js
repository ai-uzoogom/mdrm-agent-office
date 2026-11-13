import { PRODUCT, CURRENT_RELEASE, NEXT_RELEASE, RENDERING, GRADES, RELEASES, CREW, AS_OF_DATE, dDay, clockTime, longDate, kstDate, activeIssues, issueLabel, patchRecords, releaseIssues, targetVersion, validateData } from './data.js';
import { OfficeScene } from './scene.js';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const active = activeIssues();
const patches = patchRecords();
const peaceful = active.length === 0;
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
 document.querySelectorAll('[data-dday]').forEach(el=>el.textContent=dDay(el.dataset.dday));
 const date=$('#today-kst');date.textContent=`${longDate()} KST`;date.dateTime=kstDate();
}
function renderUI(){
 validateData();
 $('#version-current').textContent = `${PRODUCT.name} v${PRODUCT.current}`;
 $('#version-next').textContent = NEXT_RELEASE ? `v${NEXT_RELEASE.ver}` : '';
 $('.version-arrow').hidden = !NEXT_RELEASE;
 $('#version-next').hidden = !NEXT_RELEASE;
 const releaseBadge = $('#release-badge');
 if (NEXT_RELEASE?.date) releaseBadge.dataset.dday = NEXT_RELEASE.date;
 else releaseBadge.textContent = CURRENT_RELEASE?.state === 'released' ? '발행 완료' : '운영 중';
 const date = NEXT_RELEASE?.date ?? CURRENT_RELEASE?.date;
 $('#release-schedule').textContent = date ? `${date} ${NEXT_RELEASE ? '발행 예정' : '발행'}` : '';
 $('#issue-count').textContent = `남은 몬스터 ${active.length}마리`;
 $('#server-state').textContent = peaceful ? '평화' : '방어 중';
 if (peaceful) {
  $('#office-canvas').setAttribute('aria-label', '아이소메트릭 MDRM 오피스. 서버실 균열이 봉인되고 용사와 AGENT가 휴식합니다. 서버랙 앞 퇴치 묘역에 패치된 몬스터가 기록되어 있습니다.');
 }
 $('#crew-count').textContent=String(CREW.length).padStart(2,'0');
 $('#agent-list').innerHTML=CREW.map((p,i)=>`<button class="agent-row" type="button" data-inspect="crew-${i}" aria-label="${esc(p.role)} 상태 보기"><span class="crew-dot" style="--crew-color:${p.shirt}"></span><span>${esc(p.role)}</span><span class="agent-status" id="crew-status-${i}">${esc(p.statuses?.[0]??p.stops[0])}</span></button>`).join('');
 const monsters = active.map(issue => {
  const version = targetVersion(issue);
  return `<button type="button" class="monster-row" data-inspect="issue-${esc(issue.id)}">${badge(issue.grade)}<span class="monster-copy"><span>${esc(issueLabel(issue))}</span><span class="monster-target">${version ? `v${esc(version)} 예정` : '패치 대기 중'}</span></span></button>`;
 }).join('');
 $('#defense-list').innerHTML = `
  <button type="button" class="defender-row" data-inspect="hero" aria-label="MDRM 용사 상태 보기">
   ${img('hero','mini-thumb')}<span class="defender-info"><strong>MDRM 용사</strong><small>v${esc(PRODUCT.current)} · 서버실</small></span>
   <span class="defender-status">${peaceful ? '휴식 중' : '방어 중'}</span>
  </button>
  <button type="button" class="defender-row" data-inspect="pet" aria-label="AGENT 상태 보기">
   ${img('pet','mini-thumb')}<span class="defender-info"><strong>AGENT</strong><small>MDRM의 작은 동료</small></span>
   <span class="defender-status">${peaceful ? '대기 중' : '순찰 중'}</span>
  </button>
  <div class="monster-list">
   ${monsters || '<p class="empty-note">현재 출현 중인 몬스터가 없습니다.</p>'}
   ${patches.length ? `<button type="button" class="patch-link" data-open-patches>퇴치 묘역 · 패치 기록 ${patches.length}건 <span aria-hidden="true">›</span></button>` : ''}
  </div>`;
 $('#panel-history').innerHTML = '<h2 class="history-heading">릴리스 이력 및 패치 기록</h2>' + `<ol class="timeline">${RELEASES.map(release => {
  const issues = releaseIssues(release);
  const released = release.state === 'released';
  const archived = release.state === 'archived';
  const state = {planned:'발행 예정',current:'현재 운영 중',released:'발행 완료',archived:'이전 버전'}[release.state];
  const summary = `${released ? '패치 완료' : release.state === 'planned' ? '패치 예정' : '알려진 이슈'} ${issues.length}건`;
  const items = issues.map(issue => {
   const record = patches.find(record => record.issue.id === issue.id && record.version === release.ver);
   const anchor = record ? `id="patch-${esc(issue.id)}" tabindex="-1"` : '';
   const status = released ? '퇴치 완료' : archived ? '당시 알려진 이슈' : '패치 준비 중';
   return `<li class="issue-card" data-issue="${esc(issue.id)}" ${anchor}>
    ${img(issue.grade)}<div><h4>${esc(issueLabel(issue))}</h4>${badge(issue.grade)}<p>${status}</p></div>
   </li>`;
  }).join('');
  return `<li class="timeline-entry ${release.state}">
   <div class="timeline-title"><h3>v${esc(release.ver)}</h3><span class="release-state">${state}</span>
    ${release.date ? `<span class="timeline-date"><time datetime="${esc(release.date)}">${esc(release.date)}</time>${release.state === 'planned' ? ` · <strong data-dday="${esc(release.date)}"></strong>` : ''}</span>` : ''}
   </div>
   <p class="timeline-summary">${summary}</p>
   ${items ? `<ul class="issue-cards" aria-label="v${esc(release.ver)} ${summary}">${items}</ul>` : '<p class="empty-note">등록된 이슈가 없습니다.</p>'}
  </li>`;
 }).join('')}</ol>`;
 $('#panel-bestiary').innerHTML=intro('알아두면 덜 무서운 몬스터','보안 이슈를 네 가지 모습으로 만나요.')+`<div class="card-grid">${Object.entries(GRADES).map(([key,g])=>`<article class="bestiary-card" data-grade="${key}" style="--grade-color:${g.color}">${img(key,'thumb',g.form)}<p class="grade-code">${g.en}</p><h3>${g.form}</h3>${badge(key)}<p>${active.filter(i=>i.grade===key).map(i=>esc(i.name)).join(' · ')||'현재 출현 없음'}</p></article>`).join('')}</div>`;
 $('#panel-crew').innerHTML=intro('오늘의 오피스 메이커스','각자의 자리에서, 같은 릴리스를 향해.')+`<div class="crew-grid">${CREW.map((p,i)=>`<article class="crew-card">${img(`crew-${i}`,'thumb',p.role+' 캐릭터')}<div><h3><span class="crew-dot" style="--crew-color:${p.shirt}"></span>${esc(p.role)}</h3><p>${i===4?'회의실':'개발실'} · ${p.walker?'이동 근무':'개발 워크스테이션'}</p></div></article>`).join('')}</div>`;
 $('#panel-party').innerHTML=intro('우리의 든든한 용사단','서버실의 평범한 하루를 지키는 특별한 동료들.')+`<div class="party-grid"><article class="party-card">${img('hero','thumb','파란 갑옷과 은색 투구의 MDRM 용사')}<div><h3>MDRM</h3><p class="party-role">용사 · 서버실</p><p>IT 운영 자동화와 재해복구(DR)를 맡은 Mantech의 제품. 현재 운영 버전은 v${PRODUCT.current}입니다.</p></div></article><article class="party-card">${img('pet','thumb','청록색 로봇 AGENT')}<div><h3>AGENT</h3><p class="party-role">펫 · MDRM의 동료</p><p>작은 안테나로 변화를 감지하고, 언제나 용사의 곁을 지켜요. “삐빅! 함께라면 문제없어!”</p></div></article></div>`;
 $('#footer-note').textContent=`정보 기준일 ${AS_OF_DATE}. 몬스터 등급, 개발진 역할, 활동 로그와 전투는 연출용 설정입니다.`;
 updateCalendar();
}
function setCrew(i,status){const el=$(`#crew-status-${i}`);if(!el)return;el.textContent=status;el.classList.toggle('warn',/확인 필요/.test(status));el.classList.toggle('good',/커밋|통과|완료/.test(status));}
function setView({zoom}){ $('#office-canvas').setAttribute('aria-description',`현재 확대 비율 ${Math.round(zoom*100)}%. 0 또는 Home 키로 전체 보기.`); }
function setupTabs(){
 const tabs=[...document.querySelectorAll('[role="tab"]')];
 const activate=tab=>{tabs.forEach(other=>{const active=tab===other;other.setAttribute('aria-selected',String(active));other.tabIndex=active?0:-1;document.getElementById(other.getAttribute('aria-controls')).hidden=!active;});};
 tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>activate(tab));tab.addEventListener('keydown',event=>{let n;if(event.key==='ArrowRight')n=(i+1)%tabs.length;else if(event.key==='ArrowLeft')n=(i-1+tabs.length)%tabs.length;else if(event.key==='Home')n=0;else if(event.key==='End')n=tabs.length-1;else return;event.preventDefault();activate(tabs[n]);tabs[n].focus();});});
}
function showPatchRecord(id = patches[0]?.issue.id) {
 const card = document.getElementById(`patch-${id}`);
 if (!card) return;
 $('#tab-history').click();
 card.focus({preventScroll:true});
 card.scrollIntoView({block:'nearest'});
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
  office=new OfficeScene({canvas:$('#office-canvas'),stage:$('#scene-stage'),overlay:$('#scene-overlays'),onLog:log,onCrew:setCrew,onView:setView,onMotion:text=>{const el=$('#motion-state');el.replaceChildren();const dot=document.createElement('i');dot.className='status-dot';el.append(dot,document.createTextNode(text));},onReady:markReady,onGrave:showPatchRecord});

  document.addEventListener('click', event => {
   if (event.target.closest('[data-open-patches]')) showPatchRecord();
   const button = event.target.closest('[data-inspect]');
   if (button && !button.disabled && office.ready) office.inspect(button.dataset.inspect);
  });
  window.addEventListener('office:calendar',updateCalendar);await office.init();
 }catch(error){
  console.error('MDRM office initialization failed',error);const loading=$('#scene-loading');loading.hidden=false;loading.classList.add('error');loading.replaceChildren();const title=document.createElement('strong');title.textContent='오피스 화면을 불러오지 못했어요';const desc=document.createElement('span');desc.textContent='WebGL을 지원하는 브라우저에서 로컬 HTTP 서버로 열어 주세요. 새로고침하면 다시 연결합니다.';loading.append(title,desc);$('#scene-stage').setAttribute('aria-busy','false');
 }
}
start();
