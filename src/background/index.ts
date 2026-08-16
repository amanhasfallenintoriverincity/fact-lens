import { runAnalysisPipeline } from '@/utils/analysisPipeline';

interface AnalysisState {
  status: 'idle' | 'running' | 'completed' | 'error';
  message: string;
  startedAt?: number;
  completedAt?: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 분석 오류가 발생했습니다.';
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'analyze') {
    void (async () => {
      const startedAt = Date.now();
      try {
        if (typeof request.content !== 'string' || request.content.trim().length < 100) {
          throw new Error('분석할 기사 본문이 너무 짧습니다.');
        }

        const settings = await chrome.storage.sync.get(['geminiApiKey']);
        if (!settings.geminiApiKey) {
          throw new Error('Gemini API 키가 설정되지 않았습니다. 확장 프로그램 설정에서 API 키를 저장해주세요.');
        }

        const runningState: AnalysisState = {
          status: 'running',
          message: 'Gemini 3.5 Flash-Lite가 기사 구조를 분석하고 있습니다.',
          startedAt,
        };
        await chrome.storage.local.remove(['lastAnalysisResults', 'timestamp', 'lastAnalysisError']);
        await chrome.storage.local.set({ analysisState: runningState });

        const result = await runAnalysisPipeline(request.content, settings.geminiApiKey);
        const completedAt = Date.now();
        const completedState: AnalysisState = {
          status: 'completed',
          message: '분석이 완료되었습니다.',
          startedAt,
          completedAt,
        };

        await chrome.storage.local.set({
          lastAnalysisResults: result,
          timestamp: completedAt,
          analysisState: completedState,
        });
        sendResponse({ success: true, data: result });
      } catch (error) {
        const message = errorMessage(error);
        console.error('[Fact Lens] Analysis failed:', message, error);
        const failedState: AnalysisState = {
          status: 'error',
          message,
          startedAt,
          completedAt: Date.now(),
        };
        await chrome.storage.local.set({
          analysisState: failedState,
          lastAnalysisError: message,
        });
        sendResponse({ success: false, error: message });
      }
    })();
    return true;
  }

  if (request.action === 'getLastResults') {
    void (async () => {
      const data = await chrome.storage.local.get([
        'lastAnalysisResults',
        'timestamp',
        'analysisState',
        'lastAnalysisError',
      ]);
      if (data.lastAnalysisResults) {
        sendResponse({
          success: true,
          data: data.lastAnalysisResults,
          timestamp: data.timestamp,
          state: data.analysisState,
        });
        return;
      }

      sendResponse({
        success: false,
        status: data.analysisState?.status || 'idle',
        message: data.lastAnalysisError
          || data.analysisState?.message
          || '분석 결과가 없습니다.',
      });
    })();
    return true;
  }

  if (request.action === 'clearResults') {
    void chrome.storage.local.remove([
      'lastAnalysisResults',
      'timestamp',
      'analysisState',
      'lastAnalysisError',
    ]);
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'getSettings') {
    chrome.storage.sync.get(['geminiApiKey'], settings => {
      sendResponse(settings);
    });
    return true;
  }

  if (request.action === 'saveSettings') {
    chrome.storage.sync.set(request.settings, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  return false;
});
