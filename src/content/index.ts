// Content Script - 기사 내용 추출 + 인라인 분석 + Claim 하이라이트

const NEWS_SELECTORS: Record<string, string[]> = {
  'news.naver.com': ['#dic_area', '._article_content', '.news_end', '#articleBodyContents'],
  'news.daum.net': ['.article_view', '#harmonyContainer', '.news_view', '#mArticle'],
  'chosun.com': ['.article-body', '#article-body', '.article__content'],
  'joongang.co.kr': ['.article_body', '#article_content', '.article_content'],
  'donga.com': ['.article_txt', '#articleBody', '.view_txt'],
  'hani.co.kr': ['.article-text', '#aGtBody', '.article-body'],
  'hankyung.com': ['.article-body', '#articletext', '.news_srl'],
  'mk.co.kr': ['.article-body', '#article_body', '.left_article'],
  'kyunghyang.com': ['.article_body', '#article_content'],
  'seoul.co.kr': ['.article', '#article_content', '.article-body'],
  'munhwa.com': ['.article-view-content', '#article-body'],
  'segye.com': ['.article_view', '#article_content'],
  'yna.co.kr': ['.article-body', '#articleBody', '.story-news-body'],
  'news.kbs.co.kr': ['.article_body', '#article_body'],
  'imbc.com': ['.article-body', '#article-body'],
  'news.sbs.co.kr': ['.news_content', '#news_content'],
};

const GENERIC_SELECTORS = [
  '[itemprop="articleBody"]', 'article [itemprop="text"]', 'article',
  '.article-body', '.article_body', '.article-content', '.article_content',
  '.news-body', '.news_body', '.news-content', '.news_content',
  '.post-content', '.entry-content',
  '#article-body', '#article_body', '#articleBody', '#articleContent',
  '#content-body', '.story-body', '.view-content', '.post-body', '.entry-body',
];

// ============================================================
// 스타일 주입 (글라스모피즘 적용)
// ============================================================

