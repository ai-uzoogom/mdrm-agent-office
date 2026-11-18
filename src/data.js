// Content is the only input for the scene, cards, history and bestiary.
export const PRODUCT = { name: 'MDRM', current: '4.7.4' };
// 세밀한 픽셀 표현: 화면 밀도를 반영하되 렌더 비용에 상한을 둡니다.
export const RENDERING = { maxSceneWidth: 3840, maxPixelRatio: 6, detailScale: 1.5, maxScenePixels: 8000000, thumbnailSize: 768 };
export const GRADES = {
  low: { ko: '낮음', en: 'LOW', form: '꼬마 유령', color: '#4fd16b' },
  medium: { ko: '보통', en: 'MEDIUM', form: '유령', color: '#c79bff' },
  high: { ko: '높음', en: 'HIGH', form: '오거', color: '#f6a050' },
  critical: { ko: '치명', en: 'CRITICAL', form: '드래곤', color: '#ff8a86' },
};
// TODO: 임시 이슈 등급. 추후 제공되는 보안 요건 목록으로 교체합니다.
// MDRM은 Linux 커널 기반 제품이 아닙니다. 아래 명시된 이슈만 표시합니다.
export const ISSUES = [
  { id: 'php2shell', name: 'php2shell', grade: 'critical' },
  { id: 'javacert', name: 'Java 인증서', grade: 'high' },
  { id: 'nginx', name: 'nginx', grade: 'medium' },
  { id: 'java4shell', name: 'java4shell', grade: 'critical' },
];
export const RELEASES = [
  { ver: '4.7.4', state: 'released', date: '2026-11-13', ids: ['php2shell', 'javacert', 'nginx'] },
  { ver: '4.7.3', state: 'archived', ids: ['php2shell', 'javacert', 'nginx'] },
];
export const CURRENT_RELEASE = RELEASES.find(r => r.ver === PRODUCT.current);
export const NEXT_RELEASE = RELEASES.find(r => r.state === 'planned');
const currentIssues = activeIssues();
const peaceful = currentIssues.length === 0;
const focusIssue = currentIssues.length === 1 ? currentIssues[0].name : '신규 이슈';
// TODO: 개발진 역할, 이름, 상태 문구는 연출을 위한 임시 설정입니다.
export const CREW = [
  { role: '취약점 분석', shirt: '#4a7bf0', screen: '#4fd16b', statuses: peaceful ? ['패치 기록 정리', '분석 자료 정리', '후속 점검 중'] : [`${focusIssue} 분석`, '영향 범위 분석', '재현 조건 확인', '분석 내용 공유'] },
  { role: '패치 개발', shirt: '#4fa86a', screen: '#4fb3ff', statuses: peaceful ? ['수정 기록 정리', '코드 정리 중', '후속 점검 중'] : ['수정안 작성 중', '코드 리뷰 중', '테스트 요청', '수정안 보완 중'] },
  { role: '회귀 테스트', shirt: '#a468ff', screen: '#f5c542', statuses: peaceful ? ['패치 검증 기록', '회귀 테스트 정리', '후속 점검 중'] : ['기존 패치 재검증', '회귀 테스트 중', '재현 조건 테스트', '결과 정리 중'] },
  { role: '빌드·검수', shirt: '#e5873a', screen: '#f6a050', statuses: peaceful ? ['빌드 통과', '릴리스 기록 정리', '발행 완료'] : ['검증 빌드 준비', '테스트 빌드 중', '확인 필요', '검수 결과 정리'] },
  { role: '릴리스 관리', shirt: '#c8503a', walker: true, stops: peaceful ? ['발행 기록 정리', '릴리스 기록 점검'] : [NEXT_RELEASE ? `v${NEXT_RELEASE.ver} 일정 점검` : '패치 일정 미정', '검증 결과 취합'] },
  { role: '운영 지원', shirt: '#e8b84a', walker: true, stops: peaceful ? ['커피 타임', '커피 내리는 중', '잠깐 산책', '자리 복귀'] : ['대응팀 커피 배달', '커피 내리는 중', '운영 상태 확인', '상황 공유 중'] },
  { role: '일정 독려', shirt: '#f5c542', walker: true, behavior: 'encourage', stops: peaceful ? ['모두 수고했어요', '패치 기록 정리해요', '커피 한잔하고 가요'] : ['좋아요, 함께 풀어봐요', '차근차근 확인해요', '수고 많아요, 힘내요'] },
];
export const MEETING_STATUSES = peaceful
  ? ['발행 기록 정리', '기존 패치 회고', '운영 상태 점검']
  : [`${focusIssue} 대응 논의`, '영향 범위 공유', NEXT_RELEASE ? `v${NEXT_RELEASE.ver} 일정 점검` : '패치 일정 미정', '검증 결과 취합'];
export const AS_OF_DATE = '2026-11-18';
export const TIME_ZONE = 'Asia/Seoul';

export function kstDate(date = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => p.find(x => x.type === type).value).join('-');
}
export function dDay(target = NEXT_RELEASE?.date ?? CURRENT_RELEASE?.date, now = new Date()) {
  const days = Math.round((Date.parse(`${target}T00:00:00Z`) - Date.parse(`${kstDate(now)}T00:00:00Z`)) / 86400000);
  return days === 0 ? 'D-DAY' : days > 0 ? `D-${days}` : `D+${-days}`;
}
export function clockTime(date = new Date()) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}
export function longDate(date = new Date()) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).format(date);
}
// Latin product names use the final sound of their usual Korean reading.
const LATIN_FINAL = { nginx: true, php2shell: true, MDRM: true, AGENT: false };
export function particle(word, pair = '이/가') {
  const [closed, open] = pair.split('/');
  const last = [...word.trim()].at(-1) || '';
  const cp = last.codePointAt(0);
  let batchim = cp >= 0xac00 && cp <= 0xd7a3 ? (cp - 0xac00) % 28 !== 0 : /[013678lmn]$/i.test(last);
  if (word in LATIN_FINAL) batchim = LATIN_FINAL[word];
  return word + (batchim ? closed : open);
}
export function issueLabel(issue) { return `${issue.name} ${GRADES[issue.grade].form}`; }
export function resolvedIds(releases = RELEASES) { return new Set(releases.filter(r => r.state === 'released').flatMap(r => r.ids)); }
export function activeIssues(issues = ISSUES, releases = RELEASES) { const done = resolvedIds(releases); return issues.filter(i => !done.has(i.id)); }
export function releaseIssues(release, issues = ISSUES) {
  // A planned/current release shows new issues automatically, even before its ids are updated.
  return ['released', 'archived'].includes(release.state) ? issues.filter(i => release.ids.includes(i.id)) : issues;
}
export function patchRecords(issues = ISSUES, releases = RELEASES) {
  const published = releases.filter(r => r.state === 'released').sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const records = new Map();
  for (const release of published) {
    for (const issue of releaseIssues(release, issues)) {
      if (!records.has(issue.id)) records.set(issue.id, { issue, version: release.ver, date: release.date });
    }
  }
  return [...records.values()];
}
export function targetVersion(issue, releases = RELEASES) {
  return releases.find(r => r.state === 'planned' && r.ids.includes(issue.id))?.ver ?? releases.find(r => r.state === 'planned')?.ver;
}
export function validateData() {
  const seen = new Set();
  for (const issue of ISSUES) {
    if (seen.has(issue.id) || !GRADES[issue.grade]) throw new Error(`이슈 설정을 확인하세요: ${issue.id}`);
    seen.add(issue.id);
  }
}
