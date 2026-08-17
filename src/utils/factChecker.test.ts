import { describe, expect, it, vi } from 'vitest';
import { factCheckClaims } from './factChecker';

describe('factCheckClaims', () => {
  it('Fact Check Explorer API로 주장을 검증한다', async () => {
    const claim = '대한민국의 수도는 서울이다';
    const searchQuery = '서울 대한민국 수도';
    
    // 실제 Fact Check Explorer API 응답 형식 (XSSI 방어 접두사 포함)
    const apiResponse = `)]}'

[["claims_response",[[["${claim}",["출처",null,["https://example.com"]],1234567890,[["연합뉴스 팩트체크","yna.co.kr",null,"kr","South Korea","123456"],"https://www.yna.co.kr/factcheck/123",1234567890,"사실",null,[null,"789"],"ko",["kr"],"서울은 대한민국 헌법상 수도입니다",[2,1,6],null,1234567890]],null,null,["서울 대한민국 수도"],null,null,null]],"https://example.com/image.jpg",0.8]]]`;

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(apiResponse, { status: 200 }),
    );

    const results = await factCheckClaims(
      [{ text: claim, searchQuery }],
      fetchMock
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    expect(results[0].claim).toBe(claim);
    expect(results[0].status).toBe('verified');
    expect(results[0].source).toBe('연합뉴스 팩트체크');
    expect(results[0].url).toBe('https://www.yna.co.kr/factcheck/123');
    expect(results[0].explanation).toContain('서울은 대한민국 헌법상 수도입니다');
  });

  it('팩트체크 결과가 없으면 unverified로 반환한다', async () => {
    const claim = '테스트 주장';
    const searchQuery = '테스트 주장 검색';
    
    // 빈 결과 응답
    const apiResponse = `)]}'

[["claims_response",[]]]`;

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(apiResponse, { status: 200 }),
    );

    const [result] = await factCheckClaims(
      [{ text: claim, searchQuery }],
      fetchMock
    );

    expect(result.status).toBe('unverified');
    expect(result.url).toBeNull();
    expect(result.explanation).toContain('찾을 수 없습니다');
  });

  it('API 오류 시 unverified로 반환한다', async () => {
    const claim = '오류 테스트';
    const searchQuery = '오류 테스트 검색';
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('API Error', { status: 500 }),
    );

    const [result] = await factCheckClaims(
      [{ text: claim, searchQuery }],
      fetchMock
    );

    expect(result.status).toBe('unverified');
    expect(result.explanation).toContain('오류');
  });
});
