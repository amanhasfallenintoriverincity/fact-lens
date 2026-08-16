import { describe, expect, it, vi } from 'vitest';
import { analyzeArticle } from './articleAnalyzer';

describe('analyzeArticle', () => {
  it('한 번의 완료된 Gemini 3.5 Flash-Lite Interaction으로 감정·주장·편향을 반환한다', async () => {
    const output = {
      emotions: [{ label: '안심/신뢰', score: 82 }],
      claims: ['대한민국의 수도는 서울이다'],
      bias: {
        factOpinionRatio: { fact: 90, opinion: 10 },
        missingContext: ['행정기관의 세종 이전 맥락'],
        frame: '사실 전달',
        biasScore: 10,
      },
    };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        status: 'completed',
        steps: [{
          type: 'model_output',
          content: [{ type: 'text', text: JSON.stringify(output) }],
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const result = await analyzeArticle('충분히 긴 뉴스 기사 본문입니다.'.repeat(20), 'test-key', fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(request.model).toBe('gemini-3.5-flash-lite');
    expect(request.generation_config.thinking_level).toBe('minimal');
    expect(request.generation_config.max_output_tokens).toBeGreaterThanOrEqual(1500);
    expect(result).toEqual({
      emotion: { '안심/신뢰': 82 },
      claims: [{ text: '대한민국의 수도는 서울이다' }],
      bias: output.bias,
    });
  });
});
