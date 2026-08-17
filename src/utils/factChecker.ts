import type { Claim, FactCheckResult } from '@/types';
import { searchFactChecks } from './googleFactCheck';

export async function factCheckClaims(
  claims: Claim[],
  fetchImpl: typeof fetch = fetch,
): Promise<FactCheckResult[]> {
  if (claims.length === 0) return [];

  const results: FactCheckResult[] = [];

  for (const claim of claims.slice(0, 5)) {
    try {
      const result = await searchFactChecks(claim.searchQuery, fetchImpl);
      results.push({
        ...result,
        claim: claim.text,
      });
    } catch (error) {
      results.push({
        claim: claim.text,
        status: 'unverified',
        source: 'Google Fact Check',
        explanation: error instanceof Error
          ? `팩트체크 조회 실패: ${error.message}`
          : '팩트체크 조회 중 알 수 없는 오류가 발생했습니다.',
        url: null,
        hasFactCheck: false,
      });
    }
  }

  return results;
}
