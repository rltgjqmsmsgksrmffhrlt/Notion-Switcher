# Git 커밋 & Push 가이드

## 기본 흐름

```bash
# 1. 변경 사항 확인
git status

# 2. 파일 스테이징 (원하는 파일만)
git add 파일1 파일2 파일3

# 3. 커밋
git commit -m "커밋 메시지"

# 4. Push
git push origin main
```

---

## 자주 쓰는 명령어

### 상태 확인
```bash
git status              # 변경/추가/삭제된 파일 목록
git diff --stat         # 변경된 파일별 줄 수 요약
git diff 파일명          # 특정 파일의 변경 내용 상세
git log --oneline -5    # 최근 커밋 5개
```

### 스테이징 (커밋에 포함할 파일 선택)
```bash
git add 파일명                    # 특정 파일
git add dashboard.js popup.js    # 여러 파일
git add styles/                   # 폴더 전체
git add .                         # 모든 변경 (주의: .gitignore 제외)
```

### 스테이징 취소
```bash
git restore --staged 파일명       # 특정 파일 스테이징 취소
git restore --staged .            # 전체 스테이징 취소
```

### 커밋
```bash
git commit -m "메시지"                    # 한 줄 메시지
git commit -m "제목" -m "상세 설명"        # 제목 + 본문
```

### Push
```bash
git push origin main              # main 브랜치에 push
```

---

## 한 줄로 끝내기 (add + commit + push)

```bash
# 수정된 파일 전부 커밋+push (새 파일 제외)
git add -u && git commit -m "메시지" && git push origin main

# 새 파일 포함 전부 커밋+push
git add . && git commit -m "메시지" && git push origin main
```

---

## 커밋 메시지 컨벤션

```
동사: 설명

예시:
  Fix popup dark mode border
  Add folder drag-and-drop reorder
  Update settings panel layout
  Remove unused preview files
```

| 동사 | 용도 |
|------|------|
| Add | 새 기능/파일 추가 |
| Fix | 버그 수정 |
| Update | 기존 기능 개선 |
| Remove | 삭제 |
| Refactor | 동작 변경 없이 코드 정리 |

---

## 실수했을 때

### 커밋 메시지 잘못 썼을 때
```bash
git commit --amend -m "새 메시지"    # push 전에만!
```

### 파일 변경 되돌리기
```bash
git restore 파일명                   # 수정 전으로 복원
```

### push 전 커밋 취소 (변경은 유지)
```bash
git reset --soft HEAD~1
```

---

## 이 프로젝트 기준 예시

```bash
cd notion-switcher
git add popup.html popup.js settings.js styles/components.css
git commit -m "Update popup settings layout"
git push origin main
```

dist/ 폴더는 .gitignore에 있어서 자동 제외됨.
