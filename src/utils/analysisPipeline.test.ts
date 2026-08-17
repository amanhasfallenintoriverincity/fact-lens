import { describe, expect, it, vi } from 'vitest';
import { runAnalysisPipeline } from './analysisPipeline';

describe('runAnalysisPipeline', () => {
  it('기사 분석과 Google Fact Check API로 전체 분석 결과를 만든다', async () => {
    const claim = '대한민국의 수도는 서울이다';
    const searchQuery = '서울 대한민국 수도';
    const articleOutput = {
      emotions: [{ label: '안심/신뢰', score: 80 }],
      claims: [{ text: claim, searchQuery }],
      bias: {
        factOpinionRatio: { fact: 95, opinion: 5 },
        missingContext: [],
        frame: '사실 전달',
        biasScore: 5,
      },
    };
    const factCheckResponse = {
      claims: [{
        text: claim,
        claimReview: [{
          publisher: { name: '대한민국 정부', site: 'korea.go.kr' },
          url: 'https://www.korea.go.kr/',
          title: '서울은 대한민국 헌법상 수도입니다',
          textualRating: '사실',
        }],
      }],
    };
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'completed',
        steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(articleOutput) }] }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(factCheckResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

    const result = await runAnalysisPipeline('뉴스 기사 본문'.repeat(30), 'test-key', fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(Object.keys(result.emotion || {})).not.toHaveLength(0);
    expect(result.claims).toHaveLength(1);
    expect(result.factcheck).toHaveLength(1);
    expect(result.factcheck?.[0].status).toBe('verified');
    expect(result.bias).not.toBeNull();
    expect(result.summary).toEqual({ trust: 100, emotional: 100, bias: 95 });
  });
});
