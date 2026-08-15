export interface EmotionScores {
  [emotion: string]: number;
}

export interface Claim {
  text: string;
}

export interface FactCheckResult {
  claim: string;
  status: 'verified' | 'unverified' | 'false';
  source: string | null;
  explanation: string;
  url: string | null;
}

export interface BiasAnalysis {
  factOpinionRatio: {
    fact: number;
    opinion: number;
  };
  missingContext: string[];
  frame: string;
  biasScore: number;
}

export interface SummaryScores {
  trust: number;
  emotional: number;
  bias: number;
}

export interface AnalysisResults {
  emotion: EmotionScores | null;
  claims: Claim[] | null;
  factcheck: FactCheckResult[] | null;
  bias: BiasAnalysis | null;
  summary: SummaryScores | null;
}

export interface Settings {
  geminiApiKey?: string;
  kosisApiKey?: string;
}
