import type { Claim, FactCheckResult } from '@/types';
import {
  GeminiInteractionError,
  parseInteractionJson,
  requestInteraction,
  type InteractionResponse,
} from './geminiInteractions';
import { FACT_LENS_MODEL } from './models';

interface RawFactCheckResult {
  claim: string;
  status: 'verified' | 'unverified' | 'false';
  explanation: string;
}

interface RawFactCheckResponse {
  results: RawFactCheckResult[];
}

interface Citation {
  title: string;
  url: string;
  citedText: string;
}

const FACT_CHECK_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          status: { type: 'string', enum: ['verified', 'unverified', 'false'] },
          explanation: { type: 'string' },
        },
        required: ['claim', 'status', 'explanation'],
      },
    },
  },
  required: ['results'],
} as const;

function extractCitations(response: InteractionResponse): Citation[] {
  const citations: Citation[] = [];
  for (const step of response.steps || []) {
    if (step.type !== 'model_output' || !Array.isArray(step.content)) continue;
    for (const block of step.content) {
      if (block?.type !== 'text' || !Array.isArray(block.annotations)) continue;
      const text = String(block.text || '');
      for (const annotation of block.annotations) {
        if (annotation?.type !== 'url_citation' || !annotation.url) continue;
        const start = Number(annotation.start_index ?? annotation.startIndex ?? 0);
        const end = Number(annotation.end_index ?? annotation.endIndex ?? start);
        citations.push({
          title: String(annotation.title || new URL(annotation.url).hostname),
          url: String(annotation.url),
          citedText: text.slice(start, end),
        });
      }
    }
  }

  return citations.filter((citation, index, all) =>
    all.findIndex(other => other.url === citation.url) === index,
  );
}

function normalizeStatus(status: string): FactCheckResult['status'] {
  return status === 'verified' || status === 'false' ? status : 'unverified';
}

export async function factCheckClaims(
  claims: Claim[],
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FactCheckResult[]> {
  if (claims.length === 0) return [];

  const claimList = claims.slice(0, 5).map((claim, index) => `${index + 1}. ${claim.text}`).join('\n');
  const interactionRequest = {
    model: FACT_LENS_MODEL,
    system_instruction: `당신은 근거 중심 팩트체커입니다. 반드시 Google Search 도구를 사용하여 각 주장을 별도로 검증하세요. 검색하지 않은 사전지식만으로 verified 또는 false를 판단하면 안 됩니다. 충분한 근거가 없거나 출처가 상충하면 unverified로 표시하세요. claim에는 입력 문장을 그대로 복사하세요.`,
    input: `아래 주장을 모두 팩트체크하세요.\n\n${claimList}`,
    tools: [{ type: 'google_search' }],
    generation_config: {
      thinking_level: 'minimal',
      max_output_tokens: 4096,
    },
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: FACT_CHECK_SCHEMA,
    },
    store: false,
  };

  let response: InteractionResponse | null = null;
  let parsed: RawFactCheckResponse | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    response = await requestInteraction(apiKey, interactionRequest, fetchImpl);
    if (!(response.steps || []).some(step => step.type === 'google_search_call')) {
      throw new GeminiInteractionError('Google Search grounding이 실행되지 않아 팩트체크를 완료할 수 없습니다.');
    }

    try {
      parsed = parseInteractionJson<RawFactCheckResponse>(response);
      break;
    } catch (error) {
      const isMalformedJson = error instanceof GeminiInteractionError
        && error.message.startsWith('Gemini JSON 응답을 파싱할 수 없습니다:');
      if (!isMalformedJson || attempt === 1) throw error;
    }
  }

  if (!response || !parsed || !Array.isArray(parsed.results)) {
    throw new GeminiInteractionError('팩트체크 결과 배열이 없습니다.');
  }

  const citations = extractCitations(response);
  return claims.slice(0, 5).map((claim, index) => {
    const raw = parsed.results.find(result => result.claim.trim() === claim.text.trim())
      || parsed.results[index];
    if (!raw) {
      return {
        claim: claim.text,
        status: 'unverified',
        source: 'Google Search',
        explanation: '이 주장에 대한 개별 검증 결과와 인용 URL이 반환되지 않았습니다.',
        url: null,
      };
    }

    const relatedCitation = citations.find(citation =>
      citation.citedText.includes(claim.text.slice(0, 12))
      || citation.citedText.includes(raw.explanation.slice(0, 12)),
    );
    const hasBoundCitation = Boolean(relatedCitation?.url);
    const explanation = String(raw.explanation || '검증 설명이 없습니다.');

    return {
      claim: claim.text,
      status: hasBoundCitation ? normalizeStatus(raw.status) : 'unverified',
      source: relatedCitation?.title || 'Google Search',
      explanation: hasBoundCitation
        ? explanation
        : `인용 URL을 해당 주장에 연결하지 못해 판정을 보류합니다. ${explanation}`,
      url: relatedCitation?.url || null,
    };
  });
}
