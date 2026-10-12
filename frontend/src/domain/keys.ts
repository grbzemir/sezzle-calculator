import type { Command, InsertKind, MemoryOperation } from './commands';

export type KeyVariant = 'digit' | 'operator' | 'equals' | 'control' | 'function' | 'memory' | 'mode';

export interface KeyDefinition {
  id: string;
  label: string;
  /** Spoken name for screen readers. */
  ariaLabel: string;
  variant: KeyVariant;
  command: Command;
  /** Grid columns / rows the key occupies. */
  columnSpan?: number;
  rowSpan?: number;
}

const insert = (text: string, kind: InsertKind): Command => ({ type: 'insert', text, kind });
const memory = (operation: MemoryOperation): Command => ({ type: 'memory', operation });

const digit = (value: string): KeyDefinition => ({
  id: `digit-${value}`,
  label: value,
  ariaLabel: value,
  variant: 'digit',
  command: insert(value, 'digit'),
});

const operator = (id: string, label: string, ariaLabel: string, text: string): KeyDefinition => ({
  id,
  label,
  ariaLabel,
  variant: 'operator',
  command: insert(text, 'operator'),
});

const fn = (
  id: string,
  label: string,
  ariaLabel: string,
  command: Command,
  variant: KeyVariant = 'function',
): KeyDefinition => ({ id, label, ariaLabel, variant, command });

/**
 * Keys are data, not markup: adding a key means adding an entry here. The
 * keypad component renders whatever it is given (Open/Closed Principle).
 */

/** Basic keypad, 4 columns. */
export const BASIC_KEYS: readonly KeyDefinition[] = [
  fn('all-clear', 'AC', 'All clear', { type: 'allClear' }, 'control'),
  fn('clear-entry', 'CE', 'Clear entry', { type: 'clearEntry' }, 'control'),
  fn('backspace', '⌫', 'Backspace', { type: 'backspace' }, 'control'),
  operator('divide', '÷', 'Divide', '/'),

  fn('open-paren', '(', 'Open parenthesis', insert('(', 'open'), 'control'),
  fn('close-paren', ')', 'Close parenthesis', insert(')', 'close'), 'control'),
  fn('percent', '%', 'Percent', insert('%', 'postfix'), 'control'),
  operator('multiply', '×', 'Multiply', '*'),

  digit('7'),
  digit('8'),
  digit('9'),
  operator('subtract', '−', 'Subtract', '-'),

  digit('4'),
  digit('5'),
  digit('6'),
  operator('add', '+', 'Add', '+'),

  digit('1'),
  digit('2'),
  digit('3'),
  { id: 'equals', label: '=', ariaLabel: 'Equals', variant: 'equals', command: { type: 'evaluate' }, rowSpan: 2 },

  fn('toggle-sign', '±', 'Change sign', { type: 'toggleSign' }, 'digit'),
  digit('0'),
  fn('decimal', '.', 'Decimal point', { type: 'decimal' }, 'digit'),
];

/** Scientific keypad, 6 columns. */
export const SCIENTIFIC_KEYS: readonly KeyDefinition[] = [
  fn('memory-clear', 'MC', 'Memory clear', memory('clear'), 'memory'),
  fn('memory-recall', 'MR', 'Memory recall', memory('recall'), 'memory'),
  fn('memory-add', 'M+', 'Add to memory', memory('add'), 'memory'),
  fn('memory-subtract', 'M−', 'Subtract from memory', memory('subtract'), 'memory'),
  fn('pi', 'π', 'Pi', insert('pi', 'constant')),
  fn('euler', 'e', 'Euler’s number', insert('e', 'constant')),

  fn('modulo', 'mod', 'Modulo', insert(' mod ', 'operator')),
  fn('factorial', 'x!', 'Factorial', insert('!', 'postfix')),
  fn('reciprocal', '1/x', 'Reciprocal', { type: 'reciprocal' }),
  fn('absolute', '|x|', 'Absolute value', insert('abs(', 'function')),
  fn('round', 'round', 'Round', insert('round(', 'open')),
  fn('log2', 'log₂', 'Logarithm base 2', insert('log2(', 'function')),

  fn('square', 'x²', 'Square', insert('^2', 'postfix')),
  fn('cube', 'x³', 'Cube', insert('^3', 'postfix')),
  fn('power', 'xʸ', 'Power', insert('^', 'operator')),
  fn('exp', 'eˣ', 'e to the power', insert('e^(', 'function')),
  fn('ten-power', '10ˣ', 'Ten to the power', insert('10^(', 'function')),
  fn('floor', '⌊x⌋', 'Round down', insert('floor(', 'function')),

  fn('sqrt', '√x', 'Square root', insert('sqrt(', 'function')),
  fn('cbrt', '∛x', 'Cube root', insert('cbrt(', 'function')),
  fn('root', 'ʸ√x', 'Nth root', insert('root(', 'open')),
  fn('ln', 'ln', 'Natural logarithm', insert('ln(', 'function')),
  fn('log', 'log', 'Logarithm base 10', insert('log(', 'function')),
  fn('ceil', '⌈x⌉', 'Round up', insert('ceil(', 'function')),

  fn('sin', 'sin', 'Sine', insert('sin(', 'function')),
  fn('cos', 'cos', 'Cosine', insert('cos(', 'function')),
  fn('tan', 'tan', 'Tangent', insert('tan(', 'function')),
  fn('sinh', 'sinh', 'Hyperbolic sine', insert('sinh(', 'function')),
  fn('cosh', 'cosh', 'Hyperbolic cosine', insert('cosh(', 'function')),
  fn('tanh', 'tanh', 'Hyperbolic tangent', insert('tanh(', 'function')),

  fn('asin', 'sin⁻¹', 'Inverse sine', insert('asin(', 'function')),
  fn('acos', 'cos⁻¹', 'Inverse cosine', insert('acos(', 'function')),
  fn('atan', 'tan⁻¹', 'Inverse tangent', insert('atan(', 'function')),
  fn('comma', ',', 'Argument separator', insert(',', 'separator')),
  {
    id: 'angle-mode',
    label: 'DEG',
    ariaLabel: 'Angle unit',
    variant: 'mode',
    command: { type: 'toggleAngleMode' },
    columnSpan: 2,
  },
];
