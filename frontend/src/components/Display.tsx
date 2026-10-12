import { displayFontSizeRem } from '../domain/format';
import type { AngleMode } from '../types/calculator';

interface Props {
  primary: string;
  secondary: string;
  error: string | null;
  loading: boolean;
  angleMode: AngleMode;
  hasMemory: boolean;
}

export function Display({ primary, secondary, error, loading, angleMode, hasMemory }: Props) {
  return (
    <section className="display" aria-label="Display" aria-busy={loading}>
      <div className="display-badges">
        {hasMemory && (
          <span className="badge" title="A value is stored in memory">
            M
          </span>
        )}
        <span className="badge" title="Angle unit">
          {angleMode.toUpperCase()}
        </span>
      </div>

      <p className="display-secondary" data-testid="display-secondary">
        {secondary}
      </p>
      <p
        className={loading ? 'display-primary is-loading' : 'display-primary'}
        style={{ fontSize: `${displayFontSizeRem(primary)}rem` }}
        data-testid="display-primary"
        aria-live="polite"
      >
        {primary}
      </p>

      {error && (
        <p role="alert" className="display-error">
          {error}
        </p>
      )}
    </section>
  );
}