function ensureStyles() {
  if (document.getElementById('fact-lens-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'fact-lens-styles';
  style.textContent = `
    /* 트리거 버튼 - 글라스모피즘 */
    .fact-lens-trigger-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 20px;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
      color: #1a1a1a !important;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 12px 0;
      position: relative;
      z-index: 10;
    }
    .fact-lens-trigger-btn:hover {
      background: rgba(255, 255, 255, 0.85);
      box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.25);
      transform: translateY(-2px);
    }
    .fact-lens-trigger-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .fact-lens-trigger-btn svg {
      width: 16px;
      height: 16px;
    }

    /* Shimmer overlay - 글라스모피즘 */
    .fact-lens-shimmer-overlay {
      position: absolute;
      inset: 0;
      z-index: 100;
      pointer-events: none;
      background: rgba(255, 255, 255, 0.3);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      overflow: hidden;
      border-radius: 8px;
    }
    .fact-lens-shimmer-overlay::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(102, 126, 234, 0.2) 20%,
        rgba(118, 75, 162, 0.3) 50%,
        rgba(102, 126, 234, 0.2) 80%,
        transparent 100%
      );
      animation: fact-lens-shimmer 1.8s ease-in-out infinite;
    }
    @keyframes fact-lens-shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    /* Shimmer 중앙 로딩 텍스트 - 글라스모피즘 */
    .fact-lens-shimmer-label {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 101;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.4);
      box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.2);
      padding: 12px 24px;
      border-radius: 24px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      color: #667eea;
      display: flex;
      align-items: center;
      gap: 10px;
      pointer-events: none;
    }
    .fact-lens-shimmer-spinner {
      width: 18px;
      height: 18px;
      border: 2.5px solid rgba(229, 231, 235, 0.5);
      border-top-color: #667eea;
      border-radius: 50%;
      animation: fact-lens-spin 0.8s linear infinite;
    }
    @keyframes fact-lens-spin {
      to { transform: rotate(360deg); }
    }

    /* 형광펜 */
    .fact-lens-highlight {
      background: linear-gradient(180deg, transparent 55%, rgba(255, 235, 59, 0.5) 55%);
      cursor: pointer;
      position: relative;
      transition: background 0.2s;
      padding: 0 1px;
      border-radius: 2px;
    }
    .fact-lens-highlight:hover {
      background: linear-gradient(180deg, transparent 55%, rgba(255, 235, 59, 0.85) 55%);
    }
    .fact-lens-highlight.verified {
      background: linear-gradient(180deg, transparent 55%, rgba(76, 175, 80, 0.45) 55%);
    }
    .fact-lens-highlight.verified:hover {
      background: linear-gradient(180deg, transparent 55%, rgba(76, 175, 80, 0.8) 55%);
    }
    .fact-lens-highlight.unverified {
      background: linear-gradient(180deg, transparent 55%, rgba(255, 152, 0, 0.45) 55%);
    }
    .fact-lens-highlight.unverified:hover {
      background: linear-gradient(180deg, transparent 55%, rgba(255, 152, 0, 0.8) 55%);
    }
    .fact-lens-highlight.false {
      background: linear-gradient(180deg, transparent 55%, rgba(244, 67, 54, 0.45) 55%);
    }
    .fact-lens-highlight.false:hover {
      background: linear-gradient(180deg, transparent 55%, rgba(244, 67, 54, 0.8) 55%);
    }

    /* 툴팁 - 글라스모피즘 */
    .fact-lens-tooltip {
      position: fixed;
      background: rgba(255, 255, 255, 0.4);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.5);
      box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.25);
      border-radius: 16px;
      padding: 20px 24px;
      max-width: 360px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .fact-lens-tooltip-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 16px;
    }
    .fact-lens-tooltip-header-icon {
      font-size: 20px;
    }
    .fact-lens-tooltip-status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 12px;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    .fact-lens-tooltip-status.verified { 
      background: rgba(220, 252, 231, 0.8); 
      color: #166534; 
      border: 1px solid rgba(187, 247, 208, 0.5);
    }
    .fact-lens-tooltip-status.unverified { 
      background: rgba(254, 243, 199, 0.8); 
      color: #92400e; 
      border: 1px solid rgba(253, 224, 71, 0.5);
    }
    .fact-lens-tooltip-status.false { 
      background: rgba(254, 226, 226, 0.8); 
      color: #991b1b; 
      border: 1px solid rgba(254, 202, 202, 0.5);
    }
    .fact-lens-tooltip-claim {
      font-size: 14px;
      line-height: 1.6;
      color: #374151;
      margin-bottom: 12px;
      font-weight: 500;
    }
    .fact-lens-tooltip-explanation {
      font-size: 13px;
      line-height: 1.5;
      color: #6b7280;
      padding-top: 12px;
      border-top: 1px solid rgba(243, 244, 246, 0.5);
    }

    /* 분석 완료 뱃지 - 글라스모피즘 */
    .fact-lens-done-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 20px;
      background: rgba(240, 253, 244, 0.7);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(187, 247, 208, 0.5);
      box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
      color: #166534;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 12px 0;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    .fact-lens-done-badge:hover {
      background: rgba(220, 252, 231, 0.8);
      box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
    }
  `;
  document.head.appendChild(style);
}

// ============================================================
// 기사 추출
// ============================================================

function extractFromMeta(): { title: string; description: string } {
  return {
    title: document.querySelector('meta[property="og:title"]')?.getAttribute('content')
        || document.querySelector('meta[name="title"]')?.getAttribute('content')
        || document.title,
    description: document.querySelector('meta[property="og:description"]')?.getAttribute('content')
              || document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
  };
}

function extractFromJsonLd(): string | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || '');
      const article = Array.isArray(data)
        ? data.find(item => item['@type'] === 'NewsArticle' || item['@type'] === 'Article')
        : (data['@type'] === 'NewsArticle' || data['@type'] === 'Article') ? data : null;
      if (article?.articleBody) return article.articleBody;
    } catch (e) { /* ignore */ }
  }
  return null;
}

