import type { Claim, Settings } from '@/types';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent';

// thought part를 제외하고 실제 응답 텍스트만 추출
function extractResponseText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts
    .filter((part: any) => !part.thought)
    .map((part: any) => part.text || '')
    .join('')
    .trim();
}

export async function extractClaims(content: string): Promise<Claim[]> {
  const settings = await getSettings();
  
  if (!settings.geminiApiKey) {
    throw new Error('Gemini API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${settings.geminiApiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `다음 뉴스 기사에서 검증 가능한 주장(사실 확인이 필요한 문장)을 추출하세요.
각 주장은 구체적이고 검증 가능한 사실이어야 합니다.
JSON 배열 형태로만 반환하세요. 다른 설명 없이 JSON만 출력하세요.

예시 출력: {"claims": ["서울시 인구는 1000만명이다", "GDP는 3% 성장했다"]}

기사:
${content.substring(0, 3000)}`
        }]
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
        thinkingConfig: {
          thinkingLevel: 'MINIMAL'
        }
      }
    })
  });

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Gemini API 오류: ${data.error.message}`);
  }
  
  const text = extractResponseText(data);
  console.log('Claims raw response:', text);
  
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleaned);
    const claims = result.claims || [];
    return claims.slice(0, 5).map((t: string) => ({ text: t }));
  } catch (e) {
    console.error('Failed to parse claims:', text);
    return [];
  }
}

async function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['geminiApiKey', 'kosisApiKey'], (settings) => {
      resolve(settings);
    });
  });
}
