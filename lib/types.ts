export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ClauseType =
  | 'termination'
  | 'liability'
  | 'ip'
  | 'payment'
  | 'nda'
  | 'indemnification'
  | 'governing_law'
  | 'other';

export interface ContractRow {
  id: string;
  user_id: string | null;
  filename: string;
  raw_text: string;
  storage_path: string | null;
  created_at: string;
}

export interface ClauseRow {
  id: string;
  contract_id: string;
  clause_number: number;
  original_text: string;
  clause_type: string | null;
  page_number: number | null;
}

export interface AnalysisRow {
  id: string;
  clause_id: string;
  risk_level: RiskLevel | null;
  plain_english: string | null;
  flags: string[] | null;
  counter_proposal: string | null;
  rewritten_text: string | null;
  market_comparison: string | null;
}

export interface ClauseAnalysis {
  risk_level: RiskLevel;
  plain_english: string;
  flags: string[];
  counter_proposal: string;
  rewritten_text: string;
  market_comparison: string;
}

export interface LibraryMatch {
  id: string;
  title: string;
  standard_text: string;
  guidance: string;
  severity_hint: RiskLevel | null;
  similarity: number;
}

export interface ClauseMatch {
  id: string;
  clause_number: number;
  clause_type: string | null;
  original_text: string;
  similarity: number;
}

export type SSEEvent =
  | {
      type: 'clause_done';
      clauseId: string;
      clauseNumber: number;
      analysis: ClauseAnalysis & { clause_type: string };
    }
  | {
      type: 'summary_done';
      overallRisk: number;
      topFlags: string[];
      totalClauses: number;
    }
  | { type: 'error'; message: string };

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface UploadResponse {
  contractId: string;
  clauseCount: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}
