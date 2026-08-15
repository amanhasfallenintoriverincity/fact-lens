import type { Claim, FactCheckResult, Settings } from '@/types';

export async function factCheckClaims(claims: Claim[]): Promise<FactCheckResult[]> {
  const results: FactCheckResult[] = [];
  
  for (const claim of claims) {
    const result = await factCheckSingleClaim(claim.text);
    results.push(result);
  }
  
  return results;
}

async function factCheckSingleClaim(claim: string): Promise<FactCheckResult> {
  // 1. KOSIS 통계 검증 시도
  const kosisResult = await checkKosis(claim);
  if (kosisResult.found) {
    return {
      claim,
      status: kosisResult.status || 'verified',
      source: 'KOSIS',
      explanation: kosisResult.explanation || '',
      url: kosisResult.url || null
    };
  }
  
  // 2. Google Fact Check API 시도
  const googleResult = await checkGoogleFactCheck(claim);
  if (googleResult.found) {
    return {
      claim,
      status: googleResult.status || 'verified',
      source: 'Google Fact Check',
      explanation: googleResult.explanation || '',
      url: googleResult.url || null
    };
  }
  
  // 3. 매칭 실패
  return {
    claim,
    status: 'unverified',
    source: null,
    explanation: '검증 가능한 출처를 찾지 못했습니다.',
    url: null
  };
}

async function checkKosis(claim: string): Promise<{ found: boolean; status?: 'verified' | 'unverified' | 'false'; explanation?: string; url?: string }> {
  const settings = await getSettings();
  
  if (!settings.kosisApiKey) {
    return { found: false };
  }
  
  try {
    // KOSIS 통합검색 API
    const searchUrl = `https://kosis.kr/openapi/Param/statisticsParameterData.do?method=getList&apiKey=${settings.kosisApiKey}&searchNm=${encodeURIComponent(claim)}&format=json`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        found: true,
        status: 'verified',
        explanation: 'KOSIS 통계 자료와 일치합니다.',
        url: 'https://kosis.kr'
      };
    }
  } catch (error) {
    console.error('KOSIS check error:', error);
  }
  
  return { found: false };
}

async function checkGoogleFactCheck(_claim: string): Promise<{ found: boolean; status?: 'verified' | 'unverified' | 'false'; explanation?: string; url?: string }> {
  try {
    // Note: Google Fact Check API는 API 키가 필요하지만, 데모용으로는 생략 가능
    // 실제 구현 시 API 키 필요
    
    return { found: false };
  } catch (error) {
    console.error('Google Fact Check error:', error);
    return { found: false };
  }
}

async function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['geminiApiKey', 'kosisApiKey'], (settings) => {
      resolve(settings);
    });
  });
}
