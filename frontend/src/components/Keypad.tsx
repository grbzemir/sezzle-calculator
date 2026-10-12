import type { Command } from '../domain/commands';
import type { KeyDefinition } from '../domain/keys';
import type { AngleMode } from '../types/calculator';
import { KeyButton } from './KeyButton';

interface Props {
  name: string;
  keys: readonly KeyDefinition[];
  columns: number;
  angleMode: AngleMode;
  className?: string;
  onCommand: (command: Command) => void;
}

/** Renders any list of key definitions as a grid; it knows nothing about what the keys do. */
export function Keypad({ name, keys, columns, angleMode, className, onCommand }: Props) {
  return (
    <div
      role="group"
      aria-label={name}
      className={className ? `keypad ${className}` : 'keypad'}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {keys.map((definition) => (
        <KeyButton
          key={definition.id}
          definition={definition}
          angleMode={angleMode}
          onPress={(pressed) => onCommand(pressed.command)}
        />
      ))}
    </div>
  );
}
