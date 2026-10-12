# AI prompts used

I used Claude as a pair programmer for this assignment. I ran everything locally, read the code, and can explain every design decision in it.

## 1. Understanding the assignment
> Sezzle sent me a take-home case for a Junior Software Engineer role: a React frontend and a microservice backend that performs the calculator operations. Here is the assignment text and my own analysis. Help me turn it into a plan.

Result: scope, architecture (React + TypeScript, Go REST API), and a time plan.

## 2. First implementation
> Build this as a high-quality, SOLID-compliant project with a clean architecture, following the structure and plan from the analysis. Verify by actually running the tests.

Result: a first version with a form-based UI and one operation per request (Strategy pattern in Go), plus tests, Dockerfiles and docs.

## 3. Redesign as a scientific calculator
> I don't like this UX. I want something like the iPhone calculator, but not an exact copy. I also want to grow it into a professional calculator: basic operations, percent, modulo, reciprocal, abs, rounding, powers and roots, factorial, logarithms, trigonometry with DEG/RAD, parentheses with operator precedence (an expression parser), memory, clear/backspace and history. Keep SOLID and clean architecture. (Followed by my list of the operations and edge cases such as 1/0, sqrt(-9), (-2)^0.5 and overflow, which must be validated in the backend.)

Result:
- Backend rewritten around a lexer, a recursive-descent parser and an evaluator behind small interfaces.
- Frontend rebuilt around a pure expression editor, a reducer state machine and data-driven keypads.
- Screenshots on desktop and mobile widths were used to review the layout; that caught a CSS width bug (the React mount point shrank the calculator).
- A browser run with fast key presses exposed a race condition (a late response overwriting a newer screen); it was fixed and covered by tests that fail without the fix.

## What I did myself
- Chose the scope, the percent behavior and the visual direction.
- Ran both test suites and the app locally, and read the coverage reports.
- Reviewed the code and removed anything I could not explain.
