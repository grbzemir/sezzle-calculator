import type { Command } from './commands';

export interface KeyInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

const OPERATORS: Readonly<Record<string, string>> = {
  '+': '+',
  '-': '-',
  '*': '*',
  x: '*',
  X: '*',
  '/': '/',
  '^': '^',
};

/** Translates a physical key press into a calculator command, or null if it means nothing here. */
export function commandForKey({ key, ctrlKey, metaKey, altKey }: KeyInput): Command | null {
  if (ctrlKey || metaKey || altKey) return null; // leave browser shortcuts alone

  if (/^[0-9]$/.test(key)) return { type: 'insert', text: key, kind: 'digit' };
  if (key in OPERATORS) return { type: 'insert', text: OPERATORS[key], kind: 'operator' };

  switch (key) {
    case '.':
      return { type: 'decimal' };
    case ',':
      return { type: 'insert', text: ',', kind: 'separator' };
    case '(':
      return { type: 'insert', text: '(', kind: 'open' };
    case ')':
      return { type: 'insert', text: ')', kind: 'close' };
    case '%':
    case '!':
      return { type: 'insert', text: key, kind: 'postfix' };
    case 'Enter':
    case '=':
      return { type: 'evaluate' };
    case 'Backspace':
      return { type: 'backspace' };
    case 'Delete':
      return { type: 'clearEntry' };
    case 'Escape':
      return { type: 'allClear' };
    default:
      return null;
  }
}
