package calculator

import (
	"math"
	"testing"

	"sezzle-calculator/backend/internal/calcerr"
)

func TestService_Evaluate(t *testing.T) {
	svc := NewService()

	tests := []struct {
		input string
		mode  AngleMode
		want  float64
	}{
		// Everyday arithmetic from the specification
		{"25 + 15", Degrees, 40},
		{"25 - 15", Degrees, 10},
		{"25 * 15", Degrees, 375},
		{"25 / 5", Degrees, 5},
		{"(10 + 5) * 2 - 8 / 4", Degrees, 28},
		{"0.1 + 0.2", Degrees, 0.3},

		// Everyday helpers
		{"-(-12)", Degrees, 12},
		{"200 * 15%", Degrees, 30},
		{"200 + 15%", Degrees, 230},
		{"17 mod 5", Degrees, 2},
		{"1/4", Degrees, 0.25},
		{"abs(-15)", Degrees, 15},
		{"round(4.67, 1)", Degrees, 4.7},
		{"round(4.5)", Degrees, 5},
		{"round(-4.5)", Degrees, -5},
		{"round(1234.5678, -2)", Degrees, 1200},
		{"floor(4.9)", Degrees, 4},
		{"floor(-4.1)", Degrees, -5},
		{"ceil(4.1)", Degrees, 5},
		{"ceil(-4.9)", Degrees, -4},

		// Powers, roots, logs
		{"5^2", Degrees, 25},
		{"3^3", Degrees, 27},
		{"2^5", Degrees, 32},
		{"sqrt(81)", Degrees, 9},
		{"cbrt(27)", Degrees, 3},
		{"cbrt(-27)", Degrees, -3},
		{"root(4, 16)", Degrees, 2},
		{"root(3, 27)", Degrees, 3},
		{"root(2, 49)", Degrees, 7},
		{"root(5, -32)", Degrees, -2},
		{"5!", Degrees, 120},
		{"exp(0)", Degrees, 1},
		{"10^3", Degrees, 1000},
		{"log2(8)", Degrees, 3},
		{"log(100)", Degrees, 2},
		{"ln(e)", Degrees, 1},
		{"e^0", Degrees, 1},
		{"pi", Degrees, math.Pi},
		{"2 * pi", Degrees, 2 * math.Pi},
		{"π", Degrees, math.Pi},

		// Trigonometry in degrees
		{"sin(30)", Degrees, 0.5},
		{"cos(60)", Degrees, 0.5},
		{"tan(45)", Degrees, 1},
		{"sin(0)", Degrees, 0},
		{"sin(90)", Degrees, 1},
		{"cos(90)", Degrees, 0},
		{"cos(0)", Degrees, 1},
		{"sin(180)", Degrees, 0},
		{"cos(180)", Degrees, -1},
		{"sin(270)", Degrees, -1},
		{"cos(270)", Degrees, 0},
		{"sin(-90)", Degrees, -1},
		{"sin(450)", Degrees, 1},
		{"tan(0)", Degrees, 0},
		{"tan(180)", Degrees, 0},
		{"asin(0.5)", Degrees, 30},
		{"acos(0.5)", Degrees, 60},
		{"atan(1)", Degrees, 45},
		{"asin(1)", Degrees, 90},

		// Trigonometry in radians
		{"sin(pi / 2)", Radians, 1},
		{"cos(pi)", Radians, -1},
		{"sin(30)", Radians, -0.988031624092862},
		{"tan(pi / 4)", Radians, 1},
		{"asin(1)", Radians, math.Pi / 2},
		{"atan(1)", Radians, math.Pi / 4},
		{"sin(pi)", Radians, 0},

		// Hyperbolic
		{"sinh(0)", Degrees, 0},
		{"cosh(0)", Degrees, 1},
		{"tanh(0)", Degrees, 0},
		{"sinh(1)", Radians, 1.1752011936438},
	}

	for _, tt := range tests {
		t.Run(string(tt.mode)+"/"+tt.input, func(t *testing.T) {
			got, err := svc.Evaluate(tt.input, tt.mode)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if math.Abs(got-tt.want) > 1e-12*math.Max(1, math.Abs(tt.want)) {
				t.Fatalf("got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestService_Evaluate_Errors(t *testing.T) {
	svc := NewService()

	tests := []struct {
		input string
		code  calcerr.Code
	}{
		{"1/0", calcerr.CodeDivisionByZero},
		{"1/(2-2)", calcerr.CodeDivisionByZero},
		{"5 mod 0", calcerr.CodeDivisionByZero},
		{"sqrt(-9)", calcerr.CodeDomain},
		{"root(2, -4)", calcerr.CodeDomain},
		{"root(4, -16)", calcerr.CodeDomain},
		{"root(0, 5)", calcerr.CodeDomain},
		{"root(0.5, -4)", calcerr.CodeDomain},
		{"ln(0)", calcerr.CodeDomain},
		{"ln(-1)", calcerr.CodeDomain},
		{"log(0)", calcerr.CodeDomain},
		{"log2(-8)", calcerr.CodeDomain},
		{"asin(2)", calcerr.CodeDomain},
		{"acos(-1.5)", calcerr.CodeDomain},
		{"round(1.5, 0.5)", calcerr.CodeDomain},
		{"round(1.5, 99)", calcerr.CodeDomain},
		{"0^-1", calcerr.CodeUndefinedResult},
		{"(-2)^0.5", calcerr.CodeUndefinedResult},
		{"tan(90)", calcerr.CodeUndefinedResult},
		{"tan(270)", calcerr.CodeUndefinedResult},
		{"10^1000", calcerr.CodeOverflow},
		{"exp(1000)", calcerr.CodeOverflow},
		{"sinh(1000)", calcerr.CodeOverflow},
		{"171!", calcerr.CodeOverflow},
		{"(-1)!", calcerr.CodeDomain},
		{"foo(1)", calcerr.CodeUnknownFunction},
		{"sin()", calcerr.CodeWrongArgumentCount},
		{"sin(1, 2)", calcerr.CodeWrongArgumentCount},
		{"root(4)", calcerr.CodeWrongArgumentCount},
		{"round(1, 2, 3)", calcerr.CodeWrongArgumentCount},
		{"x", calcerr.CodeUnknownIdentifier},
		{"2 +", calcerr.CodeSyntax},
		{"", calcerr.CodeEmptyExpression},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			_, err := svc.Evaluate(tt.input, Degrees)
			if err == nil {
				t.Fatal("expected an error")
			}
			if got := calcerr.CodeOf(err); got != tt.code {
				t.Fatalf("code = %q, want %q (err: %v)", got, tt.code, err)
			}
		})
	}
}

func TestService_Evaluate_NeverReturnsNegativeZero(t *testing.T) {
	got, err := NewService().Evaluate("-0", Degrees)
	if err != nil {
		t.Fatal(err)
	}
	if math.Signbit(got) {
		t.Fatalf("got negative zero")
	}
}

func TestService_Evaluate_LargestFiniteNumberSurvivesRounding(t *testing.T) {
	got, err := NewService().Evaluate("1.7976931348623157e308", Degrees)
	if err != nil || math.IsInf(got, 0) {
		t.Fatalf("got %v, %v", got, err)
	}
}

func TestService_Functions(t *testing.T) {
	infos := NewService().Functions()
	if len(infos) != len(builtinFunctions()) {
		t.Fatalf("got %d functions, want %d", len(infos), len(builtinFunctions()))
	}

	byName := map[string]FunctionInfo{}
	for _, info := range infos {
		byName[info.Name] = info
	}
	if round := byName["round"]; round.MinArgs != 1 || round.MaxArgs != 2 {
		t.Errorf("round arity = %d..%d, want 1..2", round.MinArgs, round.MaxArgs)
	}
	if infos[0].Name != "sin" {
		t.Errorf("functions must keep registration order, first = %q", infos[0].Name)
	}
}

func TestParseAngleMode(t *testing.T) {
	tests := []struct {
		input   string
		want    AngleMode
		wantErr bool
	}{
		{"", Degrees, false},
		{"deg", Degrees, false},
		{" DEG ", Degrees, false},
		{"rad", Radians, false},
		{"Rad", Radians, false},
		{"grad", "", true},
	}
	for _, tt := range tests {
		got, err := ParseAngleMode(tt.input)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q: err = %v, wantErr %v", tt.input, err, tt.wantErr)
		}
		if err != nil && calcerr.CodeOf(err) != calcerr.CodeInvalidAngleMode {
			t.Errorf("%q: wrong code %v", tt.input, err)
		}
		if got != tt.want {
			t.Errorf("%q: got %q, want %q", tt.input, got, tt.want)
		}
	}
}
