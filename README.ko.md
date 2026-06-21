# Notion Switcher

한국어 | [English](README.md)

> Notion 워크스페이스를 클릭 한 번, 단축키 한 번으로 빠르게 전환하세요.

Notion Switcher는 Notion 워크스페이스 간 전환을 2초 이내로 줄여주는 Chrome 확장 프로그램입니다. 사이드바를 뒤질 필요 없이 `Alt+N`만 누르면 됩니다.

---

## 주요 기능

### 워크스페이스 관리
- **추가 / 편집 / 삭제** — 이름, URL, 이모지, 색상 지정
- **폴더** — 워크스페이스를 주제별로 그룹화
- **검색** — 이름, URL, 이모지로 실시간 필터링
- **드래그 & 드롭** — 순서 변경 및 폴더 간 이동

### 빠른 전환
- 숫자 `1`~`9`로 즉시 이동
- `Enter`로 첫 번째 검색 결과 열기
- `Shift+클릭`으로 새 탭에서 열기

### 두 가지 뷰
- **팝업** (`Alt+N`) — 320px 컴팩트 패널로 빠른 전환
- **대시보드** (`Alt+Shift+N`) — 전체 페이지 그리드로 워크스페이스 관리

### 설정
- **테마** — 시스템 / 라이트 / 다크
- **단축키 커스텀** — 앱 내 단축키 변경 + 충돌 감지
- **피드백** — 설정 패널 내 Tally 폼으로 의견 전달

### 다국어 지원
- 브라우저 언어 설정에 따라 **한국어 / 영어** 자동 전환
- Chrome i18n API 기반

---

## 단축키

| 단축키 | 동작 | 범위 |
|--------|------|------|
| `Alt+N` | 팝업 열기 | 전역 |
| `Alt+Shift+N` | 대시보드 열기 | 전역 |
| `1`~`9` | 해당 번호 워크스페이스로 이동 | 팝업 / 대시보드 |
| `Enter` | 첫 번째 결과 열기 | 검색 시 |
| `Escape` | 검색 초기화 / 닫기 | 팝업 / 대시보드 |
| `/` | 검색창 포커스 | 대시보드 |
| `D` | 대시보드 열기 | 팝업 (검색창 비어있을 때) |

---

## 설치

### 소스에서 설치 (개발자 모드)
1. `chrome://extensions` 접속
2. **개발자 모드** 활성화
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. `notion-switcher` 폴더 선택

### Chrome Web Store
준비 중

---

## 기술 스택

| | |
|---|---|
| 플랫폼 | Chrome Extension (Manifest V3) |
| 언어 | Vanilla JavaScript |
| 스토리지 | chrome.storage.sync (기기 간 자동 동기화) |
| 스타일 | CSS Custom Properties |
| 다국어 | Chrome i18n API (`_locales/`) |
| 빌드 | 없음 (번들러 미사용) |

---

## 파일 구조

```
notion-switcher/
├── manifest.json          # 확장 설정
├── background.js          # Service Worker
├── popup.html / popup.js  # 팝업 UI
├── dashboard.html / dashboard.js  # 대시보드 UI
├── ui.js                  # 공유 UI 헬퍼
├── settings.js            # 설정 패널
├── i18n.js                # 다국어 헬퍼
├── theme-init.js          # 테마 조기 적용
├── styles/
│   ├── tokens.css         # 디자인 토큰
│   └── components.css     # 공유 컴포넌트 스타일
├── icons/                 # 확장 아이콘 + QR 이미지
├── _locales/
│   ├── ko/messages.json   # 한국어
│   └── en/messages.json   # 영어
└── PRD.md                 # 제품 요구사항 문서
```

---

## 권한

| 권한 | 용도 |
|------|------|
| `storage` | 워크스페이스, 폴더, 설정 저장 (기기 간 동기화) |
| `tabs` | 현재 탭 URL 확인 + 새 탭에서 워크스페이스 열기 |

---

## 피드백

버그 제보, 기능 제안: [피드백 폼](https://tally.so/r/9qxE61)

---

## 라이선스

MIT
