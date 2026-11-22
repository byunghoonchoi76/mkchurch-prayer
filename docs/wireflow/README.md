# 와이어플로우 리뷰 (wireflow-review)

앱의 **화면 구조와 사용자 흐름**을 디자인 전에 점검하기 위한 와이어플로우입니다.
(스킬: https://github.com/JeongK7998/wireflow-review)

## 파일
- **`mkchurch-wireflow.html`** — 브라우저에서 여는 와이어플로우 뷰어 (클릭해서 흐름 확인)
- **`mkchurch.flow.json`** — 화면·흐름 정의 소스 (수정·재생성용)

## 보는 법
1. `mkchurch-wireflow.html` 을 브라우저에서 엽니다.
2. 화면을 클릭하면 확대되고, **⋯ 메뉴**에서 강조할 경로(시나리오)·기기를 바꿀 수 있습니다.
3. **흐름 검증**에서 시나리오 통과 여부를 확인합니다.
4. 고칠 점이 있으면 해당 화면에서 **수정 요청을 복사**해 AI 채팅에 붙여넣습니다.

## 담긴 흐름 (15화면 · 4단계)
- 01 시작하기: 시작 화면 · 로그인 · 로그인 실패 · 회원가입 · 확인 메일
- 02 기도하기: 기도하기(홈) · 기도 중 · 기록 완료 · 기도 기록
- 03 기도제목: 기도제목 허브 · 중보기도제목 · 기도제목 작성
- 04 설정·계정: 설정 · 계정 삭제 · 삭제 완료

검증 시나리오(5): 가입하고 시작 · 기도하고 기록 · 중보기도제목 나눔 · 로그인 실패 복구 · 계정 삭제

## 재생성 방법
스킬 저장소를 받은 뒤:
```bash
SKILL=<wireflow-review>/.agents/skills/wireflow-review
node "$SKILL/scripts/wireflow.cjs" check docs/wireflow/mkchurch.flow.json
node "$SKILL/scripts/wireflow.cjs" build docs/wireflow/mkchurch.flow.json docs/wireflow/mkchurch-wireflow.html
```
