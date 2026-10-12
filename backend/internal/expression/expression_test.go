package expression

import (
	"errors"
	"math"
	"testing"

	"sezzle-calculator/backend/internal/calcerr"
)

// testEnv is a tiny Environment so these tests do not depend on the calculator package.
type testEnv struct{}

func (testEnv) Function(name string) (Function, bool) {
	switch name {
	case "double":
		return Function{Name: name, MinArgs: 1, MaxArgs: 1, Call: func(a []float64) (float64, error) { return a[0] * 2, nil }}, true
	case "add":
		return Function{Name: name, MinArgs: 2, MaxArgs: 3, Call: func(a []float64) (float64, error) {
			sum := 0.0
			for _, v := range a {
				sum += v
			}
			return sum, nil
		}}, true
	case "zero":
		return Function{Name: name, MinArgs: 0, MaxArgs: 0, Call: func([]float64) (float64, error) { return 0, nil }}, true
	case "fail":
		return Function{Name: name, MinArgs: 0, MaxArgs: 0, Call: func([]float64) (float64, error) { return 0, errors.New("boom") }}, true
	}
	return Function{}, false
}

func (testEnv) Constant(name string) (float64, bool) {
	if name == "ten" {
		return 10, true
	}
	return 0, false
}

func run(t *testing.T, input string) (float64, error) {
	t.Helper()
	tree, err := Parse(input)
	if err != nil {
		return 0, err
	}
	return Evaluate(tree, testEnv{})
}

