import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const FIXTURE = join(ROOT, 'tests', 'fixtures', 'article.html');
const LIVE_PROFILE = join(homedir(), '.config', 'google-chrome', 'Default');
const TEST_PROFILE = mkdtempSync(join(tmpdir(), 'fact-lens-e2e-'));
const TEST_DEFAULT = join(TEST_PROFILE, 'Default');
const CHROME = process.env.FACT_LENS_BROWSER
  || (existsSync('/usr/bin/brave-browser') ? '/usr/bin/brave-browser' : '/opt/google/chrome/chrome');
const TIMEOUT_MS = 180_000;

function sleep(ms) {
  return new Promise(resolvePromise => setTimeout(resolvePromise, ms));
}

function findExtensionId() {
  const preferences = JSON.parse(readFileSync(join(LIVE_PROFILE, 'Preferences'), 'utf8'));
  const settings = preferences?.extensions?.settings ?? {};
  for (const [id, info] of Object.entries(settings)) {
    if (resolve(String(info?.path ?? '')) === DIST) return id;
  }
  throw new Error(`Chrome 프로필에서 ${DIST} 확장 ID를 찾지 못했습니다.`);
}

function copyStoredSettings(extensionId) {
  mkdirSync(TEST_DEFAULT, { recursive: true });
  let copied = 0;
  for (const bucket of ['Local Extension Settings', 'Sync Extension Settings']) {
    const source = join(LIVE_PROFILE, bucket, extensionId);
    if (!existsSync(source)) continue;
    const target = join(TEST_DEFAULT, bucket, extensionId);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, {
      recursive: true,
      filter: sourcePath => !['LOCK', 'LOG', 'LOG.old'].includes(sourcePath.split('/').at(-1)),
    });
    copied += 1;
  }
  return copied;
}

class CDP {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = [];
  }

  async open() {
    await new Promise((resolveOpen, reject) => {
      this.socket.addEventListener('open', resolveOpen, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const handler of this.handlers) handler(message);
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolveSend, reject) => {
      this.pending.set(id, { resolve: resolveSend, reject });
      this.socket.send(JSON.stringify(payload));
    });
  }

  on(handler) {
    this.handlers.push(handler);
  }

  close() {
    this.socket.close();
  }
}

async function waitForFile(path, timeout = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (existsSync(path)) return;
    await sleep(100);
  }
  throw new Error(`${path} 생성 대기 시간 초과`);
}

async function waitForTarget(cdp, predicate, timeout = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const { targetInfos } = await cdp.send('Target.getTargets');
    const found = targetInfos.find(predicate);
    if (found) return found;
    await sleep(250);
  }
  throw new Error('대상 Chrome target을 찾지 못했습니다.');
}

async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }, sessionId);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime.evaluate 실패');
  }
  return result.result?.value;
}

async function waitFor(cdp, sessionId, expression, timeout = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await evaluate(cdp, sessionId, expression);
    if (value) return value;
    await sleep(250);
  }
  throw new Error(`조건 대기 시간 초과: ${expression}`);
}

const articleHtml = readFileSync(FIXTURE);
const server = createServer((_request, response) => {
  evidence.fixtureRequests += 1;
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(articleHtml);
});

let chrome;
let cdp;
let chromeError = '';
const evidence = {
  extensionId: null,
  storageBucketsCopied: 0,
  apiKeyConfigured: false,
  probes: null,
  triggerFound: false,
  fixtureRequests: 0,
  pageSnapshot: null,
  pageOutcome: null,
  dialogs: [],
  console: [],
  apiResponses: [],
  resultStored: false,
  resultSummary: null,
  highlightCount: 0,
  popup: null,
};

