import { prettifyExpression } from '../domain/format';
import type { HistoryEntry } from '../types/calculator';

interface Props {
  entries: HistoryEntry[];
  onReuse: (entry: HistoryEntry, part: 'expression' | 'result') => void;
  onClear: () => void;
}

export function HistoryPanel({ entries, onReuse, onClear }: Props) {
  return (
    <section className="history" aria-label="History">
      <div className="history-header">
        <h2>History</h2>
        {entries.length > 0 && (
          <button type="button" className="link-button" onClick={onClear}>
            Clear history
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="history-empty">Finished calculations appear here. Select one to use it again.</p>
      ) : (
        <ul>
          {entries.map((entry) => {
            const expression = prettifyExpression(entry.expression);
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  className="history-expression"
                  aria-label={`Reuse expression ${expression}`}
                  onClick={() => onReuse(entry, 'expression')}
                >
                  {expression}
                  <span className="history-unit">{entry.angleMode.toUpperCase()}</span>
                </button>
                <button
                  type="button"
                  className="history-result"
                  aria-label={`Use result ${entry.result}`}
                  onClick={() => onReuse(entry, 'result')}
                >
                  {entry.result}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
