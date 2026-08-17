# Study-Lens Kill Test 평가 계약 (Evaluation Contract)

> 버전: 1.0  
> 작성일: 2026-08-16  
> 대상 데이터셋: `copenlu/scientific-exaggeration-detection` (test split)  
> 표본: `sealed_pairs.json` 내 5개 fixture (SED-1 ~ SED-5)

---

## 1. 라벨 운영 정의 (Operational Definitions)

본 계약은 과학 논문 abstract의 conclusion 문장과 해당 보도문(press release)의 conclusion 문장 사이에서 **주장 강도(claim strength)의 방향적 변화**를 판정합니다.

### 1.1 주장 강도 척도 (Strength Scale, S)

| 등급 | 명칭 | 정의 |
|------|------|------|
| S0 | 관계 없음 진술 | 변수 간 연관성이 없거나 부정함을 명시 |
| S1 | 상관 진술 | 변수 간 통계적 연관성만 언급. 인과 방향·메커니즘 불명시 |
| S2 | 조건부 인과 진술 | 인과 가능성을 언급하되 조건·한정사(may, could, might, potentially) 포함 |
| S3 | 인과 진술 | 인과 관계를 확정적 어조로 진술. 한정사 없이 단정 |

### 1.2 최종 라벨 정의

| 라벨 | 운영 정의 |
|------|-----------|
| `same` | 보도문의 주장 강도가 논문의 주장 강도와 **동일 등급(S_abstract == S_press)**이거나, 의미적 동등성으로 판단될 때. 정보 손실·추가 없이 핵심 주장이 보존됨. |
| `exaggerates` | 보도문의 주장 강도가 논문보다 **1단계 이상 상승(S_press > S_abstract)**. 구체적 하위 유형은 §2 mismatch taxonomy 참조. |
| `downplays` | 보도문의 주장 강도가 논문보다 **1단계 이상 하강(S_press < S_abstract)**. 효과 크기 축소, 발견의 중요성 감소, 또는 핵심 결론의 약화. |

### 1.3 판정 우선순위

1. S 등급 비교가 가능하면 S 등급 차이를 1차 기준으로 사용.
2. S 등급이 동일하더라도 의미적 변형(모집단 확대, 한계 삭제 등)이 있으면 `exaggerates` 또는 `downplays`로 판정.
3. 증거 불충분 시 `insufficient` (§5 참조).

---

## 2. Mismatch Taxonomy (주장 강도 불일치 유형)

보도문이 논문 대비 강도를 변경하는 구체적 메커니즘을 5가지 유형으로 분류합니다.

| ID | 유형 | 정의 | 예시 패턴 |
|----|------|------|-----------|
| M1 | **상관→인과 전환** | S1(상관)을 S3(인과)으로 격상. 공변량 관찰을 인과적 단정으로 재프레이밍. | "A is associated with B" → "A causes B" |
| M2 | **모집단 확대** | 논문이 특정 하위집단(연령, 성별, 질환군)에서 검증한 결과를 일반 인구로 확장. | "in elderly patients" → "in people" |
| M3 | **효과크기 확대** | 통계적 유의성을 실질적 중요성으로 과장. 수치 생략 시 "significant"를 "dramatic"으로 대체. | "significant reduction (p<0.05)" → "dramatic breakthrough" |
| M4 | **한계 삭제** | 논문의 limitation, caveat, 조건부 표현을 보도문에서 완전히 제거. | "may help, though further study needed" → "proven to help" |
| M5 | **확실성 강화** | 불확실성 마커(hedging) 제거 또는 확신 마커(certainty marker) 추가. | "suggests" → "demonstrates", "might" → "will" |

### 2.1 복합 유형

하나의 보도문이 여러 유형을 동시에 보일 수 있습니다. 이 경우 모델은 `mismatch_types` 배열에 해당 ID를 모두 기록합니다. 최종 라벨은 가장 높은 등급 변화를 일으킨 유형을 기준으로 결정합니다.

---

## 3. 모델 출력 JSON Schema

