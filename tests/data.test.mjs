import test from 'node:test';
import assert from 'node:assert/strict';
import { kstDate,dDay,particle,activeIssues,resolvedIds,releaseIssues,ISSUES,RELEASES,GRADES,validateData } from '../src/data.js';

test('KST day changes at 15:00 UTC independently of browser timezone',()=>{
 assert.equal(kstDate(new Date('2026-10-30T14:59:59Z')),'2026-10-30');
 assert.equal(kstDate(new Date('2026-10-30T15:00:00Z')),'2026-10-31');
});
test('release countdown handles before, exact date and after using Korean calendar',()=>{
 assert.equal(dDay('2026-11-14',new Date('2026-10-30T15:00:00Z')),'D-14');
 assert.equal(dDay('2026-11-14',new Date('2026-11-13T14:59:59Z')),'D-1');
 assert.equal(dDay('2026-11-14',new Date('2026-11-13T15:00:00Z')),'D-DAY');
 assert.equal(dDay('2026-11-14',new Date('2026-11-14T15:00:00Z')),'D+1');
});
test('Korean particles use batchim, including grade-form subjects',()=>{
 assert.equal(particle('nginx 유령'),'nginx 유령이');
 assert.equal(particle('Java 인증서 오거'),'Java 인증서 오거가');
 assert.equal(particle('php2shell 드래곤','을/를'),'php2shell 드래곤을');
 assert.equal(particle('Java 인증서 오거','을/를'),'Java 인증서 오거를');
 assert.equal(particle('MDRM'),'MDRM이');
});
test('released issues disappear from active scene data without mutation',()=>{
 const releases=RELEASES.map((r,i)=>i===0?{...r,state:'released'}:{...r});
 assert.equal(activeIssues(ISSUES,releases).length,0);
 assert.equal(resolvedIds(releases).size,3);
 assert.equal(activeIssues().length,3);
});
test('partial releases resolve only explicitly listed issues',()=>{
 const releases=[{state:'released',ids:['php2shell']}];
 assert.deepEqual(activeIssues(ISSUES,releases).map(i=>i.id),['javacert','nginx']);
});
test('adding an issue automatically updates planned/current history; released history stays scoped',()=>{
 const added=[...ISSUES,{id:'test',name:'테스트 이슈',grade:'low'}];
 assert.equal(activeIssues(added).length,4);
 assert.equal(releaseIssues(RELEASES[0],added).length,4);
 assert.equal(releaseIssues(RELEASES[1],added).length,4);
 assert.equal(releaseIssues({...RELEASES[0],state:'released'},added).length,3);
});
test('content is valid and every configured grade has a form and color',()=>{
 assert.doesNotThrow(validateData);
 assert.equal(Object.keys(GRADES).length,4);
 for(const i of ISSUES){assert.ok(GRADES[i.grade].form);assert.match(GRADES[i.grade].color,/^#[0-9a-f]{6}$/i);}
});
