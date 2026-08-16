# Fact Lens

뉴스 기사에서 검증 가능한 주장을 찾아 Google Search 근거와 함께 보여 주는 Chrome 확장 프로그램입니다. Vite, React, TypeScript, Manifest V3로 만들었습니다.

> [!WARNING]
> 현재 버전은 알파 시제품입니다. 모델의 판정과 인용은 참고 자료이며, 의료·법률·금융·선거처럼 중요한 판단에 그대로 사용하면 안 됩니다. 주장별 검색 결과와 인용 URL을 엄격하게 1:1로 묶는 작업은 아직 진행 중입니다.

## 현재 제공하는 기능

- 뉴스 기사 본문 추출
- Gemini 3.5 Flash-Lite를 이용한 감정·주장·프레임 통합 분석
- 기사당 최대 5개 주장 추출
- Gemini Interactions API의 built-in Google Search를 이용한 팩트체크
- 검색 호출 여부와 Interactions 응답 상태 검사
- 기사 문장 인라인 하이라이트와 설명 tooltip
- 팝업에서 판정 상태·설명·인용 링크 표시
- 분석 진행·완료·실패 상태 저장
- Vitest 단위·통합 테스트와 실제 MV3 E2E 스크립트

## 확인된 제한

- Google Search 할당량을 넘으면 HTTP 429로 팩트체크가 실패할 수 있습니다.
- 현재 팩트체크 요청은 여러 주장을 한 번에 처리합니다. 관련 인용을 찾지 못하면 주장별 근거가 정확하게 결속되지 않을 수 있습니다.
- 분석 결과는 `lastAnalysisResults` 단일 키에 저장되어 여러 탭의 결과를 구분하지 못합니다.
- content script는 현재 `<all_urls>`에 등록되어 있습니다.
- Gemini API 키는 `chrome.storage.sync`에 저장됩니다.
- tooltip 일부는 모델 출력을 HTML 문자열로 구성하므로 안전한 DOM 렌더링으로 교체할 예정입니다.
- 표시되는 종합 점수는 사실 확률이 아닙니다. 현재 계산식을 제품 지표로 사용하지 마세요.

이 제한은 `docs`의 제출 문서 형식 검증과 별개입니다. 테스트와 빌드가 통과해도 팩트체크 정확도나 인용 적합성이 자동으로 입증되지는 않습니다.

## 기술 구성

- React 18
- TypeScript 5
- Vite 6
- Tailwind CSS 4
- ShadCN UI
- GSAP
- Chrome Manifest V3
- Gemini Interactions API
- `gemini-3.5-flash-lite`
- built-in `google_search`

## 설치

```bash
npm install
npm run build
```

Chrome에서 다음 순서로 로드합니다.

1. `chrome://extensions/`를 엽니다.
2. 개발자 모드를 켭니다.
3. `압축 해제된 확장 프로그램을 로드합니다`를 누릅니다.
4. 생성된 `dist` 폴더를 선택합니다.

## API 키 설정

1. [Google AI Studio](https://aistudio.google.com/app/apikey)에서 Gemini API 키를 발급합니다.
2. 확장 프로그램의 설정 페이지를 엽니다.
3. 키를 입력하고 저장합니다.

API 키를 소스 코드나 Git 커밋에 넣지 마세요. 분석 버튼을 누르면 기사 본문 일부가 Gemini API로 전송됩니다.

## 사용 방법

1. 뉴스 기사 페이지를 엽니다.
2. 페이지에 표시된 `Fact Lens로 팩트체크` 버튼을 누릅니다.
3. 분석이 끝나면 기사 본문에서 하이라이트와 설명을 확인합니다.
4. 확장 프로그램 아이콘을 눌러 판정과 인용 링크를 확인합니다.
5. 인용 링크의 원문을 직접 읽고 최종 판단합니다.

## 검증

```bash
npm test
npm run build
```

실제 확장 프로그램 경로는 다음 스크립트로 검사합니다.

```bash
npm run test:e2e
```

E2E는 content script, background service worker, Gemini 호출, storage, 하이라이트, popup 연결을 확인합니다. 실제 Google Search 호출은 계정 할당량과 네트워크 상태의 영향을 받습니다.

2026년 8월 16일 기준 로컬 검증 결과는 다음과 같습니다.

- Vitest: 5개 파일, 9개 테스트 통과
- TypeScript와 Vite production build 통과
- 실제 Search E2E 통과
  - 기사 분석과 Google Search 호출 2건 완료
  - citation URL이 반환되지 않은 두 주장은 모두 `unverified`로 저장
  - URL 없는 `verified` 또는 `false` 판정 0건
  - storage, 하이라이트 2건, popup 렌더링 확인

## 처리 흐름

```text
content script
  → background service worker
  → Gemini 기사 분석
  → Gemini + Google Search 팩트체크
  → chrome.storage.local
  → 기사 하이라이트·tooltip
  → popup 결과·인용 링크
```

## 프로젝트 구조

```text
public/
  manifest.json
  options.html
  options.js
src/
  background/index.ts
  content/index.ts
  popup/
    App.tsx
    CitationLink.tsx
  utils/
    analysisPipeline.ts
    articleAnalyzer.ts
    factChecker.ts
    geminiInteractions.ts
    models.ts
    summaryCalculator.ts
  types/index.ts
scripts/
  e2e-extension.mjs
tests/
  fixtures/article.html
```

## 다음 우선순위

1. 주장 하나당 검색·검색 결과·citation을 별도 계약으로 묶습니다.
2. citation이 없으면 `verified`나 `false`가 아니라 `unverified`로 처리합니다.
3. 무관한 첫 번째 citation을 재사용하는 fallback을 제거합니다.
4. 결과를 URL과 tab ID별로 저장합니다.
5. API 키 저장 위치, 외부 전송 동의, content-script 권한을 줄입니다.
6. tooltip을 `textContent` 기반 DOM 렌더링으로 바꿉니다.
7. HTTP 429 재시도, 지수 backoff, cache, 부분 결과 제공을 추가합니다.
8. 실제 기사 표본으로 판정 정확도와 citation 적합성을 측정합니다.

## 라이선스

한국코드페어 해커톤 출품을 위해 개발한 프로젝트입니다.