func TestEvaluate_Values(t *testing.T) {
	tests := []struct {
		input string
		want  float64
	}{
		// Basic operators
		{"25 + 15", 40},
		{"25 - 15", 10},
		{"25 * 15", 375},
		{"25 / 5", 5},
		{"12.5 * 2", 25},
		{".5 + 5.", 5.5},
		{"1.5e3 + 1", 1501},
		{"2E-1", 0.2},
		{"7 × 6 ÷ 2 − 1", 20},

		// Precedence and associativity
		{"(10 + 5) * 2 - 8 / 4", 28},
		{"2 + 3 * 4", 14},
		{"(2 + 3) * 4", 20},
		{"10 - 4 - 3", 3},
		{"100 / 10 / 5", 2},
		{"2 ^ 3 ^ 2", 512},
		{"-2 ^ 2", -4},
		{"(-2) ^ 2", 4},
		{"2 ^ -1", 0.5},
		{"2 * 3 ^ 2", 18},
		{"2 ^ 3!", 64},

		// Unary signs
		{"-5 + 3", -2},
		{"--5", 5},
		{"+5", 5},
		{"3 - -2", 5},
		{"-(-12)", 12},

		// Modulo
		{"17 mod 5", 2},
		{"-7 mod 3", -1},
		{"2 + 17 mod 5 * 2", 6},

		// Factorial
		{"5!", 120},
		{"0!", 1},
		{"3! + 1", 7},
		{"(2 + 2)!", 24},

		// Names
		{"ten * 2", 20},
		{"double(21)", 42},
		{"add(1, 2)", 3},
		{"add(1, 2, 3)", 6},
		{"zero()", 0},
		{"double(double(2)) + 1", 9},
		{"DOUBLE(2)", 4},

		// Percent
		{"15%", 0.15},
		{"200 * 15%", 30},
		{"200 / 50%", 400},
		{"200 + 10%", 220},
		{"200 - 10%", 180},
		{"200 + 10% + 10%", 242},
		{"50%%", 0.005},
		{"(100 + 100) + 50%", 300},
		{"200 + (10%)", 220}, // parentheses only group; they are not kept in the tree
		{"15% * 200", 30},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got, err := run(t, tt.input)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if math.Abs(got-tt.want) > 1e-9 {
				t.Fatalf("got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestEvaluate_Errors(t *testing.T) {
	tests := []struct {
		name  string
		input string
		code  calcerr.Code
	}{
		{"empty", "", calcerr.CodeEmptyExpression},
		{"blank", "   ", calcerr.CodeEmptyExpression},
		{"division by zero", "1 / 0", calcerr.CodeDivisionByZero},
		{"division by zero expression", "5 / (3 - 3)", calcerr.CodeDivisionByZero},
		{"modulo by zero", "5 mod 0", calcerr.CodeDivisionByZero},
		{"zero to negative power", "0 ^ -1", calcerr.CodeUndefinedResult},
		{"negative base fractional power", "(-2) ^ 0.5", calcerr.CodeUndefinedResult},
		{"overflow power", "10 ^ 1000", calcerr.CodeOverflow},
		{"overflow multiply", "1e308 * 10", calcerr.CodeOverflow},
		{"number too large", "1e999", calcerr.CodeOverflow},
		{"factorial negative", "(-3)!", calcerr.CodeDomain},
		{"factorial fraction", "2.5!", calcerr.CodeDomain},
		{"factorial too large", "171!", calcerr.CodeOverflow},
		{"unknown function", "nope(1)", calcerr.CodeUnknownFunction},
		{"unknown name", "x + 1", calcerr.CodeUnknownIdentifier},
		{"too few arguments", "double()", calcerr.CodeWrongArgumentCount},
		{"too many arguments", "double(1, 2)", calcerr.CodeWrongArgumentCount},
		{"range arity too many", "add(1, 2, 3, 4)", calcerr.CodeWrongArgumentCount},
		{"trailing operator", "2 +", calcerr.CodeSyntax},
		{"leading operator", "* 2", calcerr.CodeSyntax},
		{"double operator", "2 * / 3", calcerr.CodeSyntax},
		{"unclosed paren", "(1 + 2", calcerr.CodeSyntax},
		{"extra closing paren", "1 + 2)", calcerr.CodeSyntax},
		{"empty parens", "()", calcerr.CodeSyntax},
		{"two numbers", "2 3", calcerr.CodeSyntax},
		{"implicit multiplication", "2(3)", calcerr.CodeSyntax},
		{"unclosed call", "double(1", calcerr.CodeSyntax},
		{"trailing comma", "add(1,", calcerr.CodeSyntax},
		{"missing exponent", "2 ^", calcerr.CodeSyntax},
		{"missing percent operand", "% 5", calcerr.CodeSyntax},
		{"error inside call argument", "double(1 / 0)", calcerr.CodeDivisionByZero},
		{"error inside percent operand", "100 + (1 / 0)%", calcerr.CodeDivisionByZero},
		{"unary failure", "-(1 / 0)", calcerr.CodeDivisionByZero},
		{"error on right side", "1 + 1 / 0", calcerr.CodeDivisionByZero},
		{"bad character", "2 $ 3", calcerr.CodeSyntax},
		{"two dots", "1.2.3", calcerr.CodeSyntax},
		{"lonely dot", ".", calcerr.CodeSyntax},
		{"function failure passes through", "fail()", calcerr.CodeInternal},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := run(t, tt.input)
			if err == nil {
				t.Fatal("expected an error")
			}
			if got := calcerr.CodeOf(err); got != tt.code {
				t.Fatalf("code = %q, want %q (err: %v)", got, tt.code, err)
			}
		})
	}
}

func TestParse_Limits(t *testing.T) {
	long := make([]rune, MaxLength+1)
	for i := range long {
		long[i] = '1'
	}
	if _, err := Parse(string(long)); calcerr.CodeOf(err) != calcerr.CodeExpressionTooLong {
		t.Errorf("long input: got %v", err)
	}

	deep := ""
	for i := 0; i < maxDepth+5; i++ {
		deep += "("
	}
	deep += "1"
	for i := 0; i < maxDepth+5; i++ {
		deep += ")"
	}
	if _, err := Parse(deep); calcerr.CodeOf(err) != calcerr.CodeTooDeeplyNested {
		t.Errorf("deep nesting: got %v", err)
	}

	signs := ""
	for i := 0; i < 100; i++ {
		signs += "-"
	}
	if _, err := Parse(signs + "1"); calcerr.CodeOf(err) != calcerr.CodeTooDeeplyNested {
		t.Errorf("chained signs: got %v", err)
	}
}

func TestSyntaxErrorsReportPosition(t *testing.T) {
	tests := []struct {
		input string
		pos   int
	}{
		{"2 + * 3", 4},
		{"2 $ 3", 2},
		{"(1 + 2", 6},
		{"1.2.3", 3},
	}
	for _, tt := range tests {
		_, err := Parse(tt.input)
		var ce *calcerr.Error
		if !errors.As(err, &ce) || ce.Position == nil {
			t.Fatalf("%q: expected positioned error, got %v", tt.input, err)
		}
		if *ce.Position != tt.pos {
			t.Errorf("%q: position = %d, want %d", tt.input, *ce.Position, tt.pos)
		}
	}
}

func TestTokenize(t *testing.T) {
	tokens, err := Tokenize("π × 2")
	if err != nil {
		t.Fatal(err)
	}
	if len(tokens) != 4 { // pi, *, 2, EOF
		t.Fatalf("got %d tokens: %+v", len(tokens), tokens)
	}
	if tokens[0].Kind != TokIdent || tokens[0].Text != "pi" {
		t.Errorf("π should become the name pi, got %+v", tokens[0])
	}
	if tokens[1].Kind != TokStar {
		t.Errorf("× should become a star, got %+v", tokens[1])
	}
	if tokens[3].Kind != TokEOF {
		t.Errorf("tokens must end with EOF, got %+v", tokens[3])
	}
}

func TestTokenize_ExponentOnlyWhenDigitsFollow(t *testing.T) {
	// "2e" is the number 2 followed by the name e, not an exponent.
	tokens, err := Tokenize("2e")
	if err != nil {
		t.Fatal(err)
	}
	if len(tokens) != 3 || tokens[0].Kind != TokNumber || tokens[1].Kind != TokIdent {
		t.Fatalf("unexpected tokens: %+v", tokens)
	}
}

func TestFactorialLimit(t *testing.T) {
	got, err := run(t, "170!")
	if err != nil || math.IsInf(got, 0) || got <= 0 {
		t.Fatalf("170! should be a finite positive number, got %v, %v", got, err)
	}
}

func TestWrongArgumentCountMessages(t *testing.T) {
	tests := []struct{ input, message string }{
		{"double()", "double expects 1 argument, got 0"},
		{"double(1, 2)", "double expects 1 argument, got 2"},
		{"add(1)", "add expects 2 to 3 arguments, got 1"},
		{"zero(1)", "zero expects 0 arguments, got 1"},
	}
	for _, tt := range tests {
		_, err := run(t, tt.input)
		if err == nil || err.Error() != tt.message {
			t.Errorf("%q: got %v, want %q", tt.input, err, tt.message)
		}
	}
}
