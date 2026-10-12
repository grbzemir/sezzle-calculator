// Package model holds the HTTP transport types (request and response bodies).
package model

// EvaluateRequest is the body of POST /api/v1/evaluate.
type EvaluateRequest struct {
	Expression string `json:"expression"`
	// AngleMode is "deg" (default) or "rad".
	AngleMode string `json:"angleMode,omitempty"`
}

// EvaluateResponse is returned on success.
type EvaluateResponse struct {
	Expression string  `json:"expression"`
	AngleMode  string  `json:"angleMode"`
	Result     float64 `json:"result"`
}

// FunctionDescriptor is one entry of GET /api/v1/functions.
type FunctionDescriptor struct {
	Name    string `json:"name"`
	MinArgs int    `json:"minArgs"`
	MaxArgs int    `json:"maxArgs"`
}

// FunctionsResponse is returned by GET /api/v1/functions.
type FunctionsResponse struct {
	Functions []FunctionDescriptor `json:"functions"`
}

// ErrorBody describes a failure. Position is the zero-based character index in
// the expression that the error refers to, when there is one.
type ErrorBody struct {
	Code     string `json:"code"`
	Message  string `json:"message"`
	Position *int   `json:"position,omitempty"`
}

// ErrorResponse is the single error format used by every endpoint.
type ErrorResponse struct {
	Error ErrorBody `json:"error"`
}
