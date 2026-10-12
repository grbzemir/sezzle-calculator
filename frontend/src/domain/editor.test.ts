import type { EditCommand, InsertKind } from './commands';
import { applyEdit, applyToResult, closeOpenParens } from './editor';

const insert = (text: string, kind: InsertKind): EditCommand => ({ type: 'insert', text, kind });

/** Runs one command against an expression. */
const run = (expression: string, command: EditCommand) => applyEdit(expression, command);

describe('digits', () => {
  it.each([
    ['', '5', '5'],
    ['5', '2', '52'],
    ['0', '5', '5'],
    ['10', '0', '100'],
    ['0.', '0', '0.0'],
    ['2+0', '7', '2+7'],
    [')', '2', ')*2'],
    ['pi', '2', 'pi*2'],
    ['5%', '2', '5%*2'],
    ['5!', '2', '5!*2'],
  ])('%j + digit %s -> %j', (expression, digit, expected) => {
    expect(run(expression, insert(digit, 'digit'))).toBe(expected);
  });
});

describe('operators', () => {
  it.each([
    ['5', '+', '5+'],
    ['5+', '*', '5*'], // replaces the previous operator
    ['5*', '-', '5-'],
    ['5', ' mod ', '5 mod '],
    ['5 mod ', '+', '5+'],
    ['5+', ' mod ', '5 mod '],
    ['', '+', '+'],
    ['', '-', '-'],
    ['', '*', '0*'],
    ['', ' mod ', '0 mod '],
    ['(', '-', '(-'],
    ['sin(', '-', 'sin(-'],
    ['(', '*', '('], // only a sign may follow "("
    ['(-', '+', '(-'], // a sign is not replaced by an operator
    ['-', '*', '-'],
    ['(5)', '^', '(5)^'],
  ])('%j + %j -> %j', (expression, operator, expected) => {
    expect(run(expression, insert(operator, 'operator'))).toBe(expected);
  });
});

describe('postfix operators', () => {
  it.each([
    ['5', '!', '5!'],
    ['5', '^2', '5^2'],
    ['(1+2)', '%', '(1+2)%'],
    ['pi', '^2', 'pi^2'],
    ['', '!', ''],
    ['5+', '%', '5+'],
    ['(', '^3', '('],
  ])('%j + %j -> %j', (expression, postfix, expected) => {
    expect(run(expression, insert(postfix, 'postfix'))).toBe(expected);
  });
});

describe('parentheses', () => {
  it.each([
    ['(5', ')', '(5)'],
    ['((5)', ')', '((5))'],
    ['5', ')', '5'], // nothing to close
    ['(', ')', '('], // empty group
    ['(5+', ')', '(5+'], // dangling operator
    ['(5)', ')', '(5)'],
  ])('%j + close -> %j', (expression, close, expected) => {
    expect(run(expression, insert(close, 'close'))).toBe(expected);
  });

  it('closeOpenParens appends the missing closing parentheses', () => {
    expect(closeOpenParens('sin(30')).toBe('sin(30)');
    expect(closeOpenParens('((1')).toBe('((1))');
    expect(closeOpenParens('(1)')).toBe('(1)');
    expect(closeOpenParens('1)')).toBe('1)');
    expect(closeOpenParens('')).toBe('');
  });
});

describe('functions, groups and constants', () => {
  it.each([
    ['', 'sin(', 'function', 'sin('],
    ['2', 'sin(', 'function', '2*sin('],
    ['2+', 'sqrt(', 'function', '2+sqrt('],
    ['(2)', '(', 'open', '(2)*('],
    ['sin(', '(', 'open', 'sin(('],
    ['5', 'pi', 'constant', '5*pi'],
    ['pi', 'e', 'constant', 'pi*e'],
    ['', 'e', 'constant', 'e'],
    ['2*', 'pi', 'constant', '2*pi'],
    ['3', 'root(', 'open', '3*root('],
    ['4', 'e^(', 'function', '4*e^('],
  ])('%j + %j -> %j', (expression, text, kind, expected) => {
    expect(run(expression, insert(text, kind as InsertKind))).toBe(expected);
  });
});

