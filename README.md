# 🚒 현장 확인 점검 Map (field-check)

엑셀로 점검 대상을 올리면 카카오맵에 표시되고, 현장에서 완료·메모·사진을 기록하는 웹앱입니다.

- **배포 주소**: https://rcntiger.github.io/field-check/
- **형태**: `index.html` + `css/` + `js/` — 빌드 도구 없이 GitHub Pages에 그대로 배포
- **inspecMap과의 관계**: 같은 앱의 다른 갈래였고, 이 저장소(field-check)로 합칩니다. 같은 Supabase 표를 쓰므로 옮길 데이터는 없습니다.

## 주요 기능

- 계획(프로젝트) 카드: 생성·수정·삭제, 진행률, 보관 기한(D-day)
- 엑셀 업로드·컬럼 재설정(공통 `ExcelUtil.createReader`: 시트·헤더 선택, 컬럼 매핑, 행 필터), 원본 파일 보관·내려받기, 결과 엑셀 내보내기
- 지도: 그룹 색상 마커, 이름표, 클러스터, 그룹 필터, 정렬, 검색, 위성, 거리 재기, 로드뷰, 확대/축소, 현위치
- 정보카드: 완료 토글·점검일, 메모, 사진(자동 압축), 길찾기(출발지 최대 5개 + 직접 입력)
- 모바일: 지도/목록 전환, 사진 바텀시트

## 기술

| 구분 | 사용 |
|---|---|
| 지도 | Kakao Maps JS SDK (services, clusterer) — **REST 키는 쓰지 않음** |
| 백엔드 | Supabase (`inspections`, `inspection_items`, `inspection_done`, `inspection_memo`, `inspection_photos` / Storage `inspection-photos`, `inspection-files`) |
| 공통 모듈 | `https://rcntiger.github.io/common/` — logger.js, utils.js, supabase.js, excel.js, keys.js(`APP_KEYS`), kakao-geo.js(`KakaoGeo`) |

- 키·주소는 이 저장소에 두지 않고 `common/keys.js`에서 읽습니다 (`APP_KEYS.SUPABASE.inspec`, `APP_KEYS.KAKAO_JS_KEY`).
- common의 기존 `config.js`(ConfigUtil)·`kakao.js`(KakaoUtil)는 쓰지 않습니다 — `keys.js`·`kakao-geo.js`와 이름만 비슷한 별개 파일.
- `.github/workflows/keep-alive.yml`이 매일 Supabase를 깨웁니다 (저장소 Secrets: `SUPABASE_URL`, `SUPABASE_KEY`).

## 파일 구조

```
field-check/
├── index.html                마크업 + 버전(APP_VERSION) + 파일 목록(AppFiles)
├── css/                      아래 순서대로 불러옴
│   ├── variables.css    CSS 변수 (다크 테마 색상 · 공통 ExcelUtil 테마)
│   ├── common.css       초기화 · 버튼 · 입력 · 배지 · 토스트
│   ├── modal.css        모달 · 폼
│   ├── home.css         홈 화면 (계획 카드)
│   ├── map.css          지도 화면 배치 · 목록 · 모바일 · 툴바 · 검색 · 거리재기 · 로드뷰
│   ├── marker.css       마커 · 툴팁 · 정보카드(InfoWindow) · 카드 안 사진
│   └── overlay.css      화면 위에 뜨는 것: 사진 뷰어 · 진단 패널 · 진행 막대 · 사진 바텀시트
├── js/                       아래 순서대로 불러옴 (공통 모듈 다음)
│   ├── config.js        상수 — 키·주소는 common/keys.js(APP_KEYS)에서 읽음
│   ├── state.js         전역 상태 변수
│   ├── core.js          기본 도구 (esc · DOM 캐시 · 토스트 · 모달 · sbClient)
│   ├── project.js       홈 화면: 계획 목록 · 보관 기한 · 계획 생성/수정/삭제
│   ├── project-open.js  계획 열기/닫기 · 계획 데이터 불러오기
│   ├── filter.js        그룹 필터 · 정렬 · 필터 적용 · 통계
│   ├── map-core.js      카카오 지도 초기화 · 진단 · 항목 활성화/전체 보기
│   ├── marker.js        그룹 색상 · 마커 · 이름표 · 정보카드(팝업) 그리기
│   ├── record.js        완료 토글 · 점검일 · 메모
│   ├── photo.js         사진: 썸네일 · 압축 · 업로드 · 뷰어 · 바텀시트
│   ├── list.js          목록 그리기
│   ├── excel.js         엑셀 업로드 · 컬럼 재설정 · 결과 내보내기 · 원본 내려받기 (공통 ExcelUtil 사용)
│   ├── geocode.js       주소 → 좌표 (KakaoGeo)
│   ├── search.js        지도 검색
│   ├── station.js       출발지 관리 · 기본 출발지 좌표 조회
│   ├── navigation.js    길찾기
│   ├── map-tools.js     지도 도구: 확대/축소 · 위성 · 거리재기
│   ├── gps.js           현위치
│   ├── roadview.js      로드뷰
│   ├── mobile.js        모바일 지도/목록 전환
│   └── init.js          시작 (DOMContentLoaded) · 키보드
├── tools/bump-version.py     버전 한 번에 바꾸기 · 배포 전 확인
├── .github/workflows/keep-alive.yml
├── CHANGELOG.md
└── README.md
```

모든 js 파일은 일반 `<script>`(모듈 아님)라서 함수·변수는 전역에서 서로 보입니다.
파일을 새로 만들면 `index.html`의 `AppFiles.css` / `AppFiles.js` 목록에 이름을 적습니다 (적은 순서대로 불러옴).

## 버전 · 배포

버전은 **`index.html` 맨 위 `APP_VERSION` 한 곳**에서 관리합니다.

- 이 값이 css/·js/·공통 모듈 주소 뒤에 `?v=버전`으로 붙습니다 → 버전을 올리면 브라우저가 전부 새로 받습니다.
- css/·js/ 파일마다 첫머리에 같은 버전이 적혀 있습니다. 하나라도 다르거나 못 불러오면 화면 맨 위에 빨간 경고 띠(파일 이름 포함)가 뜨고, "파일 다시 받기"로 해당 파일만 새로 받습니다.

```
python tools/bump-version.py 2.0.1     # index.html + css/ + js/ 의 버전을 한 번에 바꿈
(CHANGELOG.md 작성)
python tools/bump-version.py --check   # 버전 불일치 · 빠진 파일 · 목록에 안 적은 파일 확인
(index.html, css/, js/ 를 함께 올리기)
```

- 공통 모듈(`common/`)만 고친 경우에도 이 앱의 버전을 올려야 사용자가 새 공통 파일을 받습니다. 공통 파일을 먼저 올리고 앱을 올립니다.
- `index.html` 자체는 GitHub Pages가 최대 10분쯤 캐시합니다. 배포 직후 옛 화면이면 새로고침(Ctrl+Shift+R).
- 홈 화면 맨 아래에 버전이 표시됩니다.
