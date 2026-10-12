package handler

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"sezzle-calculator/backend/internal/calcerr"
	"sezzle-calculator/backend/internal/calculator"
	"sezzle-calculator/backend/internal/model"
)

func newTestServer(evaluator Evaluator) http.Handler {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	return New(evaluator, logger).Routes()
}

func doRequest(t *testing.T, srv http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	return rec
}

func TestEvaluate_Success(t *testing.T) {
	srv := newTestServer(calculator.NewService())

	tests := []struct {
		name string
		body string
		want float64
		mode string
	}{
		{"precedence and parentheses", `{"expression":"(10 + 5) * 2 - 8 / 4"}`, 28, "deg"},
		{"decimals", `{"expression":"12.5 * 2"}`, 25, "deg"},
		{"percent", `{"expression":"200 + 15%"}`, 230, "deg"},
		{"degrees by default", `{"expression":"sin(30)"}`, 0.5, "deg"},
		{"explicit degrees", `{"expression":"sin(30)","angleMode":"deg"}`, 0.5, "deg"},
		{"radians", `{"expression":"cos(0)","angleMode":"rad"}`, 1, "rad"},
		{"zero is a valid result", `{"expression":"1 - 1"}`, 0, "deg"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := doRequest(t, srv, http.MethodPost, "/api/v1/evaluate", tt.body)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body)
			}
			if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
				t.Errorf("Content-Type = %q", ct)
			}
			var resp model.EvaluateResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatal(err)
			}
			if resp.Result != tt.want {
				t.Errorf("result = %v, want %v", resp.Result, tt.want)
			}
			if resp.AngleMode != tt.mode {
				t.Errorf("angleMode = %q, want %q", resp.AngleMode, tt.mode)
			}
		})
	}
}

func TestEvaluate_Errors(t *testing.T) {
	srv := newTestServer(calculator.NewService())

	tests := []struct {
		name     string
		body     string
		wantCode calcerr.Code
	}{
		{"division by zero", `{"expression":"1/0"}`, calcerr.CodeDivisionByZero},
		{"negative square root", `{"expression":"sqrt(-9)"}`, calcerr.CodeDomain},
		{"overflow", `{"expression":"10^1000"}`, calcerr.CodeOverflow},
		{"undefined result", `{"expression":"(-2)^0.5"}`, calcerr.CodeUndefinedResult},
		{"syntax error", `{"expression":"2 +"}`, calcerr.CodeSyntax},
		{"unknown function", `{"expression":"foo(1)"}`, calcerr.CodeUnknownFunction},
		{"empty expression", `{"expression":"  "}`, calcerr.CodeEmptyExpression},
		{"missing expression", `{}`, calcerr.CodeEmptyExpression},
		{"expression too long", `{"expression":"` + strings.Repeat("1", 300) + `"}`, calcerr.CodeExpressionTooLong},
		{"invalid angle mode", `{"expression":"1","angleMode":"grad"}`, calcerr.CodeInvalidAngleMode},
		{"malformed json", `{"expression":`, calcerr.CodeInvalidJSON},
		{"empty body", ``, calcerr.CodeInvalidJSON},
		{"expression is a number", `{"expression":5}`, calcerr.CodeInvalidJSON},
		{"unknown field", `{"expression":"1","extra":true}`, calcerr.CodeInvalidJSON},
		{"trailing data", `{"expression":"1"} {}`, calcerr.CodeInvalidJSON},
		{"oversized body", `{"expression":"` + strings.Repeat("x", 5000) + `"}`, calcerr.CodeInvalidJSON},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := doRequest(t, srv, http.MethodPost, "/api/v1/evaluate", tt.body)

			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400; body=%s", rec.Code, rec.Body)
			}
			var resp model.ErrorResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("error body is not valid JSON: %v", err)
			}
			if resp.Error.Code != string(tt.wantCode) {
				t.Errorf("code = %q, want %q", resp.Error.Code, tt.wantCode)
			}
			if resp.Error.Message == "" {
				t.Error("message must not be empty")
			}
		})
	}
}

func TestEvaluate_SyntaxErrorIncludesPosition(t *testing.T) {
	srv := newTestServer(calculator.NewService())

	rec := doRequest(t, srv, http.MethodPost, "/api/v1/evaluate", `{"expression":"2 + * 3"}`)

	var resp model.ErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.Error.Position == nil || *resp.Error.Position != 4 {
		t.Fatalf("position = %v, want 4", resp.Error.Position)
	}
}

func TestEvaluate_ErrorsWithoutPositionOmitTheField(t *testing.T) {
	srv := newTestServer(calculator.NewService())

	rec := doRequest(t, srv, http.MethodPost, "/api/v1/evaluate", `{"expression":"1/0"}`)

	if strings.Contains(rec.Body.String(), "position") {
		t.Errorf("position should be omitted: %s", rec.Body)
	}
}

// stubEvaluator lets tests force arbitrary failures.
type stubEvaluator struct{ err error }

func (s stubEvaluator) Evaluate(string, calculator.AngleMode) (float64, error) { return 0, s.err }
func (stubEvaluator) Functions() []calculator.FunctionInfo                     { return nil }

func TestEvaluate_UnexpectedErrorsDoNotLeakDetails(t *testing.T) {
	for name, failure := range map[string]error{
		"plain error":    errors.New("database exploded: secret details"),
		"internal error": calcerr.New(calcerr.CodeInternal, "secret details"),
	} {
		t.Run(name, func(t *testing.T) {
			srv := newTestServer(stubEvaluator{err: failure})

			rec := doRequest(t, srv, http.MethodPost, "/api/v1/evaluate", `{"expression":"1+1"}`)

			if rec.Code != http.StatusInternalServerError {
				t.Fatalf("status = %d, want 500", rec.Code)
			}
			if strings.Contains(rec.Body.String(), "secret") {
				t.Errorf("internal error leaked to client: %s", rec.Body)
			}
		})
	}
}

func TestHealth(t *testing.T) {
	rec := doRequest(t, newTestServer(calculator.NewService()), http.MethodGet, "/health", "")

	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"ok"`) {
		t.Fatalf("got %d %s", rec.Code, rec.Body)
	}
}

func TestFunctions(t *testing.T) {
	rec := doRequest(t, newTestServer(calculator.NewService()), http.MethodGet, "/api/v1/functions", "")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var resp model.FunctionsResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Functions) == 0 {
		t.Fatal("no functions returned")
	}
	found := false
	for _, fn := range resp.Functions {
		if fn.Name == "round" {
			found = true
			if fn.MinArgs != 1 || fn.MaxArgs != 2 {
				t.Errorf("round arity = %d..%d", fn.MinArgs, fn.MaxArgs)
			}
		}
	}
	if !found {
		t.Error("round missing from functions list")
	}
}

func TestRoutes_MethodNotAllowed(t *testing.T) {
	srv := newTestServer(calculator.NewService())

	rec := doRequest(t, srv, http.MethodGet, "/api/v1/evaluate", "")
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", rec.Code)
	}
}
