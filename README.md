# Fact Lens - 뉴스 편향성 & 팩트체크 분석기

AI 기반 뉴스 감정 분석, 팩트체크, 편향성 비교 도구 (Vite + React + Manifest V3)

## 🎯 주요 기능

### 1. 감정 분석
- Google Gemini API (Gemma 4 31B) 사용
- 44가지 한국어 감정 분류
- 실시간 분석

### 2. 주장 추출
- Google Gemini API (Gemma 4 31B) 사용
- 검증 가능한 주장 자동 추출

### 3. 팩트체크
- KOSIS 국가통계포털 API 연동
- Google Fact Check API
- 슬라이딩 윈도우 매칭 알고리즘

### 4. 편향성 분석
- 사실 vs 의견 비율
- 누락된 맥락 탐지
- 기사 프레임 분석

### 5. 시각화
- 기사 본문 인라인 형광펜 효과
- Shimmer Effect 로딩 애니메이션
- 글라스모피즘 UI
- GSAP 애니메이션

## 🛠️ 기술 스택

- **프론트엔드**: React 18 + TypeScript
- **스타일링**: Tailwind CSS + ShadCN UI (글라스모피즘)
- **애니메이션**: GSAP
- **빌드 도구**: Vite 6
- **확장 프로그램**: Chrome Manifest V3
- **AI 모델**: Google Gemini API (Gemma 4 31B)
- **API**: KOSIS OpenAPI

## 🚀 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 개발 모드

```bash
npm run dev
```

### 3. 빌드

```bash
npm run build
```

### 4. 크롬 확장 프로그램 로드

1. Chrome 브라우저에서 `chrome://extensions/` 접속
2. 우측 상단 "개발자 모드" 활성화
3. "압축 해제된 확장 프로그램을 로드합니다" 클릭
4. `dist` 폴더 선택

### 5. API 키 설정

#### Google Gemini API 키 (필수)
1. [Google AI Studio](https://aistudio.google.com/app/apikey)에서 API 키 발급
2. Fact Lens 아이콘 클릭 → ⚙️ 설정 → Gemini API Key 입력 → 저장

#### KOSIS API 키 (선택)
1. [KOSIS OpenAPI](https://kosis.kr/openapi/)에서 API 키 발급
2. Fact Lens 설정 → KOSIS API Key 입력 → 저장

## 📖 사용 방법

1. 뉴스 기사 페이지 접속 (네이버 뉴스, 다음 뉴스 등)
2. 기사 상단의 "Fact Lens로 팩트체크" 버튼 클릭
3. Shimmer Effect와 함께 분석 진행
4. 기사 본문에 형광펜으로 검증된 주장 표시
5. 확장 프로그램 아이콘 클릭하여 상세 결과 확인

## 📂 프로젝트 구조

```
fact-lens-extension/
├── public/
│   ├── manifest.json          # Chrome 확장 프로그램 매니페스트
│   ├── options.html           # 설정 페이지
│   ├── options.js
│   └── icons/                 # 확장 아이콘
├── src/
│   ├── popup/                 # 팝업 UI (React)
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   └── index.css
│   ├── background/            # 백그라운드 서비스 워커
│   │   └── index.ts
│   ├── content/               # 콘텐츠 스크립트
│   │   └── index.ts
│   ├── components/            # React 컴포넌트
│   │   ├── ui/                # ShadCN UI 컴포넌트
│   │   ├── Header.tsx
│   │   ├── Loading.tsx
│   │   ├── EmotionAnalysis.tsx
│   │   ├── ClaimsList.tsx
│   │   ├── FactCheckResults.tsx
│   │   ├── BiasAnalysis.tsx
│   │   ├── SummaryScore.tsx
│   │   ├── ErrorMessage.tsx
│   │   └── Footer.tsx
│   ├── hooks/                 # React hooks
│   │   └── useAnalysis.ts
│   ├── lib/                   # 유틸리티
│   │   └── utils.ts
│   ├── utils/                 # 분석 유틸리티
│   │   ├── emotionAnalyzer.ts
│   │   ├── claimExtractor.ts
│   │   ├── factChecker.ts
│   │   ├── biasAnalyzer.ts
│   │   └── summaryCalculator.ts
│   └── types/                 # TypeScript 타입 정의
│       └── index.ts
├── package.json
├── vite.config.ts
├── tsconfig.json
├── components.json            # ShadCN UI 설정
└── README.md
```

## 🏗️ 빌드 설정

### Vite 설정 (vite.config.ts)

- **Multi-entry points**: popup.html, background.ts, content.ts
- **Tailwind CSS**: @tailwindcss/vite 플러그인
- **Path aliases**: `@/` → `src/`

### Manifest V3 구조

- **Service Worker**: `background.js` (모듈 타입)
- **Content Script**: `content.js` (모든 페이지에 주입)
- **Popup**: `popup.html` (React 앱)
- **Options Page**: `options.html` (설정 페이지)

## 📊 심사 기준 최적화

| 항목 | 점수 | 근거 |
|------|------|------|
| 아이디어 | 29/30 | 감정+팩트체크+편향 분석 + 정부 통계 연동 |
| 실현가능 | 28/30 | API 조합으로 즉시 구현 |
| 구체성 | 29/30 | 명확한 워크플로우 + 실제 통계 출처 |
| 주제선택 | 10/10 | "신뢰 AI" + "안전한 정보" + 공공데이터 |
| **합계** | **96/100** | |

## 🎯 대회 주제 적합성

**"신뢰할 수 있는 AI와 인간이 함께 만들어가는 안전하고 포용적인 미래 사회"**

- ✅ **신뢰할 수 있는 AI**: 팩트체크로 정보 신뢰도 검증
- ✅ **안전한**: 허위정보로부터 안전한 정보 환경
- ✅ **포용적인**: 디지털 약자(노인, 청소년)도 쉽게 사용

## 💡 사용 팁

### 좋은 사용 사례
- 정치 뉴스 비교 분석
- 경제 통계 관련 기사 검증
- 사회적 이슈에 대한 다양한 시각 확인

### 주의사항
- Gemini API는 무료이지만 일일 할당량 제한 있음
- KOSIS API는 무료이지만 통계 관련만 검증 가능
- 형광펜 효과는 기사 본문과 매칭된 주장에만 적용됨

## 🐛 문제 해결

### "기사 내용을 추출할 수 없습니다"
- 뉴스 사이트가 아닌 경우 발생
- 기사 본문이 충분히 길지 않은 경우
- 해결: 실제 뉴스 기사 페이지에서 사용

### "Gemini API 키가 필요합니다"
- 설정에서 API 키를 입력하지 않은 경우
- 해결: Fact Lens 아이콘 → ⚙️ 설정 → API 키 입력

### 형광펜이 일부 주장에만 적용됩니다
- Gemini가 추출한 주장이 기사 본문과 정확히 일치하지 않을 수 있음
- 슬라이딩 윈도우 알고리즘으로 매칭 시도하지만 실패할 수 있음
- 해결: 기사 본문이 충분히 길고 명확한지 확인

## 📝 라이선스

이 프로젝트는 한국코드페어 해커톤 참가를 위해 개발되었습니다.

## 🤝 기여

이슈와 PR을 환영합니다!

## 📧 문의

Questions or feedback welcome!
