import { commandForKey } from './keymap';

describe('commandForKey', () => {
  it.each(['0', '5', '9'])('maps digit %s', (key) => {
    expect(commandForKey({ key })).toEqual({ type: 'insert', text: key, kind: 'digit' });
  });

  it.each([
    ['+', '+'],
    ['-', '-'],
    ['*', '*'],
    ['x', '*'],
    ['X', '*'],
    ['/', '/'],
    ['^', '^'],
  ])('maps operator %s to %s', (key, text) => {
    expect(commandForKey({ key })).toEqual({ type: 'insert', text, kind: 'operator' });
  });

  it('maps punctuation', () => {
    expect(commandForKey({ key: '.' })).toEqual({ type: 'decimal' });
    expect(commandForKey({ key: ',' })).toEqual({ type: 'insert', text: ',', kind: 'separator' });
    expect(commandForKey({ key: '(' })).toEqual({ type: 'insert', text: '(', kind: 'open' });
    expect(commandForKey({ key: ')' })).toEqual({ type: 'insert', text: ')', kind: 'close' });
    expect(commandForKey({ key: '%' })).toEqual({ type: 'insert', text: '%', kind: 'postfix' });
    expect(commandForKey({ key: '!' })).toEqual({ type: 'insert', text: '!', kind: 'postfix' });
  });

  it('maps editing keys', () => {
    expect(commandForKey({ key: 'Enter' })).toEqual({ type: 'evaluate' });
    expect(commandForKey({ key: '=' })).toEqual({ type: 'evaluate' });
    expect(commandForKey({ key: 'Backspace' })).toEqual({ type: 'backspace' });
    expect(commandForKey({ key: 'Delete' })).toEqual({ type: 'clearEntry' });
    expect(commandForKey({ key: 'Escape' })).toEqual({ type: 'allClear' });
  });

  it('ignores unrelated keys', () => {
    expect(commandForKey({ key: 'a' })).toBeNull();
    expect(commandForKey({ key: 'Tab' })).toBeNull();
    expect(commandForKey({ key: 'F5' })).toBeNull();
    expect(commandForKey({ key: ' ' })).toBeNull();
  });

  it('leaves browser shortcuts alone', () => {
    expect(commandForKey({ key: 'c', ctrlKey: true })).toBeNull();
    expect(commandForKey({ key: '5', metaKey: true })).toBeNull();
    expect(commandForKey({ key: '+', altKey: true })).toBeNull();
  });
});
