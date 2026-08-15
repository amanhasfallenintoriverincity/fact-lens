import type { AnalysisResults } from '@/types';
import { analyzeEmotion } from '@/utils/emotionAnalyzer';
import { extractClaims } from '@/utils/claimExtractor';
import { factCheckClaims } from '@/utils/factChecker';
import { analyzeBias } from '@/utils/biasAnalyzer';
import { calculateSummary } from '@/utils/summaryCalculator';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyze') {
    const tabId = sender.tab?.id;
    
    handleAnalysis(request.content)
      .then(result => {
        // 결과 저장
        chrome.storage.local.set({ lastAnalysisResults: result, timestamp: Date.now() });
        
        sendResponse({ success: true, data: result });
        
        // content script로 하이라이트 요청
        if (tabId && result.factcheck && result.factcheck.length > 0) {
          chrome.tabs.sendMessage(tabId, {
            action: 'highlightClaims',
            claims: result.factcheck.map(fc => ({
              text: fc.claim,
              status: fc.status,
              explanation: fc.explanation
            }))
          }).catch(err => console.log('highlight message error:', err));
        }
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'getLastResults') {
    chrome.storage.local.get(['lastAnalysisResults', 'timestamp'], (data) => {
      if (data.lastAnalysisResults) {
        sendResponse({ 
          success: true, 
          data: data.lastAnalysisResults,
          timestamp: data.timestamp
        });
      } else {
        sendResponse({ success: false, message: '분석 결과가 없습니다' });
      }
    });
    return true;
  }
  
  if (request.action === 'clearResults') {
    chrome.storage.local.remove(['lastAnalysisResults', 'timestamp']);
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'getSettings') {
    chrome.storage.sync.get(['geminiApiKey', 'kosisApiKey'], (settings) => {
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
});

async function handleAnalysis(content: string): Promise<AnalysisResults> {
  const results: AnalysisResults = {
    emotion: null,
    claims: null,
    factcheck: null,
    bias: null,
    summary: null
  };

  try {
    results.emotion = await analyzeEmotion(content);
    results.claims = await extractClaims(content);
    
    if (results.claims && results.claims.length > 0) {
      results.factcheck = await factCheckClaims(results.claims);
    }
    
    results.bias = await analyzeBias(content, results.emotion, results.factcheck);
    results.summary = calculateSummary(results);
    
    return results;
  } catch (error) {
    console.error('Analysis error:', error);
    throw error;
  }
}
