import { describe, expect, it, vi } from 'vitest';
import { runAnalysisPipeline } from './analysisPipeline';

describe('runAnalysisPipeline', () => {
  it('두 번의 Interaction으로 비어 있지 않은 전체 분석 결과를 만든다', async () => {
    const claim = '대한민국의 수도는 서울이다';
    const articleOutput = {
      emotions: [{ label: '안심/신뢰', score: 80 }],
      claims: [claim],
      bias: {
        factOpinionRatio: { fact: 95, opinion: 5 },
        missingContext: [],
        frame: '사실 전달',
        biasScore: 5,
      },
    };
    const factOutput = {
      results: [{ claim, status: 'verified', explanation: '정부 공식 자료로 확인됩니다.' }],
    };
    const factOutputText = JSON.stringify(factOutput);
    const citationStart = factOutputText.indexOf(claim);
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'completed',
        steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(articleOutput) }] }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'completed',
        steps: [
          { type: 'google_search_call', arguments: { queries: ['대한민국 수도'] } },
          { type: 'google_search_result', call_id: 'search_1', result: [] },
          {
            type: 'model_output',
            content: [{
              type: 'text',
              text: factOutputText,
              annotations: [{
                type: 'url_citation',
                title: '대한민국 정부',
                url: 'https://www.korea.go.kr/',
                start_index: citationStart,
                end_index: citationStart + claim.length,
              }],
            }],
          },
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await runAnalysisPipeline('뉴스 기사 본문'.repeat(30), 'test-key', fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(Object.keys(result.emotion || {})).not.toHaveLength(0);
    expect(result.claims).toHaveLength(1);
    expect(result.factcheck).toHaveLength(1);
    expect(result.bias).not.toBeNull();
    expect(result.summary).toEqual({ trust: 100, emotional: 100, bias: 95 });
  });
});
