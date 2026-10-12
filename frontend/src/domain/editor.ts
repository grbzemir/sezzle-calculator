import type { EditCommand, InsertKind } from './commands';
import { asOperand } from './format';

/*
 * Pure functions that edit the canonical expression text. Canonical text is
 * plain ASCII ("2*3", "pi", "sqrt(") exactly as the backend parses it.
 * Nothing here knows about React, state or the network.
 */

const OPERAND_END = /(?:[0-9.)!%]|pi|e)$/;
const TRAILING_NUMBER = /(?:\d+\.?\d*|\.\d+)$/;
const FUNCTION_OPENER = /[a-z][a-z0-9]*\($/;
const TRAILING_OPERATOR = /^(.*?)(\s*mod\s*|[+\-*/^])$/;
const NEGATED_NUMBER = /\(-((?:\d+\.?\d*|\.\d+))\)$/;

const endsWithOperand = (expression: string) => OPERAND_END.test(expression);

/** Joins with "*" when two operands would otherwise touch, e.g. "2" and "sin(". */
const implicitMultiply = (expression: string) => (endsWithOperand(expression) ? '*' : '');

export function applyEdit(expression: string, command: EditCommand): string {
  switch (command.type) {
    case 'insert':
      return insert(expression, command.text, command.kind);
    case 'decimal':
      return decimal(expression);
    case 'backspace':
      return backspace(expression);
    case 'clearEntry':
      return clearEntry(expression);
    case 'toggleSign':
      return toggleSign(expression);
    case 'reciprocal':
      return reciprocal(expression);
  }
}

/**
 * Applies a command when a result is on screen. Numbers start a fresh
 * calculation; operators continue from the result; functions wrap it, so
 * pressing sin after "30 =" gives sin(30).
 */
export function applyToResult(result: string, command: EditCommand): string {
  switch (command.type) {
    case 'insert':
      switch (command.kind) {
        case 'digit':
        case 'open':
        case 'constant':
          return applyEdit('', command);
        case 'function':
          return command.text + result;
        default:
          return applyEdit(asOperand(result), command);
      }
    case 'decimal':
      return applyEdit('', command);
    case 'reciprocal':
      return `1/(${result})`;
    case 'clearEntry':
      return '';
    case 'toggleSign':
      return result.startsWith('-') ? result.slice(1) : `-${result}`;
    case 'backspace':
      return applyEdit(result, command);
  }
}

/** Appends missing ")" so "sin(30" can be evaluated as typed. */
export function closeOpenParens(expression: string): string {
  let depth = 0;
  for (const char of expression) {
    if (char === '(') depth++;
    else if (char === ')' && depth > 0) depth--;
  }
  return expression + ')'.repeat(depth);
}

function insert(expression: string, text: string, kind: InsertKind): string {
  switch (kind) {
    case 'digit':
      return insertDigit(expression, text);
    case 'operator':
      return insertOperator(expression, text);
    case 'postfix':
      return endsWithOperand(expression) ? expression + text : expression;
    case 'close':
      return canClose(expression) ? expression + text : expression;
    case 'separator':
      return insertSeparator(expression, text);
    case 'function':
    case 'open':
    case 'constant':
      return expression + implicitMultiply(expression) + text;
  }
}

function insertDigit(expression: string, digit: string): string {
  if (/(?:^|[^0-9.])0$/.test(expression)) {
    return expression.slice(0, -1) + digit; // "0" then "5" is "5", not "05"
  }
  const touchesNumber = /[0-9.]$/.test(expression);
  return expression + (touchesNumber ? '' : implicitMultiply(expression)) + digit;
}

function insertOperator(expression: string, text: string): string {
  const sign = text.trim();
  const trailing = TRAILING_OPERATOR.exec(expression);

  if (trailing) {
    const [, head] = trailing;
    if (!endsWithOperand(head)) return expression; // the trailing "-" is a sign, leave it
    return head + text; // replace the previous binary operator
  }
  if (expression === '') {
    return sign === '-' || sign === '+' ? sign : `0${text}`;
  }
  if (/[(,]$/.test(expression)) {
    return sign === '-' ? `${expression}-` : expression; // only a sign may follow "("
  }
  return expression + text;
}

function canClose(expression: string): boolean {
  let depth = 0;
  for (const char of expression) {
    if (char === '(') depth++;
    else if (char === ')') depth--;
  }
  return depth > 0 && endsWithOperand(expression);
}

/** Inside a call like round(4.67, 1) a comma separates arguments; elsewhere it is a decimal comma. */
function insertSeparator(expression: string, text: string): string {
  return isInsideCall(expression) && endsWithOperand(expression)
    ? expression + text
    : decimal(expression);
}

function isInsideCall(expression: string): boolean {
  const openers: boolean[] = []; // true when the "(" belongs to a function call
  for (let i = 0; i < expression.length; i++) {
    if (expression[i] === '(') openers.push(FUNCTION_OPENER.test(expression.slice(0, i + 1)));
    else if (expression[i] === ')') openers.pop();
  }
  return openers[openers.length - 1] === true;
}

function decimal(expression: string): string {
  const number = TRAILING_NUMBER.exec(expression);
  if (number) return number[0].includes('.') ? expression : `${expression}.`;
  return `${expression}${implicitMultiply(expression)}0.`;
}

function backspace(expression: string): string {
  const opener = FUNCTION_OPENER.exec(expression); // delete "sin(" as one unit
  if (opener) return expression.slice(0, -opener[0].length);

  const mod = /\s*mod\s*$/.exec(expression);
  if (mod) return expression.slice(0, -mod[0].length);

  if (expression.endsWith('pi')) return expression.slice(0, -2);
  return expression.slice(0, -1);
}

/** Removes the number being typed; with no number to remove it behaves like backspace. */
function clearEntry(expression: string): string {
  const number = TRAILING_NUMBER.exec(expression);
  return number ? expression.slice(0, -number[0].length) : backspace(expression);
}

function toggleSign(expression: string): string {
  const negated = NEGATED_NUMBER.exec(expression);
  if (negated) return expression.slice(0, -negated[0].length) + negated[1];

  const number = TRAILING_NUMBER.exec(expression);
  if (number) {
    return `${expression.slice(0, -number[0].length)}(-${number[0]})`;
  }
  if (endsWithOperand(expression)) return expression; // nothing simple to negate
  return `${expression}(-`;
}

/** 1/x of the number being typed, or of the constant before the cursor. */
function reciprocal(expression: string): string {
  const number = TRAILING_NUMBER.exec(expression) ?? /(?:pi|e)$/.exec(expression);
  if (number) {
    return `${expression.slice(0, -number[0].length)}1/(${number[0]})`;
  }
  if (endsWithOperand(expression)) return expression;
  return `${expression}1/(`;
}