try {
  if (!existsSync(join(DIST, 'manifest.json'))) {
    throw new Error('dist/manifest.json이 없습니다. 먼저 npm run build가 필요합니다.');
  }

  evidence.extensionId = findExtensionId();
  evidence.storageBucketsCopied = copyStoredSettings(evidence.extensionId);

  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  const articleUrl = `http://news1.kr:${address.port}/article`;

  chrome = spawn(CHROME, [
    `--user-data-dir=${TEST_PROFILE}`,
    '--ozone-platform=x11',
    '--window-position=-10000,-10000',
    '--window-size=900,700',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-component-update',
    '--proxy-server=direct://',
    '--proxy-bypass-list=*',
    '--host-resolver-rules=MAP news1.kr 127.0.0.1',
    `--disable-extensions-except=${DIST}`,
    `--load-extension=${DIST}`,
    '--remote-debugging-port=0',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  chrome.stderr.on('data', chunk => { chromeError += String(chunk); });

  const activePortFile = join(TEST_PROFILE, 'DevToolsActivePort');
  await waitForFile(activePortFile);
  const [port] = readFileSync(activePortFile, 'utf8').split(/\r?\n/);
  const version = await fetch(`http://127.0.0.1:${port}/json/version`).then(response => response.json());
  cdp = new CDP(version.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send('Target.setDiscoverTargets', { discover: true });

  const { targetId: pageTargetId } = await cdp.send('Target.createTarget', { url: articleUrl });
  const { sessionId: pageSession } = await cdp.send('Target.attachToTarget', { targetId: pageTargetId, flatten: true });
  await Promise.all([
    cdp.send('Runtime.enable', {}, pageSession),
    cdp.send('Page.enable', {}, pageSession),
  ]);

  let workerSession = null;
  const responseBodies = new Map();
  cdp.on(async message => {
    if (message.method === 'Runtime.consoleAPICalled') {
      const args = (message.params.args ?? []).map(arg => arg.value ?? arg.description ?? '').join(' ');
      evidence.console.push({ session: message.sessionId === workerSession ? 'worker' : 'page', type: message.params.type, text: args.slice(0, 800) });
    }
    if (message.sessionId === pageSession && message.method === 'Page.javascriptDialogOpening') {
      evidence.dialogs.push(message.params.message);
      await cdp.send('Page.handleJavaScriptDialog', { accept: true }, pageSession).catch(() => {});
    }
    if (message.sessionId === workerSession && message.method === 'Network.responseReceived') {
      const { response, requestId } = message.params;
      if (response.url.includes('generativelanguage.googleapis.com')) {
        const item = { requestId, status: response.status, url: response.url, body: '' };
        evidence.apiResponses.push(item);
        responseBodies.set(requestId, item);
      }
    }
    if (message.sessionId === workerSession && message.method === 'Network.loadingFinished') {
      const item = responseBodies.get(message.params.requestId);
      if (!item) return;
      try {
        const body = await cdp.send('Network.getResponseBody', { requestId: message.params.requestId }, workerSession);
        const parsed = JSON.parse(String(body.body ?? '{}'));
        item.body = JSON.stringify({
          interactionStatus: parsed.status || null,
          error: parsed.error?.message || null,
          stepTypes: (parsed.steps || []).map(step => step.type),
          groundingToolCount: parsed.usage?.grounding_tool_count || [],
          outputTokens: parsed.usage?.total_output_tokens ?? null,
          thoughtTokens: parsed.usage?.total_thought_tokens ?? null,
        });
      } catch {}
    }
    if (message.sessionId === workerSession && message.method === 'Network.loadingFailed') {
      const item = responseBodies.get(message.params.requestId);
      if (item) item.body = `NETWORK_FAILED: ${message.params.errorText}`;
    }
  });

  await sleep(2_000);
  evidence.pageSnapshot = await evaluate(cdp, pageSession, `({
    url: location.href,
    title: document.title,
    readyState: document.readyState,
    articleCount: document.querySelectorAll('article').length,
    bodyTextLength: document.body?.innerText?.length || 0
  })`);

  const targetSnapshot = await cdp.send('Target.getTargets');
  evidence.targets = targetSnapshot.targetInfos.map(target => ({
    type: target.type,
    url: target.url,
    title: target.title,
  }));
  evidence.chromeStderr = chromeError.split(/\r?\n/).filter(Boolean).slice(-30);

  evidence.triggerFound = Boolean(await waitFor(
    cdp,
    pageSession,
    `Boolean(document.querySelector('.fact-lens-trigger-btn'))`,
    15_000,
  ));

  const workerTarget = await waitForTarget(
    cdp,
    target => target.type === 'service_worker' && target.url.includes(`chrome-extension://${evidence.extensionId}/background.js`),
    15_000,
  );
  ({ sessionId: workerSession } = await cdp.send('Target.attachToTarget', { targetId: workerTarget.targetId, flatten: true }));
  await Promise.all([
    cdp.send('Runtime.enable', {}, workerSession),
    cdp.send('Network.enable', {}, workerSession),
  ]);

  evidence.apiKeyConfigured = Boolean(await evaluate(
    cdp,
    workerSession,
    `new Promise(resolve => chrome.storage.sync.get(['geminiApiKey'], data => resolve(Boolean(data.geminiApiKey))))`,
  ));

  if (process.env.FACT_LENS_RUN_PROBES === '1' && evidence.apiKeyConfigured) {
    evidence.probes = await evaluate(cdp, workerSession, `(async () => {
      const key = await new Promise(resolve => chrome.storage.sync.get(['geminiApiKey'], data => resolve(data.geminiApiKey)));
      const endpoint = 'https://generativelanguage.googleapis.com/v1beta/interactions';
      async function probe(body) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
            'Api-Revision': '2026-05-20'
          },
          body: JSON.stringify(body)
        });
        const data = await response.json();
        const outputs = (data.steps || [])
          .filter(step => step.type === 'model_output')
          .flatMap(step => step.content || [])
          .filter(block => block.type === 'text')
          .map(block => block.text || '')
          .join('');
        return {
          httpStatus: response.status,
          interactionStatus: data.status || null,
          error: data.error?.message || null,
          stepTypes: (data.steps || []).map(step => step.type),
          outputPreview: outputs.slice(0, 300)
        };
      }
      return {
        flashLiteThinkingLevel: await probe({
          model: 'gemini-3.5-flash-lite',
          input: 'JSON으로 {"ok": true}만 반환하세요.',
          generation_config: { thinking_level: 'minimal', max_output_tokens: 256 },
          response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: {
              type: 'object',
              properties: { ok: { type: 'boolean' } },
              required: ['ok'],
              additionalProperties: false
            }
          },
          store: false
        }),
        flashLiteGoogleSearch: await probe({
          model: 'gemini-3.5-flash-lite',
          input: '반드시 Google Search 도구를 호출하여 대한민국의 수도가 어디인지 검색 근거와 함께 한 문장으로 답하세요.',
          tools: [{ type: 'google_search' }],
          store: false
        })
      };
    })()`);
  }

  await evaluate(cdp, pageSession, `document.querySelector('.fact-lens-trigger-btn').click(); true`);

  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    const state = await evaluate(cdp, pageSession, `(() => ({
      done: Boolean(document.querySelector('.fact-lens-done-badge')),
      shimmer: Boolean(document.querySelector('#fact-lens-shimmer')),
      buttonText: document.querySelector('.fact-lens-trigger-btn')?.textContent?.trim() || null
    }))()`);
    if (state.done) {
      evidence.pageOutcome = 'completed';
      break;
    }
    if (evidence.dialogs.length > 0 && !state.shimmer) {
      evidence.pageOutcome = 'error';
      break;
    }
    await sleep(500);
  }
  if (!evidence.pageOutcome) evidence.pageOutcome = 'timeout';

  evidence.resultSummary = await evaluate(
    cdp,
    workerSession,
    `new Promise(resolve => chrome.storage.local.get(['lastAnalysisResults', 'analysisState'], data => {
      const result = data.lastAnalysisResults;
      resolve({
        present: Boolean(result),
        emotionCount: Object.keys(result?.emotion || {}).length,
        claimCount: result?.claims?.length || 0,
        factcheckCount: result?.factcheck?.length || 0,
        citationUrlCount: (result?.factcheck || []).filter(item => Boolean(item.url)).length,
        unsupportedVerdictCount: (result?.factcheck || []).filter(
          item => item.status !== 'unverified' && !item.url,
        ).length,
        factcheckStatuses: (result?.factcheck || []).map(item => item.status),
        hasBias: Boolean(result?.bias),
        hasSummary: Boolean(result?.summary),
        state: data.analysisState?.status || null
      });
    }))`,
  );
  evidence.resultStored = Boolean(
    evidence.resultSummary?.present
    && evidence.resultSummary.emotionCount > 0
    && evidence.resultSummary.claimCount > 0
    && evidence.resultSummary.factcheckCount > 0
    && evidence.resultSummary.unsupportedVerdictCount === 0
    && evidence.resultSummary.hasBias
    && evidence.resultSummary.hasSummary
    && evidence.resultSummary.state === 'completed'
  );

  evidence.highlightCount = Number(await evaluate(
    cdp,
    pageSession,
    `document.querySelectorAll('.fact-lens-highlight').length`,
  ));

  const popupUrl = `chrome-extension://${evidence.extensionId}/src/popup/index.html`;
  const { targetId: popupTargetId } = await cdp.send('Target.createTarget', { url: popupUrl });
  const { sessionId: popupSession } = await cdp.send('Target.attachToTarget', {
    targetId: popupTargetId,
    flatten: true,
  });
  await Promise.all([
    cdp.send('Runtime.enable', {}, popupSession),
    cdp.send('Page.enable', {}, popupSession),
  ]);
  await waitFor(
    cdp,
    popupSession,
    `document.body?.innerText?.includes('신뢰도')`,
    15_000,
  );
  const claimTabPoint = await evaluate(cdp, popupSession, `(() => {
    const tab = [...document.querySelectorAll('[role="tab"]')]
      .find(button => button.textContent?.trim() === '주장');
    if (!tab) return null;
    const rect = tab.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  if (!claimTabPoint) throw new Error('popup에서 주장 탭을 찾지 못했습니다.');
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: claimTabPoint.x,
    y: claimTabPoint.y,
    button: 'left',
    clickCount: 1,
  }, popupSession);
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: claimTabPoint.x,
    y: claimTabPoint.y,
    button: 'left',
    clickCount: 1,
  }, popupSession);
  await waitFor(
    cdp,
    popupSession,
    `document.body?.innerText?.includes('팩트체크 결과')`,
    10_000,
  );
  const popupText = String(await evaluate(cdp, popupSession, `document.body?.innerText || ''`));
  evidence.popup = {
    rendered: popupText.includes('신뢰도') && popupText.includes('팩트체크 결과'),
    citationLinkCount: Number(await evaluate(
      cdp,
      popupSession,
      `document.querySelectorAll('a[href^="http"]').length`,
    )),
    textPreview: popupText.slice(0, 500),
  };

  console.log(JSON.stringify(evidence, null, 2));
  if (
    evidence.pageOutcome !== 'completed'
    || !evidence.resultStored
    || evidence.highlightCount < 1
    || !evidence.popup.rendered
    || (
      evidence.resultSummary?.citationUrlCount > 0
      && evidence.popup.citationLinkCount < 1
    )
  ) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ ...evidence, harnessError: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  cdp?.close();
  server.closeAllConnections?.();
  server.close();
  if (chrome && !chrome.killed) chrome.kill('SIGKILL');
  await sleep(300);
  rmSync(TEST_PROFILE, { recursive: true, force: true });
}

process.exit(process.exitCode ?? 0);
