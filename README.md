# Notion Workspace Switcher

Notion 워크스페이스를 빠르게 전환할 수 있는 Chrome 확장 프로그램.

---

## 주요 기능

### 워크스페이스 관리
- **추가**: 이름, URL, 이모지를 입력하여 워크스페이스 등록
- **편집**: 등록된 워크스페이스의 이름, URL, 이모지, 폴더를 수정
- **삭제**: 호버 시 나타나는 ✕ 버튼으로 삭제
- **검색**: 이름, URL, 이모지로 실시간 필터링

### 폴더 (주제별 그룹)
- **폴더 생성**: 대시보드 상단 `📁 폴더` 버튼 또는 팝업 폼의 "＋ 새 폴더..." 옵션
- **폴더 편집/삭제**: 대시보드에서 폴더 헤더 호버 시 편집(✎)/삭제(✕) 버튼
- **폴더 배정**: 워크스페이스 추가/편집 시 폴더 선택 드롭다운
- **드래그 앤 드롭**: 대시보드에서 카드를 폴더 간 드래그하여 이동
- 폴더 삭제 시 내부 워크스페이스는 "미분류"로 자동 이동

### 빠른 전환
- 숫자 키 `1`~`9`로 즉시 이동
- `Enter`로 첫 번째 검색 결과 열기
- 기존 Notion 탭 감지 및 자동 전환 (팝업)
- `Shift+클릭`으로 새 탭에서 열기 (팝업)

### 설정
- 테마: 시스템 / 라이트 / 다크 선택
- 대시보드와 팝업에 동일한 테마 적용
- 내부 단축키 편집 및 확장 프로그램 내부 충돌 검사
- 전역 단축키는 Chrome 설정(`chrome://extensions/shortcuts`)으로 연결

---

## UI 구성

### 팝업 (Alt+N)
- 320px 컴팩트 팝업
- 검색 + 워크스페이스 리스트
- 호버 시 편집(✎), 새 탭(↗), 삭제(✕) 버튼
- 하단 폼에서 워크스페이스 추가/편집 + 폴더 선택/생성
- 폴더가 있으면 그룹별 섹션 헤더 표시

### 대시보드 (Alt+Shift+N)
- 전체 페이지 그리드 레이아웃
- 카드 기반 워크스페이스 표시
- 폴더별 섹션으로 그룹화
- 모달 폼으로 워크스페이스/폴더 추가 및 편집
- 드래그 앤 드롭으로 폴더 간 이동

---

## 단축키

| 단축키 | 동작 | 위치 |
|--------|------|------|
| `Alt+N` 기본값 | 팝업 열기 | 전역, Chrome 설정에서 변경 |
| `Alt+Shift+N` 기본값 | 대시보드 열기 | 전역, Chrome 설정에서 변경 |
| `1`~`9` | 해당 번호 워크스페이스로 이동 | 팝업, 대시보드 |
| `Enter` | 첫 번째 결과 열기 | 검색 시 |
| `Escape` | 검색 초기화 / 닫기 | 팝업, 대시보드 |
| `/` 기본값 | 검색창 포커스 | 대시보드, 설정에서 변경 |
| `d` 기본값 | 대시보드 열기 | 팝업, 설정에서 변경 |

Chrome 확장 프로그램의 전역 단축키는 브라우저가 직접 관리하므로 확장 프로그램 화면 안에서 바로 변경할 수 없습니다. 설정 패널은 현재 Chrome에 등록된 전역 단축키를 표시하고, 변경이 필요하면 Chrome 단축키 설정 화면을 엽니다.

---

## 데이터 구조

`chrome.storage.sync`에 저장.

```
workspaces: [
  {
    id: string,        // 고유 ID (timestamp)
    name: string,      // 워크스페이스 이름
    url: string,       // Notion URL
    emoji: string|null,  // 이모지 아이콘
    folderId: string|null, // 소속 폴더 ID (없으면 미분류)
    colorId: number|null // 아이콘 타일 색상 (없으면 자동)
  }
]

folders: [
  {
    id: string,        // 고유 ID (timestamp)
    name: string,      // 폴더 이름
    emoji: string|null  // 이모지 아이콘
  }
]
```

---

## 파일 구조

```
notion-switcher/
├── manifest.json      # Chrome Extension Manifest V3
├── background.js      # 서비스 워커 (대시보드 탭 관리)
├── popup.html         # 팝업 UI
├── popup.js           # 팝업 로직
├── dashboard.html     # 대시보드 UI
├── dashboard.js       # 대시보드 로직
├── ui.js              # 테마, 컬러, 커스텀 셀렉트 공용 헬퍼
├── settings.js        # 테마/단축키 설정 패널
├── styles/
│   ├── tokens.css     # 디자인 토큰
│   └── components.css # 공용 컴포넌트 스타일
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── preview/
│   ├── chrome-mock.js
│   ├── dashboard-preview.html
│   └── popup-preview.html
├── uploads/           # 참고 이미지 원본
└── README.md
```

---

## 설치 방법

1. `chrome://extensions` 접속
2. "개발자 모드" 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. `notion-switcher` 폴더 선택

---

## 권한

- `storage`: 워크스페이스/폴더 데이터 저장
- `tabs`: 탭 감지 및 전환
