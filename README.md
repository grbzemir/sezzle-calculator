# Scientific Calculator

A calculator with a **React + TypeScript** frontend and a **Go** REST microservice.
The browser never calculates: it builds an expression, sends it to the backend,
and shows what comes back. The backend parses the expression, applies operator
precedence and does all the math.

```
 keys / keyboard                                  Go API
      │                                              │
      ▼                                              ▼
 expression editor ──► POST /api/v1/evaluate ──► Parse ──► Evaluate ──► JSON
 (pure functions)      {"expression":"(10+5)*2",    lexer      AST walk     {"result":30}
                        "angleMode":"deg"}          parser     functions
```

## Contents

1. [Requirements checklist](#1-requirements-checklist)
2. [Features](#2-features)
3. [Prerequisites](#3-prerequisites)
4. [Setup and run](#4-setup-and-run)
5. [API](#5-api)
6. [Tests and coverage](#6-tests-and-coverage)
7. [Project structure](#7-project-structure)
8. [Design decisions](#8-design-decisions)
9. [Assumptions](#9-assumptions)
10. [Known limitations and next steps](#10-known-limitations-and-next-steps)
11. [Troubleshooting](#11-troubleshooting)

## 1. Requirements checklist

| Requirement from the brief | Status | Where |
|---|---|---|
| Add, subtract, multiply, divide | Done | `expression/evaluator.go` |
| Power, square root, percentage (optional) | Done, plus many more (section 2) | `calculator/functions.go` |
| Input validation and error handling | Done: 14 stable error codes, one JSON error shape | `calcerr/`, `handler/` |
| Division by zero and other invalid input | Done, validated in the backend | `expression/evaluator.go` |
| React frontend | Done (React 18, TypeScript strict, Vite) | `frontend/` |
| Responsive design | Done, checked from 320 px to desktop; scientific keys open from a toggle on phones | `frontend/src/styles.css` |
| Microservice backend (Go) | Done (Go standard library only, no framework) | `backend/` |
| JSON REST API | Done | [section 5](#5-api), `docs/api-examples.md` |
| Unit tests for both layers | Done | [section 6](#6-tests-and-coverage) |
| Test coverage report | Done | `docs/coverage-report.md` |
| README with setup, run, API examples, decisions, assumptions | This file | |
| Dockerfile (optional) | Done: one per service and a `docker-compose.yml` | `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml` |
|  prompts shared | Done | [`PROMPTS.md`](PROMPTS.md) |
| Clean, mntnable, testable code | See [section 8](#8-design-decisions) | |

## 2. Features

| Group      | Operations                                                                                   |
|------------|----------------------------------------------------------------------------------------------|
| Basic      | `+` `−` `×` `÷`, decimals, parentheses with correct precedence                              |
| Everyday   | `±`, `%`, `mod`, `1/x`, `abs`, `round`, `floor`, `ceil`                                      |
| Powers     | `x²` `x³` `xʸ` `√x` `∛x` `ʸ√x` `x!` `eˣ` `10ˣ`                                              |
| Logs       | `log` (base 10), `log₂`, `ln`                                                                |
| Trig       | `sin` `cos` `tan` `sin⁻¹` `cos⁻¹` `tan⁻¹` `sinh` `cosh` `tanh`, with a DEG / RAD switch     |
| Constants  | `π`, `e`                                                                                     |
| Editing    | `AC` (all clear), `CE` (clear entry), `⌫` (backspace), keyboard input                        |
| Memory     | `MC` `MR` `M+` `M−`, with an `M` indicator on the display                                    |
| History    | Last 20 calculations; reuse an expression or just its result                                 |

`(10 + 5) × 2 − 8 ÷ 4` evaluates to `28`. Pressing a function key after a result
wraps it (`30 =` then `sin` gives `sin(30)`). Missing closing parentheses are
added when you press `=`.

### Keyboard

| Key                          | Action                                                                          |
|------------------------------|---------------------------------------------------------------------------------|
| `0-9` `.`                    | Digits and decimal point                                                        |
| `+` `-` `*` (or `x`) `/` `^` | Operators                                                                       |
| `(` `)` `%` `!`              | Parentheses, percent, factorial                                                 |
| `,`                          | Argument separator inside a call such as `round(4.67, 1)`, otherwise a decimal comma |
| `Enter` or `=`               | Calculate                                                                       |
| `Backspace`                  | Delete last character                                                           |
| `Delete`                     | Clear entry                                                                     |
| `Esc`                        | All clear                                                                       |

## 3. Prerequisites

| Tool   | Version  | Needed for                | Check with       |
|--------|----------|---------------------------|------------------|
| Go     | 1.22+    | Backend                   | `go version`     |
| Node   | 20+      | Frontend (npm included)   | `node -v`        |
| Docker | optional | One-command run           | `docker --version` |

Installers: <https://go.dev/dl/> and <https://nodejs.org/>. On Windows, **open a
new terminal after installing Go**, otherwise `go` is "not recognized" because the
old window still has the old `PATH`.

## 4. Setup and run

Get the code (unzip the archive or clone the repository) and open a terminal in
the project root, the folder that contains `backend/`, `frontend/` and this README.
You need **two terminals**, one per service.

### Option A: locally (recommended for reading the code)

**Terminal 1: backend, http://localhost:8080**

```bash
cd backend
go run ./cmd/api
```

You should see `server listening` with `addr=:8080`. The backend has no
third-party dependencies, so there is nothing to install.

**Terminal 2: frontend, http://localhost:5173**

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api` to `localhost:8080`, so keep
the backend running.

> **Run each command inside its own folder.** `go run ./cmd/api` from the project
> root fails because `go.mod` lives in `backend/`.

#### Windows (PowerShell)

```powershell
cd D:\path\to\sezzle-calculator\backend
go run ./cmd/api
```
```powershell
cd D:\path\to\sezzle-calculator\frontend
npm install
npm run dev
```

- If `go` is not recognized right after installing it and you do not want to
  reopen the terminal, run `$env:Path = "C:\Program Files\Go\bin;" + $env:Path`
  in that window.
- A warning such as `EBADENGINE` about your Node version is harmless as long as the
  install finishes and `npm run dev` starts.

#### Configuration

| Where    | Variable              | Default                 | Purpose                                  |
|----------|-----------------------|-------------------------|------------------------------------------|
| Backend  | `PORT`                | `8080`                  | HTTP port                                |
| Backend  | `CORS_ALLOWED_ORIGIN` | `http://localhost:5173` | Browser origin allowed to call the API   |
| Frontend | `VITE_API_URL`        | `/api/v1`               | API base URL (build time)                |

### Option B: Docker (one command)

```bash
docker compose up --build
```

Open **http://localhost:3000**. nginx serves the built frontend and forwards
`/api` to the backend container, which has a health check. Stop with `Ctrl+C`,
then `docker compose down`.

> The Dockerfiles and compose file were written carefully but I could not run
> Docker in the environment where this was built, so this path is the one I have
> verified least. Option A is the verified one. If Docker misbehaves, use Option A.

### Production build of the frontend

```bash
cd frontend
npm run build      # type-check + bundle into frontend/dist
npm run preview    # serve the bundle locally
```

## 5. API

Base URL: `http://localhost:8080`. Request and response bodies are JSON.

| Method | Path               | Purpose                                      |
|--------|--------------------|----------------------------------------------|
| POST   | `/api/v1/evaluate` | Evaluate an expression                       |
| GET    | `/api/v1/functions`| List supported functions and argument counts |
| GET    | `/health`          | Liveness check, returns `{"status":"ok"}`    |

### `POST /api/v1/evaluate`

| Field        | Type   | Notes                                                |
|--------------|--------|------------------------------------------------------|
| `expression` | string | Required, up to 256 characters                       |
| `angleMode`  | string | `"deg"` (default) or `"rad"`; used by trigonometry   |

**curl (macOS, Linux, Git Bash)**

```bash
curl -s -X POST localhost:8080/api/v1/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"expression":"(10 + 5) * 2 - 8 / 4"}'
# {"expression":"(10 + 5) * 2 - 8 / 4","angleMode":"deg","result":28}

curl -s -X POST localhost:8080/api/v1/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"expression":"sin(30)","angleMode":"rad"}'
# {"expression":"sin(30)","angleMode":"rad","result":-0.988031624092862}

curl -s -X POST localhost:8080/api/v1/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"expression":"1 / 0"}'
# 400 {"error":{"code":"division_by_zero","message":"division by zero is not allowed"}}
```

**Windows PowerShell.** In PowerShell `curl` is an alias for `Invoke-WebRequest`,
so the commands above do not work as written. Use:

```powershell
$body = @{ expression = "(10 + 5) * 2 - 8 / 4" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/v1/evaluate `
  -ContentType "application/json" -Body $body

# Errors come back as HTTP 400, which PowerShell raises as an exception.
# The JSON error body is in ErrorDetails:
try {
  $body = @{ expression = "1 / 0" } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/v1/evaluate `
    -ContentType "application/json" -Body $body
} catch { $_.ErrorDetails.Message }
```

Or call `curl.exe` (note the `.exe`), which is the real curl shipped with
Windows 10/11: `curl.exe -s -X POST localhost:8080/api/v1/evaluate -H "Content-Type: application/json" -d "{\"expression\":\"2+2\"}"`.

### Expressions that work

| Expression       | Result | Note                                              |
|------------------|--------|---------------------------------------------------|
| `25 + 15`        | `40`   |                                                   |
| `-2 ^ 2`         | `-4`   | power binds tighter than unary minus              |
| `2 ^ 3 ^ 2`      | `512`  | power is right associative                        |
| `200 * 15%`      | `30`   | `15%` alone is `0.15`                             |
| `200 + 15%`      | `230`  | after `+` or `-`, percent is *of the left side*   |
| `17 mod 5`       | `2`    |                                                   |
| `5!`             | `120`  |                                                   |
| `sqrt(81)`       | `9`    |                                                   |
| `root(4, 16)`    | `2`    | fourth root of 16                                 |
| `log(100)`       | `2`    | base 10                                           |
| `ln(e)`          | `1`    | `e` and `pi` are constants                        |
| `round(4.67, 1)` | `4.7`  | halves round away from zero                       |
| `0.1 + 0.2`      | `0.3`  | results keep 15 significant digits                |

### Errors

Every error has one shape. Client mistakes are `400`; unexpected failures are
`500` with a generic message (details are logged, never returned). `position` is
the zero-based character the error refers to and appears only when there is one.

```json
{"error":{"code":"syntax_error","message":"missing closing \")\"","position":6}}
```

| Code                   | Cause                                                           |
|------------------------|-----------------------------------------------------------------|
| `invalid_json`         | Malformed body, wrong types, unknown fields, body over 4 KiB    |
| `invalid_angle_mode`   | `angleMode` is not `deg` or `rad`                               |
| `empty_expression`     | Missing or blank expression                                     |
| `expression_too_long`  | More than 256 characters                                        |
| `too_deeply_nested`    | More than 64 levels of parentheses or chained signs             |
| `syntax_error`         | Not a valid expression (has `position`)                         |
| `unknown_function`     | Unknown function name (has `position`)                          |
| `unknown_identifier`   | Unknown constant name (has `position`)                          |
| `wrong_argument_count` | e.g. `sin(1, 2)`, `root(4)` (has `position`)                    |
| `division_by_zero`     | `x / 0`, `x mod 0`                                              |
| `domain_error`         | `sqrt(-9)`, `ln(0)`, `asin(2)`, `(-1)!`                         |
| `undefined_result`     | `0 ^ -1`, `(-2) ^ 0.5`, `tan(90)` in degrees                    |
| `overflow`             | Result or number too large (`10 ^ 1000`, `171!`)                |
| `internal_error`       | `500`; unexpected failure                                       |

More examples (every function, every error): [`docs/api-examples.md`](docs/api-examples.md).

## 6. Tests and coverage

```bash
# backend
cd backend
go test ./... -coverprofile=coverage.out
go tool cover -func=coverage.out        # per function
go tool cover -html=coverage.out        # browsable report

# frontend
cd frontend
npm test                                # run once
npm run coverage                        # text table + HTML in frontend/coverage/
```

| Layer                | Tests                              | Statement coverage |
|----------------------|------------------------------------|--------------------|
| Go `calcerr`         | error type and codes               | 100%               |
| Go `calculator`      | every function, angle modes        | 100%               |
| Go `expression`      | lexer, parser, evaluator           | 98.5%              |
| Go `handler`         | status codes, JSON shapes, middleware | 98.6%           |
| Go `cmd/api`         | not unit tested (process wiring)   | 0%                 |
| **Go total**         | **247 test cases**                 | **93.4%**          |
| **Frontend**         | **230 tests**                      | **99.4%** (98.1% branches) |

The full report, with the per-function breakdown and the reason each uncovered
line is uncovered, is in [`docs/coverage-report.md`](docs/coverage-report.md).

What the tests check, beyond `2 + 2 = 4`:

- **Backend**: precedence and associativity (`2^3^2 = 512`, `-2^2 = -4`), percent rules, DEG vs RAD, exact values at multiples of 90° (`cos(90) = 0`, not `6e-17`), every error path, input limits, and that internal errors never leak details.
- **Frontend**: the expression editor rules, the reducer state machine, keyboard mapping, and the whole UI driven by key presses against a fake backend (results, errors, loading, memory, history, angle mode).
- **A race condition**: pressing `AC` while a request is in flight discards the late answer instead of overwriting the new screen. Five tests cover this and fail if the fix is removed.

## 7. Project structure

```
backend/
  cmd/api/main.go             composition root: wiring, server, graceful shutdown
  internal/calcerr/           one error type with stable codes, shared by all layers
  internal/expression/        token.go lexer.go parser.go ast.go evaluator.go
  internal/calculator/        built-in functions, constants, angle mode, Service
  internal/handler/           HTTP adapter: routes, strict decoding, error mapping, middleware
  internal/model/             request/response types
  Dockerfile
frontend/
  src/domain/                 pure logic: editor, formatting, key definitions, keyboard map
  src/state/                  reducer: the calculator as a state machine
  src/hooks/                  useCalculator (state + backend), useKeyboard
  src/services/               calculatorApi.ts: fetch client behind an interface
  src/components/             presentational components
  src/types/                  shared TypeScript types
  Dockerfile, nginx.conf
docs/
  api-examples.md             more API calls and the error table
  coverage-report.md          measured coverage, explained
docker-compose.yml
```

## 8. Design decisions

**Why the backend evaluates whole expressions.** Parentheses and operator
precedence cannot be done correctly by sending one operation at a time, so the
backend has a real parser: lexer, recursive-descent parser, AST, evaluator. The
grammar, loosest to tightest binding:

```
expression = term { ("+" | "-") term }
term       = unary { ("*" | "/" | "mod") unary }
unary      = ("-" | "+") unary | power
power      = postfix [ "^" unary ]          right associative
postfix    = primary { "!" | "%" }
primary    = number | name | name "(" args ")" | "(" expression ")"
```

Each rule is one small method, which keeps the parser readable and testable.
Input is capped at 256 characters and 64 nesting levels so a request cannot make
it do unbounded work.

**SOLID in practice**
- *Single responsibility*: lexer, parser and evaluator are separate stages. `calculator` decides what functions exist; `handler` only speaks HTTP; the editor functions know nothing about React; components only render.
- *Open/closed*: adding a function is one entry in `builtinFunctions()` (backend) and one entry in `keys.ts` (frontend). The keypad renders any list of key definitions, so it does not change.
- *Liskov / interface segregation*: the evaluator needs a two-method `Environment`; the handler needs a two-method `Evaluator`; the UI needs only `CalculatorApi.evaluate`. Tests pass small fakes.
- *Dependency inversion*: high-level code depends on those small interfaces. Concrete types are wired in one place each (`cmd/api/main.go`, `App.tsx`).

**One error type.** `calcerr.Error{Code, Message, Position}` is used by every
layer. The handler maps codes to HTTP status; the frontend shows the message. A
stable `code` lets clients branch without parsing text.

**Standard library only in Go.** Go 1.22's `net/http` router handles method
patterns (`"POST /api/v1/evaluate"`), and `log/slog` handles logging, so no
framework is needed. Middleware (panic recovery, request logging, CORS) is small
and tested. The server shuts down gracefully on SIGINT/SIGTERM.

**Frontend.**
- Key presses become a typed `Command`, handled by a pure editor function and a reducer. The editing rules and the state machine are plain functions with unit tests; the React layer stays thin.
- The canonical expression is plain ASCII (`2*pi`); a separate function prettifies it for display (`2 × π`).
- Keypads are data (`keys.ts`), not hand-written JSX.
- Stale responses are dropped with a ticket held in a ref.
- Visual design: dark, rounded-square keys, cobalt operators, a single amber `=` as the one warm accent. On wide screens the scientific and basic keypads sit side by side; on phones the scientific keys open from a toggle.

## 9. Assumptions

These are choices the brief did not specify. Each is covered by a test.

- **Percent.** `15%` alone is `0.15`. In a product or quotient it is `n/100` (`200 × 15% = 30`). As the right side of `+` or `−` it means *a percentage of the left side* (`200 + 10% = 220`, `200 − 10% = 180`), as on most handheld calculators. Parentheses only group and do not change this (`200 + (10%)` is also `220`).
- **Precedence.** `-2^2 = -4`; `2^3^2 = 2^9 = 512`; `2^3! = 2^6`.
- **Modulo** takes the sign of the dividend (`-7 mod 3 = -1`). `x mod 0` is a division-by-zero error.
- **Degrees by default.** `sin(30) = 0.5`. In degree mode, multiples of 90° give exact values and `tan(90)` is an `undefined_result` error rather than a huge number.
- **Errors are decided by the backend**, not guessed by the UI: `sqrt(-9)`, `ln(0)`, `asin(2)`, `(-1)!`, `0^-1`, `(-2)^0.5`. Overflow (`10^1000`, `171!`) is an error because infinity is not valid JSON. Factorial is limited to 170.
- **Odd roots** of negative numbers work (`cbrt(-27) = -3`, `root(5, -32) = -2`); even roots do not.
- **Rounding.** Results keep 15 significant digits, so `0.1 + 0.2` is `0.3`. `round` rounds halves away from zero. The display shows 12 digits.
- **No implicit multiplication in the API** (`2(3)` is a syntax error). The UI inserts the `×` when you press a function, constant or parenthesis after a number.
- **Memory** acts on the displayed result; `M+` first calculates a pending expression. `MR` inserts the stored value, in parentheses if negative.
- **State is not persisted.** History and memory reset on reload. The API is stateless.
- **Comma** is treated as a decimal comma outside a function call, so it works on Turkish and other European keyboards.
- **Single-user, local use.** CORS allows one configurable origin.

## 10. Known limitations and next steps

Not done on purpose, to stay inside the time box and keep the focus on
correctness and structure: authentication, persistence of history or memory,
rate limiting, localization, a light theme.

Next, if this were going further:
- Arbitrary-precision arithmetic (`math/big`) instead of `float64`.
- An end-to-end browser test (Playwright) in CI.
- A CI workflow running both test suites and publishing the coverage reports.
- Persist history per user behind a login.
- An OpenAPI description generated from the handler types.

## 11. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `go : The term 'go' is not recognized` | Go is not installed, or the terminal predates the install. Install Go, then open a **new** terminal (or run the `$env:Path` line from section 4). |
| `go: cannot find main module` / `package ./cmd/api is not in std` | You ran the command in the wrong folder. `cd backend` first. |
| `npm : ... package.json not found` | Same issue: `cd frontend` first. |
| Page loads but every calculation shows a network error | The backend is not running, or not on port 8080. Start it in the other terminal; check <http://localhost:8080/health>. |
| `bind: address already in use` / `EADDRINUSE` | Port 8080 or 5173 is taken. Set another backend port with `PORT=9090` (PowerShell: `$env:PORT = "9090"`), and change the proxy target in `frontend/vite.config.ts` to match. |
| Browser console shows a CORS error | You opened the frontend on a different origin than `CORS_ALLOWED_ORIGIN`. Use <http://localhost:5173> or set the variable to your origin. |
| `curl` in PowerShell prints a security warning or a parameter error | It is an alias for `Invoke-WebRequest`. Use `Invoke-RestMethod` or `curl.exe` (section 5). |
| `EBADENGINE` warning during `npm install` | Your Node version is outside the range a dev dependency prefers. The warning is harmless; use Node 20 or 22 LTS to remove it. |
| Docker build fails | Use Option A (local run). Check `docker --version` and that Docker Desktop is running. |

