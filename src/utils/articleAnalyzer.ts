import type { BiasAnalysis, Claim, EmotionScores } from '@/types';
import { GeminiInteractionError, parseInteractionJson, requestInteraction } from './geminiInteractions';
import { FACT_LENS_MODEL } from './models';

export const EMOTION_LABELS = [
  '불평/불만', '환영/호의', '감동/감탄', '지긋지긋', '고마움', '슬픔',
  '화남/분노', '존경', '기대감', '우쭐댐/무시함', '안타까움/실망', '비장함',
  '의심/불신', '뿌듯함', '편안/쾌적', '신기함/관심', '아껴주는', '부끄러움',
  '공포/무서움', '절망', '한심함', '역겨움/징그러움', '짜증', '어이없음',
  '없음', '패배/자기혐오', '귀찮음', '힘듦/지침', '즐거움/신남', '깨달음',
  '죄책감', '증오/혐오', '흐뭇함(귀여움/예쁨)', '당황/난처', '경악',
  '부담/안_내킴', '서러움', '재미없음', '불쌍함/연민', '놀람', '행복',
  '불안/걱정', '기쁨', '안심/신뢰',
] as const;

interface RawArticleAnalysis {
  emotions: Array<{ label: string; score: number }>;
  claims: Array<{ text: string; searchQuery: string }>;
  bias?: BiasAnalysis;
  factRatio?: number;
  opinionRatio?: number;
  missingContext?: string[];
  frame?: string;
  biasScore?: number;
}

export interface ArticleAnalysis {
  emotion: EmotionScores;
  claims: Claim[];
  bias: BiasAnalysis;
}

const ARTICLE_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    emotions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          score: { type: 'integer' },
        },
        required: ['label', 'score'],
      },
    },
    claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          searchQuery: { type: 'string' }
        },
        required: ['text', 'searchQuery']
      }
    },
    factRatio: { type: 'integer' },
    opinionRatio: { type: 'integer' },
    missingContext: { type: 'array', items: { type: 'string' } },
    frame: { type: 'string' },
    biasScore: { type: 'integer' },
  },
  required: [
    'emotions',
    'claims',
    'factRatio',
    'opinionRatio',
    'missingContext',
    'frame',
    'biasScore',
  ],
} as const;

function clampScore(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, Math.round(number))) : fallback;
}

function normalizeAnalysis(raw: RawArticleAnalysis): ArticleAnalysis {
  if (!Array.isArray(raw.emotions)) {
    throw new GeminiInteractionError('Gemini 기사 분석 응답의 필수 필드가 없습니다.');
  }

  const emotion: EmotionScores = {};
  for (const item of raw.emotions.slice(0, 5)) {
    if (EMOTION_LABELS.includes(item.label as typeof EMOTION_LABELS[number])) {
      emotion[item.label] = clampScore(item.score);
    }
  }
  if (Object.keys(emotion).length === 0) {
    throw new GeminiInteractionError('Gemini 감정 분석 결과가 비어 있습니다.');
  }

  const claims = [...new Set((Array.isArray(raw.claims) ? raw.claims : [])
    .map(claim => ({
      text: String(claim.text || '').trim(),
      searchQuery: String(claim.searchQuery || '').trim()
    }))
    .filter(claim => claim.text.length >= 8 && claim.searchQuery.length >= 3))]
    .slice(0, 5);

  const fact = clampScore(raw.bias?.factOpinionRatio?.fact ?? raw.factRatio, 50);
  const opinion = clampScore(raw.bias?.factOpinionRatio?.opinion ?? raw.opinionRatio, 100 - fact);
  const bias: BiasAnalysis = {
    factOpinionRatio: { fact, opinion },
    missingContext: Array.isArray(raw.bias?.missingContext ?? raw.missingContext)
      ? (raw.bias?.missingContext ?? raw.missingContext ?? []).map(String).filter(Boolean).slice(0, 5)
      : [],
    frame: String(raw.bias?.frame ?? raw.frame ?? '중립'),
    biasScore: clampScore(raw.bias?.biasScore ?? raw.biasScore, 50),
  };

  return { emotion, claims, bias };
}

export async function analyzeArticle(
  content: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ArticleAnalysis> {
  const response = await requestInteraction(apiKey, {
    model: FACT_LENS_MODEL,
    system_instruction: `당신은 한국어 뉴스 분석 전문가입니다. 기사에 실제로 드러난 표현만 근거로 감정, 검증 가능한 주장, 편향성을 동시에 분석하세요.

검증 가능한 주장은 다음 형식으로 추출하세요:
- text: 원문 문장을 가능한 한 그대로 보존
- searchQuery: 3-5개의 핵심 키워드만 추출 (짧고 간결하게)

예시:
- text: "시는 이 현수막이 태극기를 거꾸로 그린 것으로 오해할 소지가 있다고 판단해 전날 현수막을 철거했다."
- searchQuery: "태극기 오해 철거"

- text: "지난 14일 코스피는 전주 대비 719.17포인트(11.49%) 오른 6,977.94로 장을 마쳤다."
- searchQuery: "코스피 상승 마감"

searchQuery는 반드시 3-5개의 핵심 명사/동사만 포함하고, 조사/어미/수치/날짜는 제거하세요.

최대 5개만 추출하세요. 감정은 다음 라벨 중 상위 1~5개만 고르세요: ${EMOTION_LABELS.join(', ')}. factRatio와 opinionRatio의 합은 100이어야 합니다.`,
    input: `다음 뉴스 기사를 분석하세요.\n\n${content.slice(0, 12_000)}`,
    generation_config: {
      thinking_level: 'minimal',
      max_output_tokens: 2048,
    },
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: ARTICLE_ANALYSIS_SCHEMA,
    },
    store: false,
  }, fetchImpl);

  return normalizeAnalysis(parseInteractionJson<RawArticleAnalysis>(response));
}
