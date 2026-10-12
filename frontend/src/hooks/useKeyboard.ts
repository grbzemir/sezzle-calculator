import { useEffect } from 'react';
import type { Command } from '../domain/commands';
import { commandForKey } from '../domain/keymap';

/** Routes physical key presses to the calculator while the page is focused. */
export function useKeyboard(execute: (command: Command) => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      // A focused button already reacts to Enter and Space; don't also run the shortcut.
      const onButton = event.target instanceof HTMLElement && event.target.closest('button') !== null;
      if (onButton && (event.key === 'Enter' || event.key === ' ')) return;

      const command = commandForKey(event);
      if (!command) return;
      event.preventDefault(); // stops "/" from opening quick-find in some browsers
      execute(command);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [execute]);
}
