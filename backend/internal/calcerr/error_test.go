package calcerr

import (
	"errors"
	"fmt"
	"testing"
)

func TestNew_HasNoPosition(t *testing.T) {
	err := New(CodeDomain, "bad input")

	if err.Error() != "bad input" {
		t.Errorf("Error() = %q", err.Error())
	}
	if err.Position != nil {
		t.Errorf("Position = %v, want nil", *err.Position)
	}
}

func TestAt_RecordsPosition(t *testing.T) {
	err := At(CodeSyntax, 7, "unexpected")

	if err.Position == nil || *err.Position != 7 {
		t.Fatalf("Position = %v, want 7", err.Position)
	}
}

func TestIs_MatchesOnCode(t *testing.T) {
	err := fmt.Errorf("wrapped: %w", New(CodeOverflow, "too big"))

	if !errors.Is(err, New(CodeOverflow, "")) {
		t.Error("errors.Is should match the same code")
	}
	if errors.Is(err, New(CodeDomain, "")) {
		t.Error("errors.Is should not match a different code")
	}
	if errors.Is(err, errors.New("other")) {
		t.Error("errors.Is should not match a foreign error")
	}
}

func TestCodeOf(t *testing.T) {
	if got := CodeOf(fmt.Errorf("wrapped: %w", New(CodeSyntax, "x"))); got != CodeSyntax {
		t.Errorf("wrapped *Error: got %q", got)
	}
	if got := CodeOf(errors.New("plain")); got != CodeInternal {
		t.Errorf("plain error: got %q, want internal", got)
	}
}
