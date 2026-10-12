# Test coverage report

Measured on 2026-10-12 with the commands below. Numbers are statement coverage
as reported by the tools; nothing is rounded up.

## How to reproduce

```bash
# backend (from /backend)
go test ./... -coverprofile=coverage.out
go tool cover -func=coverage.out     # per function
go tool cover -html=coverage.out     # browsable report

# frontend (from /frontend)
npm run coverage                     # text table + HTML report in frontend/coverage/
```

## Summary

| Layer    | Tests passing | Statement coverage |
|----------|---------------|--------------------|
| Backend  | 247 test cases (table-driven subtests) | 93.4% overall; 98.5% to 100% in every package that has logic |
| Frontend | 230 tests in 7 files                   | 99.4% overall (98.1% branches)                                |

## Backend (Go)

| Package                  | Coverage | What it holds                                         |
|--------------------------|----------|-------------------------------------------------------|
| `internal/calcerr`       | 100.0%   | Shared error type and codes                           |
| `internal/calculator`    | 100.0%   | Functions, constants, angle modes, rounding of results |
| `internal/expression`    | 98.5%    | Lexer, parser, evaluator                              |
| `internal/handler`       | 98.6%    | HTTP routes, JSON decoding, error mapping, middleware |
| `cmd/api`                | 0.0%     | Process wiring and graceful shutdown (not unit tested) |

Functions below 100%, and why:

| Function                       | Coverage | Reason                                                                 |
|--------------------------------|----------|------------------------------------------------------------------------|
| `cmd/api` `main`, `run`, `getenv` | 0%    | Start the real server and wait for signals; verified by running the binary instead |
| `expression` `isNode` (six types) | 0%    | Empty marker methods that make the `Node` interface closed; they contain no statements to run |
| `expression.evalPostfix`       | 71.4%    | The `default` branch for an operator the parser can never produce      |
| `expression.evalNode`          | 93.8%    | Same kind of guard for an unknown node type                            |
| `expression.evalBinary`        | 96.4%    | Guard for an unknown binary operator                                   |
| `handler.writeJSON`            | 75.0%    | The branch where writing to a closed connection fails                  |

## Frontend (React + TypeScript, Vitest + Testing Library)

```
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|------------------
All files          |   99.36 |    98.11 |   96.29 |   99.36 |
 src               |       0 |        0 |       0 |       0 |
  App.tsx          |       0 |        0 |       0 |       0 | 1-9
 src/components    |     100 |    97.82 |     100 |     100 |
  Calculator.tsx   |     100 |      100 |     100 |     100 |
  Display.tsx      |     100 |      100 |     100 |     100 |
  HistoryPanel.tsx |     100 |      100 |     100 |     100 |
  KeyButton.tsx    |     100 |      100 |     100 |     100 |
  Keypad.tsx       |     100 |       75 |     100 |     100 | 21
 src/domain        |     100 |      100 |     100 |     100 |
  commands.ts      |     100 |      100 |     100 |     100 |
  editor.ts        |     100 |      100 |     100 |     100 |
  format.ts        |     100 |      100 |     100 |     100 |
  keymap.ts        |     100 |      100 |     100 |     100 |
  keys.ts          |     100 |      100 |     100 |     100 |
 src/hooks         |     100 |    93.87 |     100 |     100 |
  useCalculator.ts |     100 |    97.36 |     100 |     100 | 38
  useKeyboard.ts   |     100 |    81.81 |     100 |     100 | 9-13
 src/services      |     100 |      100 |   83.33 |     100 |
  calculatorApi.ts |     100 |      100 |   83.33 |     100 |
 src/state         |     100 |    96.42 |     100 |     100 |
  ...torReducer.ts |     100 |    96.42 |     100 |     100 | 131
```

Excluded from the measurement: `main.tsx` (mounts React), `vite-env.d.ts`, the
type-only `src/types/` folder and the test files themselves.

Notes on what is not at 100%:

- `App.tsx` only creates the real API client and renders `<Calculator>`. It is
  covered indirectly by running the app, not by a unit test.
- The remaining branch gaps are defensive defaults (for example the fallback
  when `fetch` is not injected, or a keyboard event whose target is not an
  element).

## What the tests are meant to prove

Coverage says which lines ran, not whether the right things were checked. The
tests were written around behavior:

- **Math**: operator precedence and associativity, every function, exact values at multiples of 90 degrees, DEG versus RAD, percent rules, rounding of floating point noise.
- **Errors**: division by zero, square root of a negative number, undefined results, overflow, bad syntax (with the position), unknown names, wrong argument counts, input size and nesting limits.
- **HTTP**: status codes, one JSON error shape, strict request decoding, and that internal failures never leak details.
- **UI behavior**: pressing keys end to end against a fake backend: results, backend errors, loading state, memory, history, angle mode, keyboard shortcuts.
- **Concurrency**: a late response is discarded after All clear, so it cannot overwrite a newer screen. The five tests for this fail when the fix is removed.
