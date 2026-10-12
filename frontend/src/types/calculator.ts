export type AngleMode = 'deg' | 'rad';

export interface EvaluateRequest {
  expression: string;
  angleMode: AngleMode;
}

export interface EvaluateResponse {
  expression: string;
  angleMode: AngleMode;
  result: number;
}

export interface HistoryEntry {
  id: number;
  /** Canonical (ASCII) expression exactly as it was sent to the backend. */
  expression: string;
  /** Result formatted for display. */
  result: string;
  angleMode: AngleMode;
}
