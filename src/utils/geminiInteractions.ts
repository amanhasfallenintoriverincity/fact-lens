const INTERACTIONS_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const API_REVISION = '2026-05-20';

export interface InteractionRequest {
  model: string;
  input: unknown;
  store?: boolean;
  system_instruction?: string;
  generation_config?: Record<string, unknown>;
  response_format?: Record<string, unknown>;
  tools?: Array<Record<string, unknown>>;
}

export interface InteractionResponse {
  status?: string;
  error?: { message?: string; code?: string };
  usage?: {
    total_output_tokens?: number;
    total_thought_tokens?: number;
  };
  steps?: Array<Record<string, any>>;
}

export class GeminiInteractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiInteractionError';
  }
}

export function getInteractionOutputText(response: InteractionResponse): string {
  const text = (response.steps || [])
    .filter(step => step.type === 'model_output')
    .flatMap(step => Array.isArray(step.content) ? step.content : [])
    .filter(block => block?.type === 'text')
    .map(block => String(block.text || ''))
    .join('')
    .trim();

  if (!text) {
    throw new GeminiInteractionError('Gemini 응답에 최종 model_output 텍스트가 없습니다.');
  }

  return text;
}

export function parseInteractionJson<T>(response: InteractionResponse): T {
  const text = getInteractionOutputText(response)
    .replace(/^```json\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GeminiInteractionError(
      `Gemini JSON 응답을 파싱할 수 없습니다: ${text.slice(0, 160)}`,
    );
  }
}

export async function requestInteraction(
  apiKey: string,
  request: InteractionRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<InteractionResponse> {
  const response = await fetchImpl(INTERACTIONS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
      'Api-Revision': API_REVISION,
    },
    body: JSON.stringify(request),
  });

  const data = await response.json() as InteractionResponse;

  if (!response.ok || data.error) {
    throw new GeminiInteractionError(
      `Gemini API 오류 (${response.status}): ${data.error?.message || '알 수 없는 오류'}`,
    );
  }

  if (data.status !== 'completed') {
    throw new GeminiInteractionError(
      `Gemini 응답이 완료되지 않았습니다 (status: ${data.status || 'unknown'}, `
      + `출력 토큰: ${data.usage?.total_output_tokens ?? 0}, `
      + `사고 토큰: ${data.usage?.total_thought_tokens ?? 0}).`,
    );
  }

  return data;
}
