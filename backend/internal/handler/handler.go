// Package handler is the HTTP adapter: it translates requests into calls on
// the calculator and failures into one consistent JSON error format.
package handler

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"sezzle-calculator/backend/internal/calcerr"
	"sezzle-calculator/backend/internal/calculator"
	"sezzle-calculator/backend/internal/model"
)

const maxBodyBytes = 4 << 10 // 4 KiB is far more than any valid request needs.

// Evaluator is the behaviour the handler needs (Dependency Inversion): it
// depends on this small interface, not on a concrete service.
type Evaluator interface {
	Evaluate(expression string, mode calculator.AngleMode) (float64, error)
	Functions() []calculator.FunctionInfo
}

// Handler serves the calculator HTTP API.
type Handler struct {
	evaluator Evaluator
	logger    *slog.Logger
}

// New creates a Handler.
func New(evaluator Evaluator, logger *slog.Logger) *Handler {
	return &Handler{evaluator: evaluator, logger: logger}
}

// Routes returns the router with all endpoints registered.
func (h *Handler) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", h.health)
	mux.HandleFunc("GET /api/v1/functions", h.functions)
	mux.HandleFunc("POST /api/v1/evaluate", h.evaluate)
	return mux
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	h.writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) functions(w http.ResponseWriter, _ *http.Request) {
	infos := h.evaluator.Functions()
	resp := model.FunctionsResponse{Functions: make([]model.FunctionDescriptor, 0, len(infos))}
	for _, info := range infos {
		resp.Functions = append(resp.Functions, model.FunctionDescriptor{
			Name:    info.Name,
			MinArgs: info.MinArgs,
			MaxArgs: info.MaxArgs,
		})
	}
	h.writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) evaluate(w http.ResponseWriter, r *http.Request) {
	req, err := decodeEvaluateRequest(w, r)
	if err != nil {
		h.writeError(w, err)
		return
	}

	mode, err := calculator.ParseAngleMode(req.AngleMode)
	if err != nil {
		h.writeError(w, err)
		return
	}

	result, err := h.evaluator.Evaluate(req.Expression, mode)
	if err != nil {
		h.writeError(w, err)
		return
	}

	h.writeJSON(w, http.StatusOK, model.EvaluateResponse{
		Expression: req.Expression,
		AngleMode:  string(mode),
		Result:     result,
	})
}

// decodeEvaluateRequest strictly decodes the body: unknown fields, trailing
// data and oversized payloads are all rejected.
func decodeEvaluateRequest(w http.ResponseWriter, r *http.Request) (model.EvaluateRequest, error) {
	var req model.EvaluateRequest

	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		return req, calcerr.New(calcerr.CodeInvalidJSON,
			`request body must be valid JSON like {"expression":"2+3"}: `+err.Error())
	}
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return req, calcerr.New(calcerr.CodeInvalidJSON, "request body must contain a single JSON object")
	}
	return req, nil
}

// writeError maps an error to an HTTP response. Calculator errors are the
// client's mistakes (400); anything else is hidden behind a generic 500.
func (h *Handler) writeError(w http.ResponseWriter, err error) {
	var ce *calcerr.Error
	if errors.As(err, &ce) && ce.Code != calcerr.CodeInternal {
		h.writeJSON(w, http.StatusBadRequest, model.ErrorResponse{
			Error: model.ErrorBody{Code: string(ce.Code), Message: ce.Message, Position: ce.Position},
		})
		return
	}

	h.logger.Error("request failed", "error", err)
	h.writeJSON(w, http.StatusInternalServerError, model.ErrorResponse{
		Error: model.ErrorBody{Code: string(calcerr.CodeInternal), Message: "internal server error"},
	})
}

func (h *Handler) writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		h.logger.Error("failed to write response", "error", err)
	}
}
