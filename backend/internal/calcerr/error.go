// Package calcerr defines the single error type shared by every layer of the
// calculator. Each error carries a stable machine-readable Code, so the HTTP
// layer can map failures without parsing messages and tests can assert on the
// cause rather than on wording.
package calcerr

import "errors"

// Code identifies the kind of failure.
type Code string

const (
	CodeInvalidJSON        Code = "invalid_json"
	CodeInvalidAngleMode   Code = "invalid_angle_mode"
	CodeEmptyExpression    Code = "empty_expression"
	CodeExpressionTooLong  Code = "expression_too_long"
	CodeTooDeeplyNested    Code = "too_deeply_nested"
	CodeSyntax             Code = "syntax_error"
	CodeUnknownFunction    Code = "unknown_function"
	CodeUnknownIdentifier  Code = "unknown_identifier"
	CodeWrongArgumentCount Code = "wrong_argument_count"
	CodeDivisionByZero     Code = "division_by_zero"
	CodeDomain             Code = "domain_error"
	CodeOverflow           Code = "overflow"
	CodeUndefinedResult    Code = "undefined_result"
	CodeInternal           Code = "internal_error"
)

// Error is a calculator failure. Position is the zero-based character index in
// the expression the error refers to, or nil when it does not apply.
type Error struct {
	Code     Code
	Message  string
	Position *int
}

func (e *Error) Error() string { return e.Message }

// Is lets errors.Is(err, calcerr.New(code, "")) match on Code alone.
func (e *Error) Is(target error) bool {
	t, ok := target.(*Error)
	return ok && t.Code == e.Code
}

// New creates an error without a position.
func New(code Code, message string) *Error {
	return &Error{Code: code, Message: message}
}

// At creates an error that points at a character position in the expression.
func At(code Code, position int, message string) *Error {
	return &Error{Code: code, Message: message, Position: &position}
}

// CodeOf returns the Code of err, or CodeInternal when err is not an *Error.
func CodeOf(err error) Code {
	var ce *Error
	if errors.As(err, &ce) {
		return ce.Code
	}
	return CodeInternal
}
