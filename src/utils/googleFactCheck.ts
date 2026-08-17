import type { FactCheckResult } from '@/types';

const FACT_CHECK_API_URL = 'https://toolbox.google.com/factcheck/api/search';

export class FactCheckApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FactCheckApiError';
  }
}

function mapTextualRatingToStatus(rating: string | undefined): FactCheckResult['status'] {
  if (!rating) return 'unverified';

  const normalized = rating.toLowerCase();

  // 참/사실 계열
  const truePatterns = [
    'true', '사실', '맞', '참', '확인', 'accurate', 'correct',
    'mostly true', '대체로 사실', '거의 사실',
  ];
  if (truePatterns.some(pattern => normalized.includes(pattern))) {
    return 'verified';
  }

  // 거짓/거짓말 계열
  const falsePatterns = [
    'false', '거짓', '틀', '거짓말', '사실이 아님', '부정',
    'inaccurate', 'incorrect', 'wrong', 'not true',
    'mostly false', '대체로 거짓', '거의 거짓',
    'pants on fire', '거짓말',
  ];
  if (falsePatterns.some(pattern => normalized.includes(pattern))) {
    return 'false';
  }

  // 불확실/부분적 계열
  const uncertainPatterns = [
    'half true', '반은 맞고', '절반', '부분적',
    'misleading', '오해', 'why it matters',
    'no evidence', '근거 없음', 'unverified',
  ];
  if (uncertainPatterns.some(pattern => normalized.includes(pattern))) {
    return 'unverified';
  }

  // 매핑되지 않은 경우
  return 'unverified';
}

export async function searchFactChecks(
  searchQuery: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FactCheckResult> {
  console.log('[Fact Lens] 팩트체크 시작:', searchQuery);
  
  // query가 너무 짧으면 API가 거부할 수 있음
  if (searchQuery.length < 5) {
    return {
      claim: searchQuery,
      status: 'unverified',
      source: 'Google Fact Check',
      explanation: '검색 쿼리가 너무 짧아 팩트체크를 요청할 수 없습니다.',
      url: null,
    };
  }
  
  console.log('[Fact Lens] Gemini 생성 쿼리:', searchQuery);
  
  // 고유한 image_id 생성 (세션 추적용)
  const imageId = crypto.randomUUID();
  
  const params = new URLSearchParams({
    hl: 'ko',
    num_results: '20',
    force: 'false',
    offset: '0',
    query: searchQuery,
    image_id: imageId,
  });

  const url = `${FACT_CHECK_API_URL}?${params.toString()}`;
  
  console.log('[Fact Lens] API 요청 URL:', url);

  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  console.log('[Fact Lens] API 응답 상태:', response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Fact Lens] API 에러 응답:', errorText);
    throw new FactCheckApiError(
      `Google Fact Check API 오류 (${response.status}): ${errorText}`,
    );
  }

  // XSSI 방어 접두사 제거
  const responseText = await response.text();
  const cleanJson = responseText.replace(/^\)\]\}'/, '').trim();
  
  let data: any;
  try {
    data = JSON.parse(cleanJson);
  } catch (error) {
    console.error('[Fact Lens] JSON 파싱 실패:', error);
    throw new FactCheckApiError('응답을 파싱할 수 없습니다.');
  }

  // 응답 구조: [["claims_response", [[claim_data, entity_data, ...]]]]
  const claimsResponse = data[0]?.[1]?.[0];
  if (!claimsResponse || !Array.isArray(claimsResponse) || claimsResponse.length === 0) {
    return {
      claim: searchQuery,
      status: 'unverified',
      source: 'Google Fact Check',
      explanation: '이 주장에 대한 팩트체크 결과를 찾을 수 없습니다.',
      url: null,
      hasFactCheck: false,
    };
  }

  // 첫 번째 claim 사용
  const claim = claimsResponse[0];
  if (!claim || !Array.isArray(claim)) {
    return {
      claim: searchQuery,
      status: 'unverified',
      source: 'Google Fact Check',
      explanation: '팩트체크 데이터를 파싱할 수 없습니다.',
      url: null,
      hasFactCheck: false,
    };
  }

  const claimText = claim[0] || searchQuery;
  const reviews = claim[3];
  
  if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
    return {
      claim: claimText,
      status: 'unverified',
      source: 'Google Fact Check',
      explanation: '팩트체크 리뷰를 찾을 수 없습니다.',
      url: null,
      hasFactCheck: false,
    };
  }

  // 첫 번째 리뷰 사용
  const review = reviews[0];
  if (!review || !Array.isArray(review)) {
    return {
      claim: claimText,
      status: 'unverified',
      source: 'Google Fact Check',
      explanation: '리뷰 데이터를 파싱할 수 없습니다.',
      url: null,
      hasFactCheck: false,
    };
  }

  const publisherInfo = review[0];
  const publisher = Array.isArray(publisherInfo) ? publisherInfo[0] : 'Google Fact Check';
  const reviewUrl = review[1] || null;
  const textualRating = review[3];
  const reviewTitle = review[8] || '';

  const status = mapTextualRatingToStatus(textualRating);
  const explanation = reviewTitle
    ? `${reviewTitle} (${textualRating || '평점 없음'})`
    : `팩트체크 결과: ${textualRating || '평점 없음'}`;

  return {
    claim: claimText,
    status,
    source: publisher,
    explanation,
    url: reviewUrl,
    hasFactCheck: true,
  };
}