function extractBySiteSelectors(): string | null {
  const hostname = window.location.hostname;
  for (const [domain, selectors] of Object.entries(NEWS_SELECTORS)) {
    if (hostname.includes(domain)) {
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el?.textContent && el.textContent.trim().length > 200) return el.textContent.trim();
      }
    }
  }
  return null;
}

function extractByGenericSelectors(): string | null {
  for (const selector of GENERIC_SELECTORS) {
    const el = document.querySelector(selector);
    if (el?.textContent && el.textContent.trim().length > 200) return el.textContent.trim();
  }
  return null;
}

function extractArticleContent(): string {
  return extractFromJsonLd()
    || extractBySiteSelectors()
    || extractByGenericSelectors()
    || document.body.textContent?.substring(0, 5000)
    || '';
}

function findArticleElement(): Element | null {
  const hostname = window.location.hostname;
  for (const [domain, selectors] of Object.entries(NEWS_SELECTORS)) {
    if (hostname.includes(domain)) {
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) return el;
      }
    }
  }
  for (const selector of GENERIC_SELECTORS) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return null;
}

// ============================================================
// Shimmer 효과
// ============================================================

function showShimmer(articleEl: Element) {
  removeShimmer();
  
  const computed = window.getComputedStyle(articleEl);
  if (computed.position === 'static') {
    (articleEl as HTMLElement).style.position = 'relative';
  }
  
  const overlay = document.createElement('div');
  overlay.className = 'fact-lens-shimmer-overlay';
  overlay.id = 'fact-lens-shimmer';
  
  const label = document.createElement('div');
  label.className = 'fact-lens-shimmer-label';
  label.innerHTML = `
    <div class="fact-lens-shimmer-spinner"></div>
    AI가 기사를 분석하고 있습니다...
  `;
  overlay.appendChild(label);
  
  articleEl.appendChild(overlay);
}

function removeShimmer() {
  document.getElementById('fact-lens-shimmer')?.remove();
}

// ============================================================
// 분석 실행
// ============================================================

