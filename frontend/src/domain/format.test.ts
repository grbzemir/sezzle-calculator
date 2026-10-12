import { asOperand, displayFontSizeRem, formatResult, prettifyExpression } from './format';

describe('formatResult', () => {
  it.each([
    [0.1 + 0.2, '0.3'],
    [25, '25'],
    [-1.5, '-1.5'],
    [0, '0'],
    [1 / 3, '0.333333333333'],
    [1e21, '1e+21'],
    [1.5e-7, '1.5e-7'],
    [123456789012345, '123456789012000'],
  ])('%s -> %s', (value, expected) => {
    expect(formatResult(value)).toBe(expected);
  });
});

describe('asOperand', () => {
  it('wraps negative numbers', () => {
    expect(asOperand('-5')).toBe('(-5)');
  });

  it('leaves other numbers alone', () => {
    expect(asOperand('5')).toBe('5');
    expect(asOperand('0.5')).toBe('0.5');
  });
});

describe('prettifyExpression', () => {
  it.each([
    ['', ''],
    ['2*3', '2 × 3'],
    ['10/4', '10 ÷ 4'],
    ['5-3', '5 − 3'],
    ['5+3', '5 + 3'],
    ['-5', '−5'],
    ['+5', '+5'],
    ['(-5)+2', '(−5) + 2'],
    ['2*(-5)', '2 × (−5)'],
    ['sqrt(9)', '√(9)'],
    ['cbrt(8)', '∛(8)'],
    ['2*pi', '2 × π'],
    ['17 mod 5', '17 mod 5'],
    ['round(4.67,1)', 'round(4.67, 1)'],
    ['1e+21+1', '1e+21 + 1'],
    ['5+', '5 +'],
    ['2^3', '2^3'],
    ['5!', '5!'],
    ['sin(30)', 'sin(30)'],
  ])('%j -> %j', (expression, expected) => {
    expect(prettifyExpression(expression)).toBe(expected);
  });
});

describe('displayFontSizeRem', () => {
  it('shrinks as the text gets longer and never grows', () => {
    const sizes = ['1234567', '123456789', '123456789012', '1234567890123456', '1'.repeat(22), '1'.repeat(40)].map(
      displayFontSizeRem,
    );

    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    expect(new Set(sizes).size).toBe(sizes.length);
  });

  it('counts characters, not UTF-16 units', () => {
    expect(displayFontSizeRem('√√√√√√√')).toBe(displayFontSizeRem('1234567'));
  });
});
