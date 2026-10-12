import { applyEdit, applyToResult } from '../domain/editor';
import type { EditCommand } from '../domain/commands';
import { asOperand, formatResult, prettifyExpression } from '../domain/format';
import type { AngleMode, HistoryEntry } from '../types/calculator';

export type Phase = 'editing' | 'loading' | 'result' | 'error';

export interface CalculatorState {
  /** Canonical expression being edited, or the one that produced `result`. */
  expression: string;
  phase: Phase;
  /** Formatted result, only while phase is "result". */
  result: string | null;
  /** Backend or network message, only while phase is "error". */
  error: string | null;
  angleMode: AngleMode;
  memory: number | null;
  history: HistoryEntry[];
  nextHistoryId: number;
}

export type CalculatorAction =
  | { type: 'edit'; command: EditCommand }
  | { type: 'evaluating' }
  | { type: 'evaluated'; expression: string; value: number; angleMode: AngleMode }
  | { type: 'failed'; message: string }
  | { type: 'allClear' }
  | { type: 'toggleAngleMode' }
  | { type: 'memoryAdjust'; delta: number }
  | { type: 'memoryClear' }
  | { type: 'historyReuse'; entry: HistoryEntry; part: 'expression' | 'result' }
  | { type: 'historyClear' };

export const MAX_HISTORY = 20;

export function createInitialState(): CalculatorState {
  return {
    expression: '',
    phase: 'editing',
    result: null,
    error: null,
    angleMode: 'deg',
    memory: null,
    history: [],
    nextHistoryId: 1,
  };
}

export function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  switch (action.type) {
    case 'edit': {
      if (state.phase === 'loading') return state;
      const expression =
        state.phase === 'result' && state.result !== null
          ? applyToResult(state.result, action.command)
          : applyEdit(state.expression, action.command);
      return { ...state, expression, phase: 'editing', result: null, error: null };
    }

    case 'evaluating':
      return { ...state, phase: 'loading', error: null };

    case 'evaluated': {
      const result = formatResult(action.value);
      const entry: HistoryEntry = {
        id: state.nextHistoryId,
        expression: action.expression,
        result,
        angleMode: action.angleMode,
      };
      return {
        ...state,
        expression: action.expression,
        phase: 'result',
        result,
        error: null,
        history: [entry, ...state.history].slice(0, MAX_HISTORY),
        nextHistoryId: state.nextHistoryId + 1,
      };
    }

    case 'failed':
      return { ...state, phase: 'error', result: null, error: action.message };

    case 'allClear':
      return { ...state, expression: '', phase: 'editing', result: null, error: null };

    case 'toggleAngleMode':
      return { ...state, angleMode: state.angleMode === 'deg' ? 'rad' : 'deg' };

    case 'memoryAdjust':
      return { ...state, memory: (state.memory ?? 0) + action.delta };

    case 'memoryClear':
      return { ...state, memory: null };

    case 'historyReuse':
      return action.part === 'expression'
        ? {
            ...state,
            expression: action.entry.expression,
            angleMode: action.entry.angleMode,
            phase: 'editing',
            result: null,
            error: null,
          }
        : {
            ...state,
            expression: asOperand(action.entry.result),
            phase: 'editing',
            result: null,
            error: null,
          };

    case 'historyClear':
      return { ...state, history: [] };
  }
}

export interface DisplayModel {
  /** Large line. */
  primary: string;
  /** Small line above it. */
  secondary: string;
}

/** What the screen shows for a state; kept pure so it is trivial to test. */
export function selectDisplay(state: CalculatorState): DisplayModel {
  switch (state.phase) {
    case 'result':
      return { primary: state.result ?? '0', secondary: `${prettifyExpression(state.expression)} =` };
    case 'error':
      return { primary: 'Error', secondary: prettifyExpression(state.expression) };
    default:
      return { primary: prettifyExpression(state.expression) || '0', secondary: '' };
  }
}
