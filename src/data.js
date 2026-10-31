// Content is the only input for the scene, cards, history and bestiary.
export const PRODUCT = { name: 'MDRM', current: '4.7.3', next: '4.7.4', releaseDate: '2026-11-14' };
// 세밀한 픽셀 표현: 화면 밀도를 반영하되 렌더 비용에 상한을 둡니다.
export const RENDERING = { maxSceneWidth: 1920, maxPixelRatio: 3, thumbnailSize: 384 };
export const GRADES = {
  low: { ko: '낮음', en: 'LOW', form: '꼬마 슬라임', color: '#4fd16b' },
  medium: { ko: '보통', en: 'MEDIUM', form: '슬라임', color: '#c79bff' },
  high: { ko: '높음', en: 'HIGH', form: '오거', color: '#f6a050' },
  critical: { ko: '치명', en: 'CRITICAL', form: '드래곤', color: '#ff8a86' },
};
// TODO: 임시 이슈 등급. 추후 제공되는 보안 요건 목록으로 교체합니다.
// MDRM은 Linux 커널 기반 제품이 아닙니다. 아래 명시된 이슈만 표시합니다.
export const ISSUES = [
  { id: 'php2shell', name: 'php2shell', grade: 'critical' },
  { id: 'javacert', name: 'Java 인증서', grade: 'high' },
  { id: 'nginx', name: 'nginx', grade: 'medium' },
];
export const RELEASES = [
  { ver: '4.7.4', state: 'planned', date: '2026-11-14', head: '수정 예정 3건', ids: ['php2shell', 'javacert', 'nginx'] },
  { ver: '4.7.3', state: 'current', head: '알려진 이슈 3건', ids: ['php2shell', 'javacert', 'nginx'] },
];
// TODO: 개발진 역할, 이름, 상태 문구는 연출을 위한 임시 설정입니다.
export const CREW = [
  { role: 'php2shell 패치', shirt: '#4a7bf0', screen: '#4fd16b', statuses: ['타이핑…', '코드 리뷰', '테스트 중', '커밋!'] },
  { role: 'nginx 패치', shirt: '#4fa86a', screen: '#4fb3ff', statuses: ['타이핑…', '설정 점검', '테스트 중', '커밋!'] },
  { role: 'Java 인증서 패치', shirt: '#a468ff', screen: '#f5c542', statuses: ['자료 조사', '타이핑…', '테스트 중', '커밋!'] },
  { role: '빌드·검수', shirt: '#e5873a', screen: '#f6a050', statuses: ['빌드 중', '확인 필요!', '검수 중', '빌드 통과'] },
  { role: '릴리스 관리', shirt: '#c8503a', walker: true, stops: ['일정 점검', '보드 업데이트'] },
  { role: '운영 지원', shirt: '#e8b84a', walker: true, stops: ['커피 타임', '커피 내리는 중', '잠깐 산책', '자리 복귀'] },
];
export const AS_OF_DATE = '2026-10-31';
export const TIME_ZONE = 'Asia/Seoul';

export function kstDate(date = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => p.find(x => x.type === type).value).join('-');
}
export function dDay(target = PRODUCT.releaseDate, now = new Date()) {
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
  return release.state === 'released' ? issues.filter(i => release.ids.includes(i.id)) : issues;
}
export function targetVersion(issue, releases = RELEASES) {
  return releases.find(r => r.state === 'planned' && r.ids.includes(issue.id))?.ver ?? releases.find(r => r.state === 'planned')?.ver ?? PRODUCT.next;
}
export function validateData() {
  const seen = new Set();
  for (const issue of ISSUES) {
    if (seen.has(issue.id) || !GRADES[issue.grade]) throw new Error(`이슈 설정을 확인하세요: ${issue.id}`);
    seen.add(issue.id);
  }
}
