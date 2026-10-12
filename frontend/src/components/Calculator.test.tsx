import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ApiError, type CalculatorApi } from '../services/calculatorApi';
import type { EvaluateRequest, EvaluateResponse } from '../types/calculator';
import { Calculator } from './Calculator';

type Evaluate = ReturnType<typeof vi.fn<(request: EvaluateRequest) => Promise<EvaluateResponse>>>;

function setup(result: number | ((request: EvaluateRequest) => Promise<EvaluateResponse>) = 42) {
  const evaluate: Evaluate = vi.fn(
    typeof result === 'function'
      ? result
      : async (request: EvaluateRequest) => ({ ...request, result }),
  );
  const api: CalculatorApi = { evaluate };
  const user = userEvent.setup();
  render(<Calculator api={api} />);
  return { user, evaluate };
}

/** Presses keys by their spoken name, the way a user finds them. */
async function press(user: ReturnType<typeof userEvent.setup>, ...names: string[]) {
  for (const name of names) {
    await user.click(screen.getByRole('button', { name }));
  }
}

const primary = () => screen.getByTestId('display-primary');
const secondary = () => screen.getByTestId('display-secondary');

describe('<Calculator />', () => {
  it('shows 0 initially', () => {
    setup();
    expect(primary()).toHaveTextContent('0');
  });

  it('builds an expression from key presses and sends it to the backend', async () => {
    const { user, evaluate } = setup(5);

    await press(user, '2', 'Add', '3');
    expect(primary()).toHaveTextContent('2 + 3');

    await press(user, 'Equals');

    expect(evaluate).toHaveBeenCalledWith({ expression: '2+3', angleMode: 'deg' });
    expect(primary()).toHaveTextContent('5');
    expect(secondary()).toHaveTextContent('2 + 3 =');
  });

  it('sends operator precedence and parentheses untouched for the backend to solve', async () => {
    const { user, evaluate } = setup(28);

    await press(user, 'Open parenthesis', '1', '0', 'Add', '5', 'Close parenthesis', 'Multiply', '2');
    await press(user, 'Equals');

    expect(evaluate).toHaveBeenCalledWith({ expression: '(10+5)*2', angleMode: 'deg' });
  });

  it('closes open parentheses automatically', async () => {
    const { user, evaluate } = setup(0.5);

    await press(user, 'Sine', '3', '0', 'Equals');

    expect(evaluate).toHaveBeenCalledWith({ expression: 'sin(30)', angleMode: 'deg' });
    expect(secondary()).toHaveTextContent('sin(30) =');
  });

  it('inserts multiplication between touching operands', async () => {
    const { user } = setup();

    await press(user, '2', 'Pi');

    expect(primary()).toHaveTextContent('2 × π');
  });

  it('continues from a result when an operator is pressed, and starts fresh on a digit', async () => {
    const { user } = setup(7);

    await press(user, '3', 'Add', '4', 'Equals');
    await press(user, 'Multiply');
    expect(primary()).toHaveTextContent('7 ×');

    await press(user, 'Equals'); // dangling operator: just to reach a result again
    await press(user, 'All clear', '9');
    expect(primary()).toHaveTextContent('9');
  });

  it('applies a function to the displayed result', async () => {
    const { user, evaluate } = setup(16);

    await press(user, '1', '6', 'Equals');
    await press(user, 'Square root', 'Equals');

    expect(evaluate).toHaveBeenLastCalledWith({ expression: 'sqrt(16)', angleMode: 'deg' });
  });

  it('does not call the backend for an empty expression or when a result is already shown', async () => {
    const { user, evaluate } = setup(2);

    await press(user, 'Equals');
    expect(evaluate).not.toHaveBeenCalled();

    await press(user, '1', 'Add', '1', 'Equals', 'Equals');
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it('shows the backend error and lets the user fix the expression', async () => {
    const { user, evaluate } = setup();
    evaluate.mockRejectedValueOnce(new ApiError('division by zero is not allowed', 'division_by_zero', 400));

    await press(user, '1', 'Divide', '0', 'Equals');

    expect(await screen.findByRole('alert')).toHaveTextContent('division by zero is not allowed');
    expect(primary()).toHaveTextContent('Error');
    expect(secondary()).toHaveTextContent('1 ÷ 0');

    await press(user, 'Backspace', '4', 'Equals');

    expect(evaluate).toHaveBeenLastCalledWith({ expression: '1/4', angleMode: 'deg' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a generic message for unexpected failures', async () => {
    const { user, evaluate } = setup();
    evaluate.mockRejectedValueOnce(new Error('boom'));

    await press(user, '1', 'Add', '1', 'Equals');

    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
  });

  it('shows a busy state and ignores key presses while waiting', async () => {
    let resolve!: (value: EvaluateResponse) => void;
    const pending = new Promise<EvaluateResponse>((r) => (resolve = r));
    const { user } = setup(() => pending);

    await press(user, '1', 'Add', '1', 'Equals');
    expect(screen.getByRole('region', { name: 'Display' })).toHaveAttribute('aria-busy', 'true');

    await press(user, '5');
    expect(primary()).toHaveTextContent('1 + 1');

    resolve({ expression: '1+1', angleMode: 'deg', result: 2 });
    await waitFor(() => expect(primary()).toHaveTextContent('2'));
    expect(screen.getByRole('region', { name: 'Display' })).toHaveAttribute('aria-busy', 'false');
  });

  describe('cancelling a pending request', () => {
    function pendingRequest() {
      let resolve!: (value: EvaluateResponse) => void;
      let reject!: (reason: unknown) => void;
      const promise = new Promise<EvaluateResponse>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    }

    it('ignores a late answer after All clear', async () => {
      const request = pendingRequest();
      const { user } = setup(() => request.promise);

      await press(user, '1', 'Add', '1', 'Equals', 'All clear');
      expect(primary()).toHaveTextContent('0');

      request.resolve({ expression: '1+1', angleMode: 'deg', result: 2 });
      await waitFor(() => expect(screen.getByRole('region', { name: 'Display' })).toHaveAttribute('aria-busy', 'false'));

      expect(primary()).toHaveTextContent('0');
      expect(secondary()).toHaveTextContent('');
      await user.click(screen.getByRole('button', { name: 'History' }));
      expect(screen.getByText(/finished calculations appear here/i)).toBeInTheDocument();
    });

    it('does not let an old answer overwrite a newer calculation', async () => {
      const first = pendingRequest();
      const { user, evaluate } = setup();
      evaluate.mockReturnValueOnce(first.promise);
      evaluate.mockRejectedValueOnce(new ApiError('division by zero is not allowed', 'division_by_zero', 400));

      await press(user, '9', 'Add', '9', 'Equals', 'All clear'); // first request stays in flight
      await press(user, '1', 'Divide', '0', 'Equals');
      expect(await screen.findByRole('alert')).toBeInTheDocument();

      first.resolve({ expression: '9+9', angleMode: 'deg', result: 18 });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(primary()).toHaveTextContent('Error');
      expect(secondary()).toHaveTextContent('1 ÷ 0');
    });

    it('ignores a late failure after All clear', async () => {
      const request = pendingRequest();
      const { user } = setup(() => request.promise);

      await press(user, '1', 'Add', '1', 'Equals', 'All clear');
      request.reject(new ApiError('boom', 'internal_error', 500));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(primary()).toHaveTextContent('0');
    });

    it('does not store memory from a cancelled calculation', async () => {
      const request = pendingRequest();
      const { user } = setup(() => request.promise);

      await press(user, '5', 'Add to memory', 'All clear');
      request.resolve({ expression: '5', angleMode: 'deg', result: 5 });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(screen.queryByTitle('A value is stored in memory')).not.toBeInTheDocument();
    });

    it('cancels when a history entry is reused', async () => {
      const { user, evaluate } = setup(5);
      await press(user, '2', 'Add', '3', 'Equals');

      const slow = pendingRequest();
      evaluate.mockReturnValueOnce(slow.promise);
      await press(user, '9'); // fresh expression after a result
      await press(user, 'Equals');
      await user.click(screen.getByRole('button', { name: 'History' }));
      await user.click(screen.getByRole('button', { name: 'Reuse expression 2 + 3' }));

      slow.resolve({ expression: '9', angleMode: 'deg', result: 9 });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(primary()).toHaveTextContent('2 + 3');
    });
  });

  describe('editing keys', () => {
    it('AC clears everything', async () => {
      const { user } = setup();
      await press(user, '1', 'Add', '2', 'All clear');
      expect(primary()).toHaveTextContent('0');
    });

    it('CE removes only the number being typed', async () => {
      const { user } = setup();
      await press(user, '1', '2', 'Add', '3', '4', 'Clear entry');
      expect(primary()).toHaveTextContent('12 +');
    });

    it('backspace removes the last character', async () => {
      const { user } = setup();
      await press(user, '1', '2', '3', 'Backspace');
      expect(primary()).toHaveTextContent('12');
    });

    it('± negates the number being typed and back', async () => {
      const { user } = setup();
      await press(user, '5', 'Change sign');
      expect(primary()).toHaveTextContent('(−5)');
      await press(user, 'Change sign');
      expect(primary()).toHaveTextContent('5');
    });

    it('1/x wraps the number being typed', async () => {
      const { user, evaluate } = setup(0.25);
      await press(user, '4', 'Reciprocal', 'Equals');
      expect(evaluate).toHaveBeenCalledWith({ expression: '1/(4)', angleMode: 'deg' });
    });

    it('% and the decimal point are available on the basic keypad', async () => {
      const { user } = setup();
      await press(user, '2', '0', '0', 'Add', '1', '5', 'Percent');
      expect(primary()).toHaveTextContent('200 + 15%');
      await press(user, 'All clear', 'Decimal point', '5');
      expect(primary()).toHaveTextContent('0.5');
    });
  });

  describe('angle mode', () => {
    it('starts in degrees and sends the chosen mode', async () => {
      const { user, evaluate } = setup(0.5);

      const toggle = screen.getByRole('button', { name: /angle unit: degrees/i });
      await user.click(toggle);
      expect(screen.getByRole('button', { name: /angle unit: radians/i })).toBeInTheDocument();

      await press(user, 'Sine', '3', '0', 'Equals');
      expect(evaluate).toHaveBeenCalledWith({ expression: 'sin(30)', angleMode: 'rad' });
    });
  });

  describe('memory', () => {
    it('stores a result with M+, recalls it with MR and clears it with MC', async () => {
      const { user } = setup(5);
      expect(screen.queryByTitle('A value is stored in memory')).not.toBeInTheDocument();

      await press(user, '2', 'Add', '3', 'Add to memory');
      expect(await screen.findByTitle('A value is stored in memory')).toBeInTheDocument();

      await press(user, 'All clear', 'Memory recall');
      expect(primary()).toHaveTextContent('5');

      await press(user, 'All clear', 'Memory clear');
      expect(screen.queryByTitle('A value is stored in memory')).not.toBeInTheDocument();
    });

    it('M− subtracts from memory', async () => {
      const { user } = setup(5);

      await press(user, '5', 'Add to memory');
      await press(user, 'All clear', '5', 'Subtract from memory');
      await press(user, 'All clear', 'Memory recall');

      expect(primary()).toHaveTextContent('0');
    });

    it('recalls a negative memory value safely', async () => {
      const { user } = setup(5);

      await press(user, '5', 'Subtract from memory');
      await press(user, 'All clear', 'Memory recall');

      expect(primary()).toHaveTextContent('(−5)');
    });

    it('MR does nothing when memory is empty', async () => {
      const { user } = setup();
      await press(user, 'Memory recall');
      expect(primary()).toHaveTextContent('0');
    });

    it('M+ does nothing when there is nothing to store', async () => {
      const { user, evaluate } = setup();
      await press(user, 'Add to memory');
      expect(evaluate).not.toHaveBeenCalled();
      expect(screen.queryByTitle('A value is stored in memory')).not.toBeInTheDocument();
    });

    it('M+ does not store anything when the calculation fails', async () => {
      const { user, evaluate } = setup();
      evaluate.mockRejectedValueOnce(new ApiError('division by zero is not allowed', 'division_by_zero', 400));

      await press(user, '1', 'Divide', '0', 'Add to memory');

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.queryByTitle('A value is stored in memory')).not.toBeInTheDocument();
    });
  });

  describe('keyboard', () => {
    it('types, evaluates with Enter, and clears with Escape', async () => {
      const { user, evaluate } = setup(5);

      await user.keyboard('2+3');
      expect(primary()).toHaveTextContent('2 + 3');

      await user.keyboard('{Enter}');
      expect(evaluate).toHaveBeenCalledWith({ expression: '2+3', angleMode: 'deg' });
      await waitFor(() => expect(primary()).toHaveTextContent('5'));

      await user.keyboard('{Escape}');
      expect(primary()).toHaveTextContent('0');
    });

    it('supports Backspace, Delete, x for multiply, parentheses and decimals', async () => {
      const { user } = setup();

      await user.keyboard('(2.5x4');
      expect(primary()).toHaveTextContent('(2.5 × 4');

      await user.keyboard('{Backspace}');
      expect(primary()).toHaveTextContent('(2.5 ×');

      await user.keyboard('{Delete}');
      expect(primary()).toHaveTextContent('(2.5');
    });

    it('does not run Enter twice when a button has focus', async () => {
      const { user, evaluate } = setup(2);

      await press(user, '1', 'Add', '1');
      screen.getByRole('button', { name: 'Equals' }).focus();
      await user.keyboard('{Enter}');

      expect(evaluate).toHaveBeenCalledTimes(1);
    });

    it('ignores browser shortcuts', async () => {
      const { user } = setup();
      await user.keyboard('{Control>}5{/Control}');
      expect(primary()).toHaveTextContent('0');
    });
  });

  describe('panels', () => {
    it('toggles the scientific keys on small screens', async () => {
      const { user } = setup();
      const toggle = screen.getByRole('button', { name: 'Scientific' });

      expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
    });

    it('lists finished calculations in the history and reuses them', async () => {
      const { user } = setup(5);
      await press(user, '2', 'Add', '3', 'Equals', 'All clear');

      await user.click(screen.getByRole('button', { name: 'History' }));
      const history = screen.getByRole('region', { name: 'History' });
      expect(within(history).getByRole('listitem')).toHaveTextContent('2 + 3');

      await user.click(within(history).getByRole('button', { name: 'Reuse expression 2 + 3' }));
      expect(screen.queryByRole('region', { name: 'History' })).not.toBeInTheDocument();
      expect(primary()).toHaveTextContent('2 + 3');

      await user.click(screen.getByRole('button', { name: 'History' }));
      await user.click(screen.getByRole('button', { name: 'Use result 5' }));
      expect(primary()).toHaveTextContent('5');
    });

    it('shows an empty state and clears the history', async () => {
      const { user } = setup(2);

      await user.click(screen.getByRole('button', { name: 'History' }));
      expect(screen.getByText(/finished calculations appear here/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Clear history' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'History' }));
      await press(user, '1', 'Add', '1', 'Equals');
      await user.click(screen.getByRole('button', { name: 'History' }));
      await user.click(screen.getByRole('button', { name: 'Clear history' }));

      expect(screen.getByText(/finished calculations appear here/i)).toBeInTheDocument();
    });
  });
});
