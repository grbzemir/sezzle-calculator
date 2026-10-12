import type { KeyDefinition } from './keys';
import { BASIC_KEYS, SCIENTIFIC_KEYS } from './keys';

const cells = (keys: readonly KeyDefinition[]) =>
  keys.reduce((total, key) => total + (key.columnSpan ?? 1) * (key.rowSpan ?? 1), 0);

describe('key definitions', () => {
  it('fill their grids exactly (no gaps, no overflow)', () => {
    expect(cells(BASIC_KEYS)).toBe(4 * 6);
    expect(cells(SCIENTIFIC_KEYS)).toBe(6 * 6);
  });

  it('have unique ids across both keypads', () => {
    const ids = [...BASIC_KEYS, ...SCIENTIFIC_KEYS].map((key) => key.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('give every key a label and a spoken name', () => {
    for (const key of [...BASIC_KEYS, ...SCIENTIFIC_KEYS]) {
      expect(key.label).not.toBe('');
      expect(key.ariaLabel).not.toBe('');
    }
  });

  it('include all ten digits and the four required operators', () => {
    const inserted = BASIC_KEYS.flatMap((key) =>
      key.command.type === 'insert' ? [key.command.text] : [],
    );
    for (const text of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '-', '*', '/']) {
      expect(inserted).toContain(text);
    }
  });

  it('cover every required scientific function', () => {
    const inserted = SCIENTIFIC_KEYS.flatMap((key) =>
      key.command.type === 'insert' ? [key.command.text] : [],
    );
    for (const text of [
      'sin(', 'cos(', 'tan(', 'asin(', 'acos(', 'atan(', 'sinh(', 'cosh(', 'tanh(',
      'sqrt(', 'cbrt(', 'root(', 'ln(', 'log(', 'log2(', 'e^(', '10^(',
      'abs(', 'round(', 'floor(', 'ceil(', '!', '^2', '^3', '^', ' mod ', 'pi', 'e',
    ]) {
      expect(inserted).toContain(text);
    }
  });

  it('offer the four memory operations', () => {
    const operations = SCIENTIFIC_KEYS.flatMap((key) =>
      key.command.type === 'memory' ? [key.command.operation] : [],
    );
    expect(operations.sort()).toEqual(['add', 'clear', 'recall', 'subtract']);
  });
});
