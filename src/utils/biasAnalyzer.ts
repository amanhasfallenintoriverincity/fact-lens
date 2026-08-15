import type { EmotionScores, FactCheckResult, BiasAnalysis, Settings } from '@/types';

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

export async function analyzeBias(
  content: string, 
  _emotion: EmotionScores | null, 
  _factcheck: FactCheckResult[] | null
): Promise<BiasAnalysis | null> {
  const settings = await getSettings();
  
  if (!settings.geminiApiKey) {
    return null;
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${settings.geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `다음 뉴스 기사의 편향성을 분석하세요.
아래 JSON 형식으로만 출력하세요. 다른 설명 없이 JSON만 출력하세요.

{
  "factOpinionRatio": {"fact": 0~100, "opinion": 0~100},
  "missingContext": ["누락된 맥락1", "누락된 맥락2"],
  "frame": "기사 프레임 (위협/기회/중립 등)",
  "biasScore": 0~100
}

기사:
${content.substring(0, 2000)}`
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
      console.error('Gemini API error:', data.error.message);
      return null;
    }
    
    const text = extractResponseText(data);
    console.log('Bias raw response:', text);
    
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(cleaned);
      
      return {
        factOpinionRatio: result.factOpinionRatio || { fact: 50, opinion: 50 },
        missingContext: result.missingContext || [],
        frame: result.frame || '중립',
        biasScore: typeof result.biasScore === 'number' ? result.biasScore : 50
      };
    } catch (e) {
      console.error('Failed to parse bias analysis:', text);
      return null;
    }
  } catch (error) {
    console.error('Bias analysis error:', error);
    return null;
  }
}

async function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['geminiApiKey', 'kosisApiKey'], (settings) => {
      resolve(settings);
    });
  });
}
