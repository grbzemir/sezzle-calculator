import type { EditCommand } from '../domain/commands';
import type { HistoryEntry } from '../types/calculator';
import {
  calculatorReducer,
  createInitialState,
  MAX_HISTORY,
  selectDisplay,
  type CalculatorAction,
  type CalculatorState,
} from './calculatorReducer';

const digit = (text: string): EditCommand => ({ type: 'insert', text, kind: 'digit' });
const operator = (text: string): EditCommand => ({ type: 'insert', text, kind: 'operator' });

function reduce(state: CalculatorState, ...actions: CalculatorAction[]): CalculatorState {
  return actions.reduce(calculatorReducer, state);
}

const evaluated = (expression: string, value: number): CalculatorAction => ({
  type: 'evaluated',
  expression,
  value,
  angleMode: 'deg',
});

describe('calculatorReducer', () => {
  it('starts empty, in degrees, with no memory', () => {
    expect(createInitialState()).toMatchObject({
      expression: '',
      phase: 'editing',
      result: null,
      error: null,
      angleMode: 'deg',
      memory: null,
      history: [],
    });
  });

  it('edits the expression', () => {
    const state = reduce(
      createInitialState(),
      { type: 'edit', command: digit('2') },
      { type: 'edit', command: operator('+') },
      { type: 'edit', command: digit('3') },
    );
    expect(state.expression).toBe('2+3');
    expect(state.phase).toBe('editing');
  });

  it('ignores edits while a request is in flight', () => {
    const loading = reduce(
      createInitialState(),
      { type: 'edit', command: digit('2') },
      { type: 'evaluating' },
    );
    expect(reduce(loading, { type: 'edit', command: digit('3') })).toBe(loading);
  });

  describe('after a result', () => {
    const afterResult = () =>
      reduce(
        createInitialState(),
        { type: 'edit', command: digit('3') },
        { type: 'edit', command: operator('+') },
        { type: 'edit', command: digit('4') },
        evaluated('3+4', 7),
      );

    it('stores the formatted result and the expression that produced it', () => {
      expect(afterResult()).toMatchObject({ phase: 'result', result: '7', expression: '3+4' });
    });

    it('continues from the result when an operator is pressed', () => {
      const state = reduce(afterResult(), { type: 'edit', command: operator('*') });
      expect(state).toMatchObject({ expression: '7*', phase: 'editing', result: null });
    });

    it('starts fresh when a digit is pressed', () => {
      const state = reduce(afterResult(), { type: 'edit', command: digit('9') });
      expect(state.expression).toBe('9');
    });

    it('wraps the result when a function is pressed', () => {
      const state = reduce(afterResult(), {
        type: 'edit',
        command: { type: 'insert', text: 'sqrt(', kind: 'function' },
      });
      expect(state.expression).toBe('sqrt(7');
    });

    it('cleans floating point noise from displayed results', () => {
      const state = reduce(createInitialState(), evaluated('0.1+0.2', 0.1 + 0.2));
      expect(state.result).toBe('0.3');
    });
  });

  it('records history newest first with increasing ids', () => {
    const state = reduce(createInitialState(), evaluated('1+1', 2), evaluated('2+2', 4));

    expect(state.history.map((entry) => [entry.id, entry.expression, entry.result])).toEqual([
      [2, '2+2', '4'],
      [1, '1+1', '2'],
    ]);
  });

  it('keeps only the most recent entries', () => {
    let state = createInitialState();
    for (let i = 0; i < MAX_HISTORY + 5; i++) state = reduce(state, evaluated(`${i}+0`, i));

    expect(state.history).toHaveLength(MAX_HISTORY);
    expect(state.history[0].expression).toBe(`${MAX_HISTORY + 4}+0`);
  });

  it('keeps the expression on failure so it can be fixed', () => {
    const state = reduce(
      createInitialState(),
      { type: 'edit', command: digit('1') },
      { type: 'edit', command: operator('/') },
      { type: 'edit', command: digit('0') },
      { type: 'evaluating' },
      { type: 'failed', message: 'division by zero is not allowed' },
    );
    expect(state).toMatchObject({
      phase: 'error',
      expression: '1/0',
      error: 'division by zero is not allowed',
      result: null,
    });

    const fixed = reduce(state, { type: 'edit', command: { type: 'backspace' } });
    expect(fixed).toMatchObject({ phase: 'editing', expression: '1/', error: null });
  });

  it('all clear resets the entry but keeps memory, history and angle mode', () => {
    const state = reduce(
      createInitialState(),
      evaluated('1+1', 2),
      { type: 'memoryAdjust', delta: 5 },
      { type: 'toggleAngleMode' },
      { type: 'allClear' },
    );
    expect(state).toMatchObject({
      expression: '',
      phase: 'editing',
      result: null,
      memory: 5,
      angleMode: 'rad',
    });
    expect(state.history).toHaveLength(1);
  });

  it('toggles the angle mode back and forth', () => {
    const rad = reduce(createInitialState(), { type: 'toggleAngleMode' });
    expect(rad.angleMode).toBe('rad');
    expect(reduce(rad, { type: 'toggleAngleMode' }).angleMode).toBe('deg');
  });

  it('adjusts and clears memory', () => {
    const state = reduce(
      createInitialState(),
      { type: 'memoryAdjust', delta: 5 },
      { type: 'memoryAdjust', delta: -2 },
    );
    expect(state.memory).toBe(3);
    expect(reduce(state, { type: 'memoryClear' }).memory).toBeNull();
  });

  describe('history reuse', () => {
    const entry: HistoryEntry = { id: 1, expression: 'sin(30)', result: '-0.5', angleMode: 'rad' };

    it('restores the expression and its angle mode', () => {
      const state = reduce(createInitialState(), { type: 'historyReuse', entry, part: 'expression' });
      expect(state).toMatchObject({ expression: 'sin(30)', angleMode: 'rad', phase: 'editing' });
    });

    it('restores the result as a safe operand', () => {
      const state = reduce(createInitialState(), { type: 'historyReuse', entry, part: 'result' });
      expect(state.expression).toBe('(-0.5)');
    });

    it('clears the history', () => {
      const state = reduce(createInitialState(), evaluated('1+1', 2), { type: 'historyClear' });
      expect(state.history).toEqual([]);
    });
  });
});

describe('selectDisplay', () => {
  it('shows 0 for an empty expression', () => {
    expect(selectDisplay(createInitialState())).toEqual({ primary: '0', secondary: '' });
  });

  it('shows the pretty expression while editing', () => {
    const state = reduce(
      createInitialState(),
      { type: 'edit', command: digit('2') },
      { type: 'edit', command: operator('*') },
      { type: 'edit', command: digit('3') },
    );
    expect(selectDisplay(state)).toEqual({ primary: '2 × 3', secondary: '' });
  });

  it('shows the result with its expression above it', () => {
    const state = reduce(createInitialState(), evaluated('2*3', 6));
    expect(selectDisplay(state)).toEqual({ primary: '6', secondary: '2 × 3 =' });
  });

  it('shows Error with the offending expression', () => {
    const state = reduce(
      createInitialState(),
      { type: 'edit', command: digit('1') },
      { type: 'failed', message: 'boom' },
    );
    expect(selectDisplay(state)).toEqual({ primary: 'Error', secondary: '1' });
  });
});
