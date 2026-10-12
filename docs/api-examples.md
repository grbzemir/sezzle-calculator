# API examples

Base URL (local): `http://localhost:8080`

The backend evaluates a whole expression. It owns the grammar, the operator
precedence and every numeric rule; clients only send text.

## Evaluate

`POST /api/v1/evaluate`

| Field        | Type   | Notes                                              |
|--------------|--------|----------------------------------------------------|
| `expression` | string | Required, up to 256 characters                     |
| `angleMode`  | string | `"deg"` (default) or `"rad"`; used by trigonometry |

### Success

```bash
curl -s -X POST localhost:8080/api/v1/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"expression":"(10 + 5) * 2 - 8 / 4"}'
```
```json
{"expression":"(10 + 5) * 2 - 8 / 4","angleMode":"deg","result":28}
```

Trigonometry depends on the angle mode:

```bash
curl -s -X POST localhost:8080/api/v1/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"expression":"sin(30)","angleMode":"deg"}'
# {"expression":"sin(30)","angleMode":"deg","result":0.5}

curl -s -X POST localhost:8080/api/v1/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"expression":"sin(30)","angleMode":"rad"}'
# {"expression":"sin(30)","angleMode":"rad","result":-0.988031624092862}
```

More expressions that work:

| Expression             | Result  | Note                                          |
|------------------------|---------|-----------------------------------------------|
| `25 + 15`              | `40`    |                                               |
| `-2 ^ 2`               | `-4`    | power binds tighter than unary minus          |
| `2 ^ 3 ^ 2`            | `512`   | power is right associative                    |
| `200 * 15%`            | `30`    | `15%` alone is `0.15`                         |
| `200 + 15%`            | `230`   | after `+` or `-`, percent is *of the left side* |
| `17 mod 5`             | `2`     |                                               |
| `5!`                   | `120`   |                                               |
| `sqrt(81)`             | `9`     |                                               |
| `root(4, 16)`          | `2`     | fourth root of 16                             |
| `cbrt(-27)`            | `-3`    |                                               |
| `log(100)`             | `2`     | base 10                                       |
| `log2(8)`              | `3`     |                                               |
| `ln(e)`                | `1`     | `e` and `pi` are constants                    |
| `round(4.67, 1)`       | `4.7`   | halves round away from zero                   |
| `floor(4.9)`           | `4`     |                                               |
| `asin(0.5)`            | `30`    | result is in the active angle unit            |
| `0.1 + 0.2`            | `0.3`   | results keep 15 significant digits            |

### Errors

Every error uses one shape and `400 Bad Request` for client mistakes.
`position` is the zero-based character index the error refers to; it is only
present when there is one.

```bash
curl -s -i -X POST localhost:8080/api/v1/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"expression":"1 / 0"}'
```
```json
{"error":{"code":"division_by_zero","message":"division by zero is not allowed"}}
```

```bash
curl -s -X POST localhost:8080/api/v1/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"expression":"2 * (3"}'
# {"error":{"code":"syntax_error","message":"missing closing \")\"","position":6}}
```

| Code                   | Cause                                                              |
|------------------------|--------------------------------------------------------------------|
| `invalid_json`         | Malformed body, wrong types, unknown fields, body over 4 KiB       |
| `invalid_angle_mode`   | `angleMode` is not `deg` or `rad`                                  |
| `empty_expression`     | Missing or blank expression                                        |
| `expression_too_long`  | More than 256 characters                                           |
| `too_deeply_nested`    | More than 64 levels of parentheses or chained signs                |
| `syntax_error`         | Not a valid expression (has `position`)                            |
| `unknown_function`     | Unknown function name (has `position`)                             |
| `unknown_identifier`   | Unknown constant name (has `position`)                             |
| `wrong_argument_count` | e.g. `sin(1, 2)`, `root(4)` (has `position`)                       |
| `division_by_zero`     | `x / 0`, `x mod 0`                                                 |
| `domain_error`         | `sqrt(-9)`, `ln(0)`, `asin(2)`, `(-1)!`, `root(2, -4)`, ...        |
| `undefined_result`     | `0 ^ -1`, `(-2) ^ 0.5`, `tan(90)` in degrees                       |
| `overflow`             | Result or number too large (`10 ^ 1000`, `171!`, `1e999`)          |
| `internal_error`       | `500`; unexpected failure, details are logged and never returned   |

## List functions

`GET /api/v1/functions`

```json
{"functions":[{"name":"sin","minArgs":1,"maxArgs":1}, ... ,{"name":"round","minArgs":1,"maxArgs":2}]}
```

## Health

`GET /health` returns `{"status":"ok"}`.
