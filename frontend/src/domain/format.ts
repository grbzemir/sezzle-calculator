const DISPLAY_DIGITS = 12;

/** Trims floating point noise: 0.30000000000000004 becomes "0.3". */
export function formatResult(value: number): string {
  return String(Number(value.toPrecision(DISPLAY_DIGITS)));
}

/** Wraps a negative number in parentheses so it can safely continue an expression. */
export function asOperand(text: string): string {
  return text.startsWith('-') ? `(${text})` : text;
}

/** True when the text before `index` ends with something an operator can follow. */
function followsOperand(text: string, index: number): boolean {
  const before = text.slice(0, index);
  if (/\d[eE]$/.test(before)) return false; // exponent sign, as in 1e+21
  return /(?:[0-9.)!%]|pi|e)$/.test(before);
}

/**
 * Human friendly form of a canonical expression: typographic operators,
 * spaces around binary operators, π, √ and ∛. Purely for display; the
 * canonical text is what is edited and sent to the backend.
 */
export function prettifyExpression(expression: string): string {
  let out = '';
  for (let i = 0; i < expression.length; i++) {
    const char = expression[i];
    switch (char) {
      case '*':
        out += ' × ';
        break;
      case '/':
        out += ' ÷ ';
        break;
      case '+':
        out += followsOperand(expression, i) ? ' + ' : '+';
        break;
      case '-':
        out += followsOperand(expression, i) ? ' − ' : '−';
        break;
      case ',':
        out += ', ';
        break;
      default:
        out += char;
    }
  }
  return out
    .replace(/\bpi\b/g, 'π')
    .replace(/sqrt\(/g, '√(')
    .replace(/cbrt\(/g, '∛(')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Font size in rem so long values shrink instead of overflowing the display. */
export function displayFontSizeRem(text: string): number {
  const length = Array.from(text).length;
  if (length <= 7) return 3.6;
  if (length <= 9) return 3;
  if (length <= 12) return 2.4;
  if (length <= 16) return 1.9;
  if (length <= 22) return 1.5;
  return 1.2;
}
