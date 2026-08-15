import { useState } from 'react';
import type { AnalysisResults } from '@/types';

export function useAnalysis() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      // 현재 탭에서 기사 내용 추출
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.id) {
        throw new Error('활성 탭을 찾을 수 없습니다.');
      }

      const contentResponse = await chrome.tabs.sendMessage(tab.id, { 
        action: 'getArticleContent' 
      });

      if (!contentResponse.success) {
        throw new Error('기사 내용을 추출할 수 없습니다.');
      }

      const content = contentResponse.data;

      if (!content || content.length < 100) {
        throw new Error('분석할 기사 내용이 충분하지 않습니다.');
      }

      // 분석 요청 (tabId 포함)
      const analysisResponse = await chrome.runtime.sendMessage({
        action: 'analyze',
        tabId: tab.id,
        url: tab.url,
        content: content
      });

      if (!analysisResponse.success) {
        throw new Error(analysisResponse.error || '분석 중 오류가 발생했습니다.');
      }

      setResults(analysisResponse.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return { loading, results, error, analyze };
}
