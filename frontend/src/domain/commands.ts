/**
 * What kind of text a key inserts. The editor uses it to decide spacing,
 * implicit multiplication and what to do after a result is on screen.
 *
 *  digit      0-9
 *  operator   + - * / ^ mod            (binary, or a sign at the start)
 *  postfix    ! % ^2 ^3                (applies to the operand before it)
 *  function   sin( sqrt( ...           (one argument; wraps the shown result)
 *  open       ( root( round(           (starts a group; never wraps a result)
 *  close      )
 *  constant   pi e and recalled memory
 *  separator  ,                        (argument separator, or a decimal comma)
 */
export type InsertKind =
  | 'digit'
  | 'operator'
  | 'postfix'
  | 'function'
  | 'open'
  | 'close'
  | 'constant'
  | 'separator';

/** Commands that only change the expression text. */
export type EditCommand =
  | { type: 'insert'; text: string; kind: InsertKind }
  | { type: 'decimal' }
  | { type: 'backspace' }
  | { type: 'clearEntry' }
  | { type: 'toggleSign' }
  | { type: 'reciprocal' };

export type MemoryOperation = 'add' | 'subtract' | 'recall' | 'clear';

/** Everything a key or keyboard shortcut can ask the calculator to do. */
export type Command =
  | EditCommand
  | { type: 'evaluate' }
  | { type: 'allClear' }
  | { type: 'memory'; operation: MemoryOperation }
  | { type: 'toggleAngleMode' };

export function isEditCommand(command: Command): command is EditCommand {
  switch (command.type) {
    case 'insert':
    case 'decimal':
    case 'backspace':
    case 'clearEntry':
    case 'toggleSign':
    case 'reciprocal':
      return true;
    default:
      return false;
  }
}