async function runAnalysis() {
  const content = extractArticleContent();
  if (!content || content.length < 100) {
    alert('기사 내용을 추출할 수 없습니다.');
    return;
  }
  
  const articleEl = findArticleElement();
  if (!articleEl) return;
  
  const btn = document.querySelector('.fact-lens-trigger-btn') as HTMLButtonElement;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `
      <div class="fact-lens-shimmer-spinner" style="width:14px;height:14px;border-width:2px;"></div>
      분석 중...
    `;
  }
  
  showShimmer(articleEl);
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'analyze',
      url: window.location.href,
      content: content,
    });
    
    if (!response.success) {
      throw new Error(response.error || '분석 중 오류가 발생했습니다.');
    }
    
    removeShimmer();
    
    if (response.data.factcheck && response.data.factcheck.length > 0) {
      highlightClaims(articleEl, response.data.factcheck.map((fc: any) => ({
        text: fc.claim,
        status: fc.status,
        explanation: fc.explanation,
      })));
    }
    
    if (btn) {
      const badge = document.createElement('div');
      badge.className = 'fact-lens-done-badge';
      badge.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        분석 완료! 확장 프로그램 아이콘에서 상세 결과 확인
      `;
      badge.title = '확장 프로그램 아이콘을 클릭하면 상세 결과를 볼 수 있습니다';
      btn.replaceWith(badge);
    }
    
  } catch (error) {
    removeShimmer();
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        Fact Lens로 팩트체크
      `;
    }
    alert(`분석 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

// ============================================================
// 텍스트 매칭 + 형광펜
// ============================================================

function normalize(text: string): string {
  return text.replace(/\s+/g, '').replace(/[\s\u00A0\u200B\u2002\u2003]/g, '').toLowerCase();
}

function extractSearchChunks(claim: string): string[] {
  const normalized = normalize(claim);
  if (normalized.length < 10) return [normalized];
  const chunks: string[] = [normalized];
  for (const windowSize of [25, 20, 15]) {
    if (normalized.length <= windowSize) continue;
    for (let i = 0; i <= normalized.length - windowSize; i += Math.floor(windowSize / 2)) {
      chunks.push(normalized.substring(i, i + windowSize));
    }
  }
  const parts = claim.split(/[.!?。]/).map(s => normalize(s)).filter(s => s.length >= 10);
  chunks.push(...parts);
  return chunks;
}

function findMatchInArticle(
  articleElement: Element,
  claim: string
): { textNode: Text; startIndex: number; matchLength: number } | null {
  const chunks = extractSearchChunks(claim);
  
  const walker = document.createTreeWalker(articleElement, NodeFilter.SHOW_TEXT, null);
  const textNodes: Text[] = [];
  let node;
  while (node = walker.nextNode()) {
    if ((node as Text).textContent?.trim()) textNodes.push(node as Text);
  }
  
  interface NodeMapping {
    textNode: Text;
    originalText: string;
    normalizedText: string;
    indexMap: number[];
  }
  
  const mappings: NodeMapping[] = textNodes.map(textNode => {
    const originalText = textNode.textContent || '';
    const normalizedText = normalize(originalText);
    const indexMap: number[] = [];
    let normIdx = 0;
    for (let origIdx = 0; origIdx < originalText.length; origIdx++) {
      if (!/[\s\u00A0\u200B\u2002\u2003]/.test(originalText[origIdx])) {
        indexMap[normIdx] = origIdx;
        normIdx++;
      }
    }
    indexMap[normIdx] = originalText.length;
    return { textNode, originalText, normalizedText, indexMap };
  });
  
  for (const chunk of chunks) {
    if (chunk.length < 8) continue;
    for (const mapping of mappings) {
      const idx = mapping.normalizedText.indexOf(chunk);
      if (idx === -1) continue;
      const origStart = mapping.indexMap[idx] ?? 0;
      const origEnd = mapping.indexMap[idx + chunk.length] ?? mapping.originalText.length;
      const matchLength = origEnd - origStart;
      if (matchLength < 5) continue;
      return { textNode: mapping.textNode, startIndex: origStart, matchLength };
    }
  }
  
  const articleText = (articleElement as HTMLElement).innerText || '';
  const sentences = articleText.split(/(?<=[.!?。])\s*/).filter(s => s.trim().length > 10);
  const claimWords = new Set(
    claim.replace(/[^\uac00-\ud7a3a-zA-Z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1)
  );
  
  let bestSentence = '';
  let bestScore = 0;
  
  for (const sentence of sentences) {
    const sentenceWords = new Set(
      sentence.replace(/[^\uac00-\ud7a3a-zA-Z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1)
    );
    if (claimWords.size === 0 || sentenceWords.size === 0) continue;
    let common = 0;
    for (const word of claimWords) if (sentenceWords.has(word)) common++;
    const score = common / Math.max(claimWords.size, sentenceWords.size);
    if (score > bestScore) { bestScore = score; bestSentence = sentence; }
  }
  
  if (bestScore >= 0.2 && bestSentence.length >= 10) {
    for (const mapping of mappings) {
      const idx = mapping.originalText.indexOf(bestSentence);
      if (idx !== -1) {
        return { textNode: mapping.textNode, startIndex: idx, matchLength: bestSentence.length };
      }
    }
  }
  
  return null;
}

function highlightClaims(
  articleElement: Element,
  claims: Array<{ text: string; status?: string; explanation?: string }>
) {
  for (const claim of claims) {
    if (claim.text.trim().length < 10) continue;
    const match = findMatchInArticle(articleElement, claim.text);
    if (!match) continue;
    
    const { textNode, startIndex, matchLength } = match;
    const nodeText = textNode.textContent || '';
    const before = nodeText.substring(0, startIndex);
    const matched = nodeText.substring(startIndex, startIndex + matchLength);
    const after = nodeText.substring(startIndex + matchLength);
    
    const span = document.createElement('span');
    span.className = `fact-lens-highlight ${claim.status || ''}`;
    span.textContent = matched;
    span.dataset.claim = claim.text;
    span.dataset.status = claim.status || 'unverified';
    span.dataset.explanation = claim.explanation || '';
    
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      showTooltip(e.currentTarget as HTMLElement);
    });
    
    const parent = textNode.parentNode;
    if (parent) {
      if (before) parent.insertBefore(document.createTextNode(before), textNode);
      parent.insertBefore(span, textNode);
      if (after) parent.insertBefore(document.createTextNode(after), textNode);
      parent.removeChild(textNode);
    }
  }
}

function clearHighlights() {
  document.querySelectorAll('.fact-lens-highlight').forEach(span => {
    const parent = span.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(span.textContent || ''), span);
      parent.normalize();
    }
  });
  document.querySelector('.fact-lens-tooltip')?.remove();
}

function showTooltip(element: HTMLElement) {
  document.querySelector('.fact-lens-tooltip')?.remove();
  
  const claim = element.dataset.claim || '';
  const status = element.dataset.status || 'unverified';
  const explanation = element.dataset.explanation || '';
  
  const statusIcon = status === 'verified' ? '✅' : status === 'false' ? '❌' : '⚠️';
  const statusText = status === 'verified' ? '검증됨' : status === 'false' ? '거짓' : '미확인';
  
  const tooltip = document.createElement('div');
  tooltip.className = 'fact-lens-tooltip';
  tooltip.innerHTML = `
    <div class="fact-lens-tooltip-header">
      <span class="fact-lens-tooltip-header-icon">🔍</span>
      <span>팩트체크 결과</span>
    </div>
    <div class="fact-lens-tooltip-status ${status}">
      ${statusIcon} ${statusText}
    </div>
    <div class="fact-lens-tooltip-claim">${claim}</div>
    ${explanation ? `<div class="fact-lens-tooltip-explanation">${explanation}</div>` : ''}
  `;
  
  const rect = element.getBoundingClientRect();
  tooltip.style.left = `${Math.min(rect.left, window.innerWidth - 380)}px`;
  tooltip.style.top = `${rect.bottom + 12}px`;
  document.body.appendChild(tooltip);
  
  setTimeout(() => {
    const close = (e: Event) => {
      if (!tooltip.contains(e.target as Node) && e.target !== element) {
        tooltip.remove();
        document.removeEventListener('click', close);
      }
    };
    document.addEventListener('click', close);
  }, 100);
}

// ============================================================
// 버튼 삽입
// ============================================================

function insertTriggerButton() {
  if (document.querySelector('.fact-lens-trigger-btn') || document.querySelector('.fact-lens-done-badge')) return;
  
  const articleEl = findArticleElement();
  if (!articleEl) return;
  
  ensureStyles();
  
  const btn = document.createElement('button');
  btn.className = 'fact-lens-trigger-btn';
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.35-4.35"/>
    </svg>
    Fact Lens로 팩트체크
  `;
  btn.addEventListener('click', runAnalysis);
  
  articleEl.parentElement?.insertBefore(btn, articleEl);
}