describe('decimal point', () => {
  it.each([
    ['', '0.'],
    ['5', '5.'],
    ['5.', '5.'],
    ['5.2', '5.2'],
    ['5+', '5+0.'],
    ['1.5+2', '1.5+2.'],
    [')', ')*0.'],
    ['(', '(0.'],
  ])('%j -> %j', (expression, expected) => {
    expect(run(expression, { type: 'decimal' })).toBe(expected);
  });
});

describe('comma', () => {
  it.each([
    ['round(4.67', 'round(4.67,'], // argument separator inside a call
    ['round(4', 'round(4,'],
    ['4', '4.'], // outside a call it is a decimal comma
    ['4.67', '4.67'],
    ['(4', '(4.'],
    ['round((4', 'round((4.'], // innermost group is not a call
    ['root(8)+4', 'root(8)+4.'],
  ])('%j -> %j', (expression, expected) => {
    expect(run(expression, insert(',', 'separator'))).toBe(expected);
  });
});

describe('backspace', () => {
  it.each([
    ['', ''],
    ['12', '1'],
    ['5+', '5'],
    ['sin(', ''],
    ['2*sin(', '2*'],
    ['2*asin(', '2*'],
    ['log2(', ''],
    ['5 mod ', '5'],
    ['pi', ''],
    ['2*pi', '2*'],
    ['(-', '('],
    ['e^(', 'e^'],
    ['10^(', '10^'],
    ['2e', '2'],
  ])('%j -> %j', (expression, expected) => {
    expect(run(expression, { type: 'backspace' })).toBe(expected);
  });
});

describe('clear entry', () => {
  it.each([
    ['12+345', '12+'],
    ['345', ''],
    ['2*3.5', '2*'],
    ['12+', '12'], // no number being typed: behaves like backspace
    ['sin(', ''],
    ['', ''],
  ])('%j -> %j', (expression, expected) => {
    expect(run(expression, { type: 'clearEntry' })).toBe(expected);
  });
});

describe('change sign', () => {
  it.each([
    ['5', '(-5)'],
    ['2*5', '2*(-5)'],
    ['2*(-5)', '2*5'],
    ['(-5)', '5'],
    ['1.5', '(-1.5)'],
    ['', '(-'],
    ['5+', '5+(-'],
    ['(2+3)', '(2+3)'], // groups are left alone
    ['pi', 'pi'],
  ])('%j -> %j', (expression, expected) => {
    expect(run(expression, { type: 'toggleSign' })).toBe(expected);
  });
});

describe('reciprocal', () => {
  it.each([
    ['4', '1/(4)'],
    ['2+4', '2+1/(4)'],
    ['pi', '1/(pi)'],
    ['2*e', '2*1/(e)'],
    ['', '1/('],
    ['2+', '2+1/('],
    ['(2+3)', '(2+3)'],
  ])('%j -> %j', (expression, expected) => {
    expect(run(expression, { type: 'reciprocal' })).toBe(expected);
  });
});

describe('applyToResult', () => {
  it.each<[string, string, EditCommand, string]>([
    ['digit starts fresh', '30', insert('5', 'digit'), '5'],
    ['decimal starts fresh', '30', { type: 'decimal' }, '0.'],
    ['constant starts fresh', '30', insert('pi', 'constant'), 'pi'],
    ['open group starts fresh', '30', insert('(', 'open'), '('],
    ['function wraps the result', '30', insert('sin(', 'function'), 'sin(30'],
    ['function wraps a negative result', '-30', insert('abs(', 'function'), 'abs(-30'],
    ['operator continues', '30', insert('+', 'operator'), '30+'],
    ['operator continues from negative', '-5', insert('+', 'operator'), '(-5)+'],
    ['postfix continues', '-5', insert('^2', 'postfix'), '(-5)^2'],
    ['reciprocal wraps', '4', { type: 'reciprocal' }, '1/(4)'],
    ['clear entry clears', '30', { type: 'clearEntry' }, ''],
    ['sign flips positive', '30', { type: 'toggleSign' }, '-30'],
    ['sign flips negative', '-30', { type: 'toggleSign' }, '30'],
    ['backspace edits the result text', '30', { type: 'backspace' }, '3'],
  ])('%s', (_name, result, command, expected) => {
    expect(applyToResult(result, command)).toBe(expected);
  });
});
