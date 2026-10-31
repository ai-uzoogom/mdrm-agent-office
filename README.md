# MDRM AGENT OFFICE

MDRM 릴리스 준비를 작은 아이소메트릭 오피스와 자동 전투로 표현하는 정적 웹페이지입니다. 개발자 4명, 이동 직원 3명, 회의 담당자, MDRM 용사, AGENT와 이슈 몬스터가 자동으로 움직입니다. 캐릭터 클릭은 상태 확인이며 전투를 조작하지 않습니다.

## 온라인에서 보기

[GitHub Pages에서 MDRM AGENT OFFICE 열기](https://ai-uzoogom.github.io/mdrm-agent-office/) · [소스 저장소](https://github.com/ai-uzoogom/mdrm-agent-office)

설치 없이 데스크톱·모바일 브라우저에서 바로 볼 수 있습니다.

## 실행

Python 3만 있으면 빌드나 패키지 설치 없이 실행할 수 있습니다.

```sh
cd mdrm-agent-office
python3 -m http.server 4173 --bind 127.0.0.1
```

브라우저에서 **http://127.0.0.1:4173/** 을 엽니다. Node.js가 있으면 `npm start`도 같은 서버를 실행합니다. ES 모듈과 GLB 로딩을 위해 `file://` 대신 HTTP로 열어야 합니다.

Three.js, GLB, PNG 팔레트와 폰트를 모두 포함했습니다. 실행 중 CDN이나 외부 API 연결이 필요하지 않습니다. 정적 호스팅 시 `index.html`, `styles.css`, `src/`, `vendor/`, `assets/`를 같은 상대 경로로 복사하면 됩니다.

## 내용 변경

설정의 단일 진입점은 [src/data.js](src/data.js)입니다.

| 상수 | 변경 내용 |
| --- | --- |
| `PRODUCT` | 제품명, 현재·다음 버전, 발행 예정일 |
| `RENDERING` | 장면 해상도 상한, 화면 픽셀 밀도, 썸네일 해상도 |
| `GRADES` | 등급명, 형태명, 색상 |
| `ISSUES` | 이슈 추가·제거·이름·등급 |
| `RELEASES` | 버전 이력, 상태, 날짜, 포함된 이슈 ID |
| `CREW` | 직원 역할, 셔츠·화면 색상, 상태·정차 문구 |
| `AS_OF_DATE` | 푸터의 정보 기준일 |

`ISSUES`만 변경한 뒤 새로고침하면 장면의 몬스터, 사이드 패널, 작업 수, 이력, 도감에 함께 반영됩니다. 사용 가능한 등급은 `low`, `medium`, `high`, `critical`이며 ID는 중복 없이 지정합니다. 현재·예정 이력은 새 이슈를 자동으로 포함하고 건수도 다시 계산합니다.

`RELEASES` 항목의 `state`를 `released`로 변경하면 **그 항목의 `ids`에 포함된 이슈**가 퇴치 완료로 회색 처리되고 서버실에서 사라집니다. 새로 추가한 이슈를 해당 릴리스에서 해결할 때는 `ids`에도 추가합니다. 완료 이력은 명시된 ID만 유지합니다. 제품의 현재 버전 표시는 `PRODUCT.current`로 관리합니다.

날짜와 활동 로그는 모두 `Asia/Seoul` 기준입니다. D-day는 한국의 날짜 경계로 계산하며 발행 당일은 `D-DAY`, 이후는 `D+n`입니다. MDRM을 Linux 커널 기반 제품으로 설명하지 않으며, Linux CVE나 임의의 보안 이슈를 추가하지 않았습니다.

## 화면과 동작

- Three.js **0.160.0**을 로컬 고정하고 `GLTFLoader`, `SkeletonUtils.clone`, `AnimationMixer`를 사용합니다.
- 60 × 44 월드의 열린 디오라마에 두 벽과 낮은 칸막이, 개발실·회의실·서버실을 배치했습니다.
- 정사영 카메라의 방위각은 45°, 내려다보는 각도는 약 35.264°입니다.
- 모바일 장면에서 두 손가락을 벌리거나 오므리면 손가락 사이 지점을 기준으로 100~300% 확대·축소합니다. 두 손가락 이동도 지원하고, 확대 후에는 한 손가락으로 드래그할 수 있습니다. 100%에서 한 손가락 세로 이동은 페이지 스크롤을 유지합니다.
- 장면 오른쪽 아래의 `−`·`+` 버튼으로 100~300% 확대·축소하고 `전체`로 초기 화면에 복귀합니다. 확대 후에는 드래그·터치 드래그·방향 버튼으로 이동합니다. 장면에 초점을 두면 `+`·`−`·방향키·`0`(전체 보기)을 사용할 수 있고, Ctrl/Command+휠은 포인터 위치를 기준으로 확대·축소합니다. 일반 휠은 페이지를 스크롤합니다.
- 화면 크기·픽셀 밀도·앱 확대·브라우저 핀치 확대를 반영해 렌더 해상도를 조정합니다. 상한은 가로 3840px·800만 픽셀·밀도 6배입니다. 1280px / DPR 2 기본 화면은 가로 2628px이며 확대 시 더 높아집니다. 기존 `NearestFilter`와 픽셀 스타일을 유지합니다.
- 안티앨리어싱은 꺼져 있습니다. DirectionalLight 1개, HemisphereLight 1개, `BasicShadowMap`을 사용합니다.
- 말풍선·이름·등급·벽 라벨·릴리스 보드 제목은 HTML입니다. 벽 표지판과 보드 제목은 해당 3D 객체에 연결된 면의 꼭짓점을 투영해 상자 전체의 위치·기울기·크기를 맞춥니다. 말풍선은 가까운 빈 위치를 찾고 벽 표지판과 보드 제목 영역도 피해 배치합니다.
- 직원은 모델의 실제 `sit`, `idle`, `walk` 애니메이션을 사용합니다. 보행 속도는 약 2.4 units/s입니다.
- 회의실 의자는 앉는 쪽이 테이블을 향하고 등받이는 바깥쪽을 향하도록 배치합니다.
- 책상의 열린 면을 직원 쪽으로 향하게 하고 앉은 체형에 맞춰 높이를 조정했습니다. 몸통은 책상 앞 경계 밖에 유지하고 무릎은 열린 아래 공간에 둡니다.
- 앉은 직원과 회의 담당자는 실제 손 위치·팔 길이·키보드 높이를 기준으로 양손을 번갈아 움직입니다. 타이핑 외의 점검·빌드 상태에서는 속도를 낮춥니다. 원본 여성 모델의 손 도구는 해당 사무실 인스턴스에서만 제거하고 의상·손과 원본 GLB는 유지합니다.
- 모니터 4대와 노트북 화면은 원본 모델의 LCD 면에 붙어 실제 기울기와 크기를 따릅니다. 코드 입력·커서·테스트 출력·진행 막대·일정 목록을 상태에 맞게 갱신하며, 숨긴 탭과 모션 줄이기에서는 손과 화면 모두 멈춥니다.
- 일정 독려 담당은 Mini Characters의 여성 `character-female-e`입니다. 개발실의 중앙 통로를 오가며 확성기를 들고 금색 말풍선과 소리 파장으로 진행 상황을 확인합니다. 말할 때는 입 위치를 기준으로 어깨와 확성기 각도를 계산하여 좁은 뒤쪽이 입 앞에 오도록 합니다. 손잡이 연결과 원래 팔 길이를 유지합니다. “패치 진행, 어디까지 왔죠?”, “커밋 준비됐나요?”, “테스트 끝나면 바로 공유!”를 순환하며, 정차 문구는 `CREW`에서 바꿉니다.
- 용사의 투구는 원본 머리 메시를 가려 머리카락이 튀어나오지 않게 했습니다. 검·방패는 스킨의 손 위치에 연결하고 공격·방어 시 팔을 따라 움직입니다. 장비는 대기 자세에서도 바닥 위에 유지됩니다.
- 브레스 방어 시 방패를 왼손에 둔 채 왼팔을 앞으로 내밉니다. 방패의 아래 기울기는 약 7도로 제한하고 왼팔을 더 전방으로 내밀어, 방패를 세운 채 투구와 간격을 확보합니다. 불꽃의 도착점은 방패 앞면을 따라갑니다.
- 낮음·보통 등급은 Graveyard Kit의 흰 유령 모델을 사용합니다. 낮음은 작은 `꼬마 유령`, 보통은 `유령`이며 도감에서도 크기를 구분합니다. 원본의 `idle`·`walk`·`attack-melee-right` 애니메이션과 부유 이동을 사용하고, 장면·패널·이력·도감·활동 로그에 같은 이름과 모델을 반영합니다.
- 근접 전투, 검 휘두르기, 넉백, 스파크, 드래곤 브레스와 방패 동작은 하나의 프레임 시간 기반 상태 머신으로 진행합니다. 별도의 전투 타이머가 백그라운드에서 계속 실행되지 않습니다.
- 숨김 상태에서는 `requestAnimationFrame`을 취소하고 시뮬레이션 시간이 멈춥니다. 복귀 시 누적된 시간을 한꺼번에 진행하지 않습니다.
- `prefers-reduced-motion: reduce`에서는 초기 정지 화면과 고정 상태를 표시합니다. 창 크기 변경·상태 조회·화면 확대 및 이동에 필요한 재렌더만 수행합니다.
- 활동 로그는 최신 7개를 유지하고 새 항목만 `aria-live="polite"`로 알립니다. 상태 버튼으로 키보드 접근도 가능합니다.
- 탭은 방향키·Home·End를 지원합니다. 썸네일은 동일한 정사영·조명 팔레트로 768 × 768 오프스크린 렌더한 실제 3D 정지 이미지입니다.

## 채택한 디자인

사용자 지정 RPG 시안을 유지합니다. 어두운 페이지 위에 파란 RPG 창, 3px 크림 테두리, 픽셀 컷 모서리를 적용했습니다. 금색은 다음 릴리스와 용사, 청록은 방어·펫, 등급별 색은 몬스터에 일관되게 사용합니다.

모든 UI 토큰은 [styles.css](styles.css)의 `:root` 한 곳에서 관리합니다. 영문 제목은 `Press Start 2P`, 한글은 `Nanum Gothic Coding`입니다. 둘 다 로컬 폰트입니다. 본문은 촘촘한 작업 화면을 유지하면서 장면이 가장 넓은 영역을 차지합니다.

900px 이하에서는 장면과 패널을 한 열로 배치합니다. 작은 화면에서도 직원 역할·방 이름·몬스터 등급·보드 글자를 표시합니다. 말풍선은 이름표와 방 표지판 영역을 피해 배치합니다. 모바일 좌우 여백은 16px입니다. 단일 다크 테마입니다.

## 에셋과 라이선스

| 출처 | 실제 사용 |
| --- | --- |
| [Kenney Mini Characters](https://kenney.nl/assets/mini-characters) · CC0 | 7개 캐릭터 GLB, `idle`·`walk`·`sit` 등 32개 애니메이션 확인 |
| [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) · CC0 | 책상·의자·모니터·키보드·마우스·책장·책·커피머신·캐비닛·화분·테이블·노트북·러그 등 15개 GLB |
| [Kenney Mini Dungeon](https://kenney.nl/assets/mini-dungeon) · CC0 | 인간·오크·검·방패·통·돌 6개 GLB |
| [Kenney Graveyard Kit 5.0](https://kenney.nl/assets/graveyard-kit) · CC0 | `character-ghost.glb`와 원본 팔레트 텍스처, 대기·이동·공격 등 32개 애니메이션 확인 |
| [Three.js r160](https://github.com/mrdoob/three.js/tree/r160) · MIT | 렌더러와 로더·유틸리티, [LICENSE](vendor/three/LICENSE) 동봉 |
| [Google Fonts](https://github.com/google/fonts) · SIL OFL | 지정한 두 폰트와 라이선스를 `assets/fonts/`에 동봉 |

처음 제시된 `mini-characters-1` 주소 대신 공식 `mini-characters` 팩을 사용했습니다. 실제 포함된 파일과 SHA-256은 [assets/kenney/manifest.json](assets/kenney/manifest.json)에 기록했습니다. 캐릭터·던전 GLB가 참조하는 `Textures/colormap.png`도 포함되어 있습니다.

**직접 만든 도형:** 드래곤, AGENT 로봇, 서버 랙, 화이트보드, 방 구조, 화면 면, LED, 균열, 불꽃·스파크, 일정 독려 담당의 확성기·소리 파장은 Three.js 기본 도형으로 제작했습니다. 오거는 Mini Dungeon의 **오크를 확대하고 주황색 의상·복셀 몽둥이를 추가한 변형**입니다. 용사는 Mini Dungeon 인간에 은색 투구, 붉은 깃털, 파란 갑옷을 추가하고 실제 Kenney 검·방패를 사용합니다. 유령과 직원은 Kenney 원본 모델이며, 기존 직원 셔츠만 인스턴스별 팔레트 복제로 지정 색을 적용합니다. 새 일정 독려 담당은 원본 의상을 유지합니다. 화면 내용은 자체 CanvasTexture로 그립니다. 원본 GLB는 변경하지 않았습니다.

## 검증

실행 중인 로컬 서버에서 다음 명령을 사용합니다. Node.js 22 이상과 개발 의존성은 테스트에만 필요합니다.

```sh
npm ci --ignore-scripts
npm test
npm run test:browser
npm run test:view
npm run test:equipment
npm run test:workstations
npm run test:visibility
```

브라우저 테스트는 기본적으로 macOS의 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`을 사용합니다. 다른 환경에서는 `CHROME_PATH`를 지정합니다. 서버 주소는 `OFFICE_URL`로 변경할 수 있습니다. `test:view`는 확대·이동·리셋, 확대 상태의 캐릭터 클릭과 글자 정렬, 키보드·휠·터치 모사, 작은 화면 배치를 검사합니다. `test:equipment`는 60개 애니메이션 프레임의 손·장비 결합, 투구, 장비의 바닥 간섭, 공격·방어 자세와 새 직원의 소품을 검사합니다. `test:workstations`는 몸통 경계·무릎 공간과 모바일 225% 확대, 500개 실제 손 메시 표본의 키보드 간섭·움직임·팔 길이와 5개 화면의 원본 LCD 밀착·픽셀 변화를 검사합니다. `test:visibility`는 테스트 전용 창에서 세 직원의 전체 보행 경로, 독려 문구·소리 효과와 정지·복귀 조건을 검사합니다.

[데스크톱 미리보기](docs/previews/desktop.png) · [모바일 미리보기](docs/previews/mobile.png) · [도감 미리보기](docs/previews/bestiary.png) · [영웅 장비·일정 독려 담당](docs/previews/equipment.png) · [타이핑·화면 확대](docs/previews/workstations.png)

최종 환경, 실제 측정치, 확인 범위는 [docs/validation.md](docs/validation.md)를 참고하세요. 테스트 결과와 스크린샷은 `test-results/`에 생성됩니다.

## TODO — 제공받을 실제 정보

- 이슈 등급 `php2shell=치명`, `Java 인증서=높음`, `nginx=보통`은 임시입니다. 추후 보안 요건 목록으로 교체합니다.
- 개발진 역할·이름·상태 문구는 임시 연출 설정입니다.
- 활동 로그, 전투, 서버 정상 문구는 실제 MDRM 서비스와 연결된 운영 상태가 아닙니다. 페이지에 연출 표기와 정보 기준일을 표시합니다.


## GitHub Pages 배포

`.github/workflows/pages.yml`은 `main` 브랜치에 push하거나 Actions에서 수동 실행하면 정적 페이지를 배포합니다. 저장소의 **Settings → Pages → Source**는 **GitHub Actions**를 선택합니다.

```sh
npm run prepare:pages
```

생성된 `_site/`에는 `index.html`, `styles.css`, `src/`, `assets/`, `vendor/`와 `.nojekyll`만 포함됩니다. 문서·테스트·개발 의존성은 웹사이트 배포 파일에 포함하지 않습니다. 모든 런타임 경로가 상대 경로이므로 `https://<owner>.github.io/mdrm-agent-office/` 형태의 프로젝트 사이트에서도 동작합니다.

워크플로는 GitHub의 공식 Pages 액션을 커밋 SHA로 고정하며, 별도 배포 비밀번호나 개인 토큰 없이 저장소의 `GITHUB_TOKEN`과 OIDC를 사용합니다. 이 프로젝트의 소스 저장소와 GitHub Pages 사이트는 공개 상태입니다. `main`에 변경을 push하면 자동으로 사이트가 갱신됩니다.

배포 시 진입 스크립트·모든 로컬 모듈·CSS에 같은 콘텐츠 버전을 붙여, 새 페이지에서 이전 캐시의 의자 배치나 설정을 재사용하지 않게 합니다. 이 처리는 `_site/`에만 적용합니다.
