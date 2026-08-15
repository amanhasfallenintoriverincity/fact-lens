import type { AnalysisResults, SummaryScores } from '@/types';

export function calculateSummary(results: AnalysisResults): SummaryScores {
  let trustScore = 50;
  let emotionalScore = 50;
  let biasScore = 50;
  
  // 감정 점수 계산
  if (results.emotion) {
    const negativeEmotions = ['화남/분노', '슬픔', '공포/무서움', '불안/걱정', '증오/혐오'];
    let negativeTotal = 0;
    
    for (const [emotion, score] of Object.entries(results.emotion)) {
      if (negativeEmotions.includes(emotion)) {
        negativeTotal += score;
      }
    }
    
    emotionalScore = Math.max(0, 100 - negativeTotal);
  }
  
  // 팩트체크 점수 계산
  if (results.factcheck) {
    const verified = results.factcheck.filter(r => r.status === 'verified').length;
    const total = results.factcheck.length;
    trustScore = total > 0 ? (verified / total) * 100 : 50;
  }
  
  // 편향성 점수 계산
  if (results.bias) {
    biasScore = 100 - results.bias.biasScore;
  }
  
  return {
    trust: Math.round(trustScore),
    emotional: Math.round(emotionalScore),
    bias: Math.round(biasScore)
  };
}
