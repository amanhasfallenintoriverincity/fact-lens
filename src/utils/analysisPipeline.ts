import type { AnalysisResults } from '@/types';
import { analyzeArticle } from './articleAnalyzer';
import { factCheckClaims } from './factChecker';
import { calculateSummary } from './summaryCalculator';

export async function runAnalysisPipeline(
  content: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AnalysisResults> {
  const article = await analyzeArticle(content, apiKey, fetchImpl);
  const factcheck = article.claims.length > 0
    ? await factCheckClaims(article.claims, apiKey, fetchImpl)
    : [];

  const results: AnalysisResults = {
    emotion: article.emotion,
    claims: article.claims,
    factcheck,
    bias: article.bias,
    summary: null,
  };
  results.summary = calculateSummary(results);
  return results;
}