// ============================================================
// 뉴스 사이트 감지
// ============================================================

function isNewsSite(): boolean {
  const hostname = window.location.hostname;
  const newsDomains = [
    'news.naver.com', 'news.daum.net', 'chosun.com', 'joongang.co.kr',
    'donga.com', 'hani.co.kr', 'hankyung.com', 'mk.co.kr', 'kyunghyang.com',
    'seoul.co.kr', 'munhwa.com', 'segye.com', 'yna.co.kr', 'news.kbs.co.kr',
    'imbc.com', 'news.sbs.co.kr', 'edaily.co.kr', 'sedaily.com', 'dt.co.kr',
    'fnnews.com', 'newsis.com', 'news1.kr', 'inews24.com', 'ohmynews.com',
    'thebell.co.kr', 'biz.heraldcorp.com', 'news.heraldcorp.com',
  ];
  return newsDomains.some(domain => hostname.includes(domain));
}

if (isNewsSite()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', insertTriggerButton);
  } else {
    setTimeout(insertTriggerButton, 1000);
  }
}

// ============================================================
// 메시지 리스너
// ============================================================

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'getArticleContent') {
    sendResponse({
      success: true,
      data: extractArticleContent(),
      title: extractFromMeta().title,
      url: window.location.href,
    });
  }
  
  if (request.action === 'clearHighlights') {
    clearHighlights();
    sendResponse({ success: true });
  }
});
