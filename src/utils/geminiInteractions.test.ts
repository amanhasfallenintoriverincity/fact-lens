import { describe, expect, it, vi } from 'vitest';
import { parseInteractionJson, requestInteraction } from './geminiInteractions';

describe('requestInteraction', () => {
  it('HTTP 200이어도 status가 incomplete이면 실패로 처리한다', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        status: 'incomplete',
        usage: {
          total_output_tokens: 0,
          total_thought_tokens: 297,
        },
        steps: [{ type: 'thought' }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(requestInteraction(
      'test-api-key',
      { model: 'gemini-3.5-flash-lite', input: '테스트', store: false },
      fetchMock,
    )).rejects.toThrow(/incomplete|완료되지 않았습니다/);
  });

  it('완료된 model_output의 텍스트를 JSON으로 파싱한다', () => {
    const parsed = parseInteractionJson<{ claims: string[] }>({
      status: 'completed',
      steps: [
        { type: 'thought', summary: [{ type: 'text', text: '내부 사고' }] },
        {
          type: 'model_output',
          content: [{ type: 'text', text: '{"claims":["대한민국의 수도는 서울이다"]}' }],
        },
      ],
    });

    expect(parsed.claims).toEqual(['대한민국의 수도는 서울이다']);
  });
});
