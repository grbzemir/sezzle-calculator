import type { KeyDefinition } from '../domain/keys';
import type { AngleMode } from '../types/calculator';

interface Props {
  definition: KeyDefinition;
  angleMode: AngleMode;
  onPress: (definition: KeyDefinition) => void;
}

export function KeyButton({ definition, angleMode, onPress }: Props) {
  const { label, ariaLabel, variant, columnSpan, rowSpan } = definition;
  const isAngleKey = definition.command.type === 'toggleAngleMode';

  const style =
    columnSpan || rowSpan
      ? {
          gridColumn: columnSpan ? `span ${columnSpan}` : undefined,
          gridRow: rowSpan ? `span ${rowSpan}` : undefined,
        }
      : undefined;

  return (
    <button
      type="button"
      className={`key key-${variant}`}
      style={style}
      aria-label={isAngleKey ? angleKeyLabel(angleMode) : ariaLabel}
      onClick={() => onPress(definition)}
    >
      {isAngleKey ? (
        <>
          <span className={angleMode === 'deg' ? 'angle-option is-active' : 'angle-option'}>DEG</span>
          <span className={angleMode === 'rad' ? 'angle-option is-active' : 'angle-option'}>RAD</span>
        </>
      ) : (
        label
      )}
    </button>
  );
}

function angleKeyLabel(angleMode: AngleMode): string {
  return angleMode === 'deg'
    ? 'Angle unit: degrees. Press to switch to radians.'
    : 'Angle unit: radians. Press to switch to degrees.';
}
