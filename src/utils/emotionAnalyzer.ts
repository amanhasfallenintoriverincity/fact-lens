import type { EmotionScores } from '@/types';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent';

const EMOTION_LABELS = [
  '불평/불만','환영/호의','감동/감탄','지긋지긋',
  '고마움','슬픔','화남/분노','존경','기대감',
  '우쭐댐/무시함','안타까움/실망','비장함',
  '의심/불신','뿌듯함','편안/쾌적','신기함/관심',
  '아껴주는','부끄러움','공포/무서움','절망',
  '한심함','역겨움/징그러움','짜증','어이없음',
  '없음','패배/자기혐오','귀찮음','힘듦/지침',
  '즐거움/신남','깨달음','죄책감','증오/혐오',
  '흐뭇함(귀여움/예쁨)','당황/난처','경악',
  '부담/안_내킴','서러움','재미없음','불쌍함/연민',
  '놀람','행복','불안/걱정','기쁨','안심/신뢰'
];

// thought part를 제외하고 실제 응답 텍스트만 추출
function extractResponseText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts
    .filter((part: any) => !part.thought)
    .map((part: any) => part.text || '')
    .join('')
    .trim();
}

export async function analyzeEmotion(content: string): Promise<EmotionScores> {
  const settings = await getSettings();
  
  if (!settings.geminiApiKey) {
    throw new Error('Gemini API 키가 설정되지 않았습니다.');
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
            text: `다음 뉴스 기사의 감정을 분석하세요.
44개 감정 라벨 중 상위 5개만 골라 점수(0-100)를 JSON으로 반환하세요.
다른 설명 없이 JSON 객체만 출력하세요.

감정 라벨: ${EMOTION_LABELS.join(', ')}

예시 출력: {"화남/분노": 75, "의심/불신": 60, "불안/걱정": 45, "슬픔": 30, "짜증": 25}

기사:
${content.substring(0, 2000)}`
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 300,
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
    console.log('Emotion raw response:', text);
    
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(cleaned);
      const emotions = result.emotions || result;
      
      const scores: EmotionScores = {};
      for (const [label, score] of Object.entries(emotions)) {
        if (EMOTION_LABELS.includes(label)) {
          scores[label] = Math.min(100, Math.max(0, Number(score)));
        }
      }
      
      return scores;
    } catch (e) {
      console.error('Failed to parse emotion analysis:', text);
      return {};
    }
  } catch (error) {
    console.error('Emotion analysis error:', error);
    throw error;
  }
}

async function getSettings(): Promise<{ geminiApiKey?: string }> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['geminiApiKey'], (settings) => {
      resolve(settings);
    });
  });
}