모델은 각 fixture에 대해 아래 JSON을 정확히 반환해야 합니다.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["fixture_id", "label", "abstract_strength", "press_strength", "mismatch_types", "evidence_spans", "rationale"],
  "properties": {
    "fixture_id": {
      "type": "string",
      "pattern": "^SED-[0-9]+$",
      "description": "대상 fixture 식별자"
    },
    "label": {
      "type": "string",
      "enum": ["same", "exaggerates", "downplays", "insufficient"],
      "description": "최종 주장 강도 변화 라벨"
    },
    "abstract_strength": {
      "type": "integer",
      "minimum": 0,
      "maximum": 3,
      "description": "논문의 주장 강도 등급 (S0~S3)"
    },
    "press_strength": {
      "type": "integer",
      "minimum": 0,
      "maximum": 3,
      "description": "보도문의 주장 강도 등급 (S0~S3)"
    },
    "mismatch_types": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["M1", "M2", "M3", "M4", "M5"]
      },
      "description": "적용된 mismatch 유형 ID 목록. none이면 빈 배열",
      "uniqueItems": true
    },
    "evidence_spans": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["source", "text", "role"],
        "properties": {
          "source": {
            "type": "string",
            "enum": ["abstract", "press_release"],
            "description": "근거가 추출된 텍스트 소스"
          },
          "text": {
            "type": "string",
            "minLength": 3,
            "description": "근거가 된 원문 텍스트 (exact substring)"
          },
          "role": {
            "type": "string",
            "enum": ["strength_marker", "hedging", "certainty", "scope", "limitation"],
            "description": "해당 span이 판정에서 수행한 역할"
          }
        }
      },
      "description": "판정의 근거가 된 exact text span 목록"
    },
    "rationale": {
      "type": "string",
      "minLength": 20,
      "description": "판정 근거의 자연어 설명 (최소 20자)"
    }
  },
  "additionalProperties": false
}
```

---

## 4. Exact Evidence Span 검증 규칙

모델이 제시한 `evidence_spans`가 유효한지 검증하는 규칙입니다.

### 4.1 Exact Substring 일치

- 각 span의 `text` 필드는 해당 `source`의 원문에서 **정확한 부분 문자열(exact substring)**로 존재해야 합니다.
- 대소문자, 공백, 구두점이 1자라도 다르면 **불일치**로 처리합니다.
- 정규화(normalization)는 허용하지 않습니다. (예: 대소문자 무시, 공백 압축 금지)

### 4.2 최소 길이

- 각 span은 최소 3자 이상이어야 합니다.
- 3자 미만은 유효하지 않은 span으로 처리합니다.

### 4.3 역할 일관성

- `role`이 `strength_marker`인 span은 강도 판단의 근거가 되어야 합니다.
- `role`이 `hedging`인 span은 한정사/불확실성 마커를 포함해야 합니다.
- `role`이 `certainty`인 span은 확신 표현을 포함해야 합니다.
- `role`이 `scope`인 span은 대상 범위(모집단)를 나타내야 합니다.
- `role`이 `limitation`인 span은 한계/조건을 나타내야 합니다.

### 4.4 양측 근거 요구

- `abstract`와 `press_release` 양쪽에서 최소 1개 이상의 span이 있어야 합니다.
- 한쪽만 span이 있으면 불완전 판정으로 처리합니다.

### 4.5 판정과의 논리적 일관성

- `label`이 `exaggerates`이면 `press_release` 측 span 중 `certainty` 또는 `strength_marker` 역할의 span이 `abstract` 측보다 강한 표현이어야 합니다.
- `label`이 `downplays`이면 반대 방향의 일관성이 요구됩니다.
- `label`이 `same`이면 양측 span이 의미적으로 동등한 강도를 가져야 합니다.

---

## 5. Fail-Closed / Insufficient 규칙

### 5.1 Fail-Closed 원칙

모델이 확신할 수 없는 경우, **보수적 판정**을 내립니다:

- 강도 등급 비교가 모호하면 `insufficient`를 반환합니다.
- mismatch 유형을 특정할 수 없으면 `mismatch_types`를 빈 배열로 두고 `label`만 판정합니다.
- 단, `insufficient`는 증거 부재 시에만 사용하며, 추측으로 라벨을 채우면 안 됩니다.

### 5.2 Insufficient 조건

다음 중 하나라도 해당하면 `label`을 `insufficient`로 설정합니다:

1. `abstract_conclusion` 또는 `press_release_conclusion`이 60자 미만으로 잘린 경우
2. 양측 텍스트에서 강도 마커를 전혀 찾을 수 없는 경우
3. 텍스트가 비과학적 도메인(주관적 평가, 의견)에 해당하는 경우
4. 모델이 자체적으로 증거 부족을 판단한 경우

### 5.3 Insufficient 처리

- `insufficient` 라벨은 GO/NO-GO 판정에서 **제외**됩니다 (§6 참조).
- `abstract_strength`와 `press_strength`는 추정 불가 시 `-1`로 설정합니다.
- `mismatch_types`는 빈 배열로 설정합니다.
- `evidence_spans`는 최소 1개 이상 유지하되, `role`을 `uncertain`으로 설정합니다.

---

## 6. 5개 표본 GO/NO-GO 사전 기준

5개 fixture에 대한 모델 예측을 수집한 후, 아래 기준을 적용하여 Kill Test의 GO(계속 진행) 또는 NO-GO(중단/재설계)를 판정합니다.

### 6.1 사전 기준 (Pre-registered Criteria)

| 기준 ID | 지표 | GO 임계값 | NO-GO 조건 |
|---------|------|-----------|------------|
| C1 | **라벨 정확도 (Label Accuracy)** | ≥ 4/5 (80%) | < 3/5 (60%) |
| C2 | **JSON 계약 준수율 (JSON Contract Rate)** | ≥ 5/5 (100%) | < 4/5 (80%) |
| C3 | **Evidence Span 유효율 (Span Validity Rate)** | ≥ 4/5 (80%) | < 3/5 (60%) |
| C4 | **M1~M5 유형 일치율** (exaggerates/downplays 라벨에 한함) | ≥ 2/3 (67%) | < 2/3 (67%) |
| C5 | **Insufficient 오용률** | ≤ 1/5 (20%) | > 2/5 (40%) |

### 6.2 판정 규칙

1. **C1, C2, C3 중 하나라도 NO-GO 조건이면 → 전체 NO-GO**
2. C1, C2, C3이 모두 GO이면 → C4, C5를 추가 검토
3. C4 또는 C5가 NO-GO이면 → **조건부 GO** (모델 개선 후 재테스트)
4. 모든 기준이 GO이면 → **전체 GO**

### 6.3 5개 표본별 기대 라벨 (Ground Truth)

| fixture_id | gold_label | abstract_strength | press_strength | 기대 mismatch_types |
|------------|------------|-------------------|----------------|---------------------|
| SED-1 | same | 0 | 0 | [] |
| SED-2 | exaggerates | 1 | 3 | ["M1", "M4"] |
| SED-3 | same | 3 | 3 | [] |
| SED-4 | downplays | 3 | 2 | ["M5"] |
| SED-5 | exaggerates | 1 | 3 | ["M1", "M3"] |

### 6.4 C4 계산 방법

- `exaggerates` 또는 `downplays`로 판정된 fixture만 대상
- 모델이 예측한 `mismatch_types`와 기대 `mismatch_types`의 **교집합 크기 / 합집합 크기** (Jaccard 유사도)를 계산
- Jaccard ≥ 0.5이면 해당 fixture는 "유형 일치"로 간주
- 일치한 fixture 수 / 전체 (exaggerates + downplays) fixture 수 ≥ 0.67이면 GO

---

## 7. 평가 지표 계산법

### 7.1 라벨 정확도 (Label Accuracy)

```
Label Accuracy = (gold_label과 모델 label이 일치한 fixture 수) / (전체 fixture 수)
```

- `insufficient`로 판정된 fixture는 분모에서 제외하지 않음 (오답으로 처리)
- 본 표본: 5개 fixture 중 ≥ 4개 일치하면 GO

### 7.2 JSON 계약 준수율 (JSON Contract Rate)

모델 출력이 §3의 JSON Schema를 완전히 준수하는지 검증합니다.

```
JSON Contract Rate = (Schema 유효한 출력 수) / (전체 출력 수)
```

**검증 항목:**

1. 필수 필드 모두 존재 (`fixture_id`, `label`, `abstract_strength`, `press_strength`, `mismatch_types`, `evidence_spans`, `rationale`)
2. `label`이 enum 값 중 하나
3. `abstract_strength`와 `press_strength`가 0~3 정수
4. `mismatch_types`가 enum 배열
5. `evidence_spans`가 최소 1개 이상
6. 각 span이 `source`, `text`, `role`을 모두 포함
7. `additionalProperties: false` 위반 없음

**파싱 실패 처리:**

- JSON 파싱 자체가 실패하면 → 계약 위반
- Schema 검증 실패하면 → 계약 위반
- 본 표본: 5개 중 ≥ 4개 유효하면 GO

### 7.3 Evidence Span 유효율 (Span Validity Rate)

모델이 제시한 `evidence_spans`가 §4의 검증 규칙을 통과하는지 확인합니다.

```
Span Validity Rate = (모든 span이 유효한 fixture 수) / (전체 fixture 수)
```

**Fixture별 유효 판정:**

1. 모든 span이 exact substring 일치 (§4.1)
2. 모든 span이 최소 3자 이상 (§4.2)
3. 모든 span의 role이 적절 (§4.3)
4. 양측 소스에서 최소 1개 이상 span 존재 (§4.4)
5. label과 논리적 일관성 (§4.5)

**부분 유효 처리:**

- 하나라도 실패하면 해당 fixture는 "무효"로 처리
- 본 표본: 5개 중 ≥ 4개 유효하면 GO

### 7.4 계산 예시

**시나리오 A: 이상적 결과**

| fixture | label 정확 | JSON 유효 | span 유효 | mismatch 일치 |
|---------|------------|------------|------------|---------------|
| SED-1 | ✓ | ✓ | ✓ | N/A |
| SED-2 | ✓ | ✓ | ✓ | ✓ |
| SED-3 | ✓ | ✓ | ✓ | N/A |
| SED-4 | ✓ | ✓ | ✓ | ✓ |
| SED-5 | ✓ | ✓ | ✓ | ✓ |

- C1: 5/5 = 100% → GO
- C2: 5/5 = 100% → GO
- C3: 5/5 = 100% → GO
- C4: 3/3 = 100% → GO
- C5: 0/5 = 0% → GO
- **전체: GO**

**시나리오 B: 경계선 결과**

| fixture | label 정확 | JSON 유효 | span 유효 | mismatch 일치 |
|---------|------------|------------|------------|---------------|
| SED-1 | ✓ | ✓ | ✓ | N/A |
| SED-2 | ✓ | ✓ | ✗ | ✓ |
| SED-3 | ✗ | ✓ | ✓ | N/A |
| SED-4 | ✓ | ✓ | ✓ | ✓ |
| SED-5 | ✓ | ✓ | ✓ | ✗ |

- C1: 4/5 = 80% → GO
- C2: 5/5 = 100% → GO
- C3: 4/5 = 80% → GO
- C4: 2/3 = 67% → GO
- C5: 0/5 = 0% → GO
- **전체: GO**

**시나리오 C: NO-GO 결과**

| fixture | label 정확 | JSON 유효 | span 유효 | mismatch 일치 |
|---------|------------|------------|------------|---------------|
| SED-1 | ✗ | ✓ | ✗ | N/A |
| SED-2 | ✗ | ✗ | ✗ | ✗ |
| SED-3 | ✓ | ✓ | ✓ | N/A |
| SED-4 | ✗ | ✓ | ✗ | ✗ |
| SED-5 | ✓ | ✓ | ✓ | ✓ |

- C1: 2/5 = 40% → NO-GO
- C2: 4/5 = 80% → GO
- C3: 2/5 = 40% → NO-GO
- C4: 1/3 = 33% → NO-GO
- C5: 0/5 = 0% → GO
- **전체: NO-GO** (C1, C3, C4 실패)

---

## 8. 부록: Strength Rating 가이드라인

### 8.1 S0 (관계 없음) 판정 마커

- "no significant association"
- "no relationship was found"
- "did not affect"
- "no impact on"

### 8.2 S1 (상관) 판정 마커

- "associated with"
- "correlated with"
- "linked to" (인과 맥락 없으면 상관)
- "related to"

### 8.3 S2 (조건부 인과) 판정 마커

- "may cause"
- "could lead to"
- "might contribute to"
- "potentially reduces"
- "suggests that X affects Y"

### 8.4 S3 (인과) 판정 마커

- "causes"
- "leads to"
- "reduces" (확신 어조)
- "increases" (확신 어조)
- "prevents"
- "is effective for"

---

## 9. 계약 준수 검증 절차

### 9.1 자동 검증 파이프라인

```
1. 모델 출력 수집 (JSON per fixture)
2. JSON 파싱 시도 → 실패 시 계약 위반
3. Schema 검증 (jsonschema 라이브러리 사용)
4. Evidence span 검증:
   a. exact substring 검색 (abstract_conclusion, press_release_conclusion)
   b. 최소 길이 체크
   c. role 적절성 휴리스틱 검증
   d. 양측 소스 존재 확인
5. 라벨 비교 (gold vs predicted)
6. mismatch 유형 비교 (Jaccard)
7. C1~C5 계산
8. GO/NO-GO 판정
```

### 9.2 수동 검증 (선택)

자동 검증 후, 경계선 사례(ambigious cases)에 대해 수동 검토를 수행할 수 있습니다. 수동 검토 결과는 참고용으로 기록하되, GO/NO-GO 판정에는 자동 검증 결과만 사용합니다.

---

## 10. 버전 관리 및 변경 이력

| 버전 | 날짜 | 변경 사항 |
|------|------|-----------|
| 1.0 | 2026-08-16 | 초기 작성 |

---

## 11. 참고 문헌

- Wright, D., & Augenstein, I. (2021). Semi-Supervised Exaggeration Detection of Health Science Press Releases. EMNLP 2021.
- Sumner, P., et al. (2014). The association between exaggeration in health related science news and academic press releases: retrospective observational study. BMJ, 349, g7015.
- Bratton, S., et al. (2019). Exaggeration in health press releases.

---

**계약 종료**
