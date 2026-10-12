import { useCallback, useLayoutEffect, useReducer, useRef } from 'react';
import { isEditCommand, type Command, type MemoryOperation } from '../domain/commands';
import { closeOpenParens } from '../domain/editor';
import { asOperand, formatResult } from '../domain/format';
import { ApiError, type CalculatorApi } from '../services/calculatorApi';
import {
  calculatorReducer,
  createInitialState,
  selectDisplay,
} from '../state/calculatorReducer';
import type { HistoryEntry } from '../types/calculator';

/**
 * Connects the pure state machine to the backend. Components call `execute`
 * with a Command and render `state`; they never touch the network or the
 * editing rules themselves.
 */
export function useCalculator(api: CalculatorApi) {
  const [state, dispatch] = useReducer(calculatorReducer, undefined, createInitialState);

  // Async handlers read the latest state through a ref instead of a stale closure.
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  });

  // Identifies the one request whose answer may still change the screen. Clearing
  // it (see cancelPending) makes a late answer harmless instead of overwriting
  // whatever the user has done since.
  const pending = useRef<symbol | null>(null);
  const cancelPending = useCallback(() => {
    pending.current = null;
  }, []);

  /** Evaluates what is on screen. Resolves to the numeric result, or null if there is none. */
  const evaluate = useCallback(async (): Promise<number | null> => {
    const { expression, phase, result, angleMode } = stateRef.current;
    if (phase === 'loading') return null;
    if (phase === 'result' && result !== null) return Number(result);
    if (expression.trim() === '') return null;

    const closed = closeOpenParens(expression);
    const ticket = Symbol('evaluate');
    pending.current = ticket;
    dispatch({ type: 'evaluating' });
    try {
      const response = await api.evaluate({ expression: closed, angleMode });
      if (pending.current !== ticket) return null; // cancelled while waiting
      pending.current = null;
      dispatch({ type: 'evaluated', expression: closed, value: response.result, angleMode });
      return response.result;
    } catch (error) {
      if (pending.current !== ticket) return null;
      pending.current = null;
      const message =
        error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
      dispatch({ type: 'failed', message });
      return null;
    }
  }, [api]);

  const applyMemory = useCallback(
    async (operation: MemoryOperation) => {
      switch (operation) {
        case 'clear':
          dispatch({ type: 'memoryClear' });
          return;
        case 'recall': {
          const { memory } = stateRef.current;
          if (memory === null) return;
          dispatch({
            type: 'edit',
            command: { type: 'insert', text: asOperand(formatResult(memory)), kind: 'constant' },
          });
          return;
        }
        case 'add':
        case 'subtract': {
          const value = await evaluate();
          if (value === null) return;
          dispatch({ type: 'memoryAdjust', delta: operation === 'add' ? value : -value });
        }
      }
    },
    [evaluate],
  );

  const execute = useCallback(
    (command: Command) => {
      if (isEditCommand(command)) {
        dispatch({ type: 'edit', command });
        return;
      }
      switch (command.type) {
        case 'evaluate':
          void evaluate();
          return;
        case 'memory':
          void applyMemory(command.operation);
          return;
        case 'allClear':
          cancelPending();
          dispatch({ type: 'allClear' });
          return;
        case 'toggleAngleMode':
          dispatch({ type: 'toggleAngleMode' });
      }
    },
    [evaluate, applyMemory, cancelPending],
  );

  const reuseHistory = useCallback(
    (entry: HistoryEntry, part: 'expression' | 'result') => {
      cancelPending();
      dispatch({ type: 'historyReuse', entry, part });
    },
    [cancelPending],
  );

  const clearHistory = useCallback(() => dispatch({ type: 'historyClear' }), []);

  return {
    state,
    display: selectDisplay(state),
    execute,
    reuseHistory,
    clearHistory,
  };
}
