import { useState } from 'react';
import { BASIC_KEYS, SCIENTIFIC_KEYS } from '../domain/keys';
import { useCalculator } from '../hooks/useCalculator';
import { useKeyboard } from '../hooks/useKeyboard';
import type { CalculatorApi } from '../services/calculatorApi';
import { Display } from './Display';
import { HistoryPanel } from './HistoryPanel';
import { Keypad } from './Keypad';

interface Props {
  api: CalculatorApi;
}

export function Calculator({ api }: Props) {
  const { state, display, execute, reuseHistory, clearHistory } = useCalculator(api);
  useKeyboard(execute);

  // Which panels are visible is a presentation concern, so it stays out of the calculator state.
  const [showHistory, setShowHistory] = useState(false);
  const [showScientific, setShowScientific] = useState(false);

  const reuse: typeof reuseHistory = (entry, part) => {
    reuseHistory(entry, part);
    setShowHistory(false);
  };

  return (
    <main className="calculator" aria-label="Calculator">
      <header className="toolbar">
        <button
          type="button"
          className="toolbar-button scientific-toggle"
          aria-pressed={showScientific}
          onClick={() => setShowScientific((visible) => !visible)}
        >
          Scientific
        </button>
        <button
          type="button"
          className="toolbar-button"
          aria-pressed={showHistory}
          onClick={() => setShowHistory((visible) => !visible)}
        >
          History
        </button>
      </header>

      <Display
        primary={display.primary}
        secondary={display.secondary}
        error={state.error}
        loading={state.phase === 'loading'}
        angleMode={state.angleMode}
        hasMemory={state.memory !== null}
      />

      {showHistory ? (
        <HistoryPanel entries={state.history} onReuse={reuse} onClear={clearHistory} />
      ) : (
        <div className={showScientific ? 'keypads is-scientific' : 'keypads'}>
          <Keypad
            name="Scientific keys"
            className="keypad-scientific"
            keys={SCIENTIFIC_KEYS}
            columns={6}
            angleMode={state.angleMode}
            onCommand={execute}
          />
          <Keypad
            name="Basic keys"
            className="keypad-basic"
            keys={BASIC_KEYS}
            columns={4}
            angleMode={state.angleMode}
            onCommand={execute}
          />
        </div>
      )}
    </main>
  );
}
