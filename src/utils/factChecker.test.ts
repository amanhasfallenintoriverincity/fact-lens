import { describe, expect, it, vi } from 'vitest';
import { factCheckClaims } from './factChecker';

describe('factCheckClaims', () => {
  it('한 번의 Gemini 3.5 Flash-Lite Google Search Interaction으로 주장과 인용을 검증한다', async () => {
    const claim = '대한민국의 수도는 서울이다';
    const output = JSON.stringify({
      results: [{
        claim,
        status: 'verified',
        explanation: '공식 자료에서 대한민국의 수도를 서울로 명시합니다.',
      }],
    });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        status: 'completed',
        steps: [
          { type: 'google_search_call', arguments: { queries: ['대한민국 수도 공식 자료'] } },
          { type: 'google_search_result', call_id: 'search_001', result: [] },
          {
            type: 'model_output',
            content: [{
              type: 'text',
              text: output,
              annotations: [{
                type: 'url_citation',
                title: '대한민국 정부',
                url: 'https://www.korea.go.kr/',
                start_index: 0,
                end_index: output.length,
              }],
            }],
          },
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const results = await factCheckClaims([{ text: claim }], 'test-key', fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(request.model).toBe('gemini-3.5-flash-lite');
    expect(request.tools).toEqual([{ type: 'google_search' }]);
    expect(request.generation_config.thinking_level).toBe('minimal');
    expect(results).toEqual([{
      claim,
      status: 'verified',
      source: '대한민국 정부',
      explanation: '공식 자료에서 대한민국의 수도를 서울로 명시합니다.',
      url: 'https://www.korea.go.kr/',
    }]);
  });

  it('인용 URL이 없으면 모델이 verified를 반환해도 미확인으로 닫는다', async () => {
    const claim = '대한민국의 수도는 서울이다';
    const output = JSON.stringify({
      results: [{
        claim,
        status: 'verified',
        explanation: '검색 결과가 이 주장을 뒷받침합니다.',
      }],
    });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        status: 'completed',
        steps: [
          { type: 'google_search_call', arguments: { queries: [claim] } },
          { type: 'google_search_result', call_id: 'search_001', result: [] },
          { type: 'model_output', content: [{ type: 'text', text: output }] },
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const [result] = await factCheckClaims([{ text: claim }], 'test-key', fetchMock);

    expect(result.status).toBe('unverified');
    expect(result.url).toBeNull();
    expect(result.source).toBe('Google Search');
    expect(result.explanation).toContain('인용 URL');
  });

  it('한 주장에 연결된 citation을 다른 주장에 fallback으로 재사용하지 않는다', async () => {
    const firstClaim = '대한민국의 수도는 서울이다';
    const secondClaim = '서울은 대한민국에서 가장 큰 도시다';
    const output = JSON.stringify({
      results: [
        { claim: firstClaim, status: 'verified', explanation: '첫 주장 근거입니다.' },
        { claim: secondClaim, status: 'verified', explanation: '둘째 주장 근거입니다.' },
      ],
    });
    const citationStart = output.indexOf(firstClaim);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        status: 'completed',
        steps: [
          { type: 'google_search_call', arguments: { queries: [firstClaim, secondClaim] } },
          { type: 'google_search_result', call_id: 'search_001', result: [] },
          {
            type: 'model_output',
            content: [{
              type: 'text',
              text: output,
              annotations: [{
                type: 'url_citation',
                title: '대한민국 정부',
                url: 'https://www.korea.go.kr/',
                start_index: citationStart,
                end_index: citationStart + firstClaim.length,
              }],
            }],
          },
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const results = await factCheckClaims(
      [{ text: firstClaim }, { text: secondClaim }],
      'test-key',
      fetchMock,
    );

    expect(results[0]).toMatchObject({
      claim: firstClaim,
      status: 'verified',
      url: 'https://www.korea.go.kr/',
    });
    expect(results[1]).toMatchObject({
      claim: secondClaim,
      status: 'unverified',
      source: 'Google Search',
      url: null,
    });
    expect(results[1].explanation).toContain('인용 URL');
  });

  it('팩트체크 structured JSON이 깨지면 한 번만 재요청한다', async () => {
    const claim = '대한민국의 수도는 서울이다';
    const validOutput = JSON.stringify({
      results: [{ claim, status: 'verified', explanation: '공식 자료로 확인됩니다.' }],
    });
    const citationStart = validOutput.indexOf(claim);
    const response = (text: string, annotations: unknown[] = []) => new Response(JSON.stringify({
      status: 'completed',
      steps: [
        { type: 'google_search_call', arguments: { queries: [claim] } },
        { type: 'google_search_result', call_id: 'search_001', result: [] },
        { type: 'model_output', content: [{ type: 'text', text, annotations }] },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response('{"results":.'))
      .mockResolvedValueOnce(response(validOutput, [{
        type: 'url_citation',
        title: '대한민국 정부',
        url: 'https://www.korea.go.kr/',
        start_index: citationStart,
        end_index: citationStart + claim.length,
      }]));

    const [result] = await factCheckClaims([{ text: claim }], 'test-key', fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      status: 'verified',
      url: 'https://www.korea.go.kr/',
    });
  });
});
