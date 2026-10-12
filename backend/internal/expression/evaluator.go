package expression

import (
	"fmt"
	"math"

	"sezzle-calculator/backend/internal/calcerr"
)

// maxFactorialInput is the largest n whose factorial fits in a float64.
const maxFactorialInput = 170

// Function is something callable from an expression, e.g. sin or round.
type Function struct {
	Name    string
	MinArgs int
	MaxArgs int
	Call    func(args []float64) (float64, error)
}

// Environment supplies the names an expression may use. The evaluator depends
// on this interface, not on a concrete function table (Dependency Inversion).
type Environment interface {
	Function(name string) (Function, bool)
	Constant(name string) (float64, bool)
}

// Evaluate computes the value of a syntax tree.
//
// Percent rules (documented in the README and covered by tests):
//   - a standalone n% is n/100                 15%       = 0.15
//   - in a product or quotient it is n/100     200 * 15% = 30
//   - as the right side of + or - it is a
//     percentage of the left side              200 + 10% = 220
func Evaluate(node Node, env Environment) (float64, error) {
	value, err := eval(node, env)
	if err != nil {
		return 0, err
	}
	return value, nil
}

func eval(node Node, env Environment) (float64, error) {
	value, err := evalNode(node, env)
	if err != nil {
		return 0, err
	}
	return checkFinite(value)
}

func evalNode(node Node, env Environment) (float64, error) {
	switch n := node.(type) {
	case Number:
		return n.Value, nil

	case Constant:
		value, ok := env.Constant(n.Name)
		if !ok {
			return 0, calcerr.At(calcerr.CodeUnknownIdentifier, n.Pos, fmt.Sprintf("unknown name %q", n.Name))
		}
		return value, nil

	case Unary:
		value, err := eval(n.Operand, env)
		if err != nil {
			return 0, err
		}
		if n.Negate {
			return -value, nil
		}
		return value, nil

	case Binary:
		return evalBinary(n, env)

	case Postfix:
		return evalPostfix(n, env)

	case Call:
		return evalCall(n, env)

	default:
		return 0, calcerr.New(calcerr.CodeInternal, fmt.Sprintf("unsupported node %T", node))
	}
}

func evalBinary(n Binary, env Environment) (float64, error) {
	left, err := eval(n.Left, env)
	if err != nil {
		return 0, err
	}

	// "a + b%" and "a - b%" mean "a plus/minus b percent of a".
	if pct, ok := n.Right.(Postfix); ok && pct.Op == OpPercent && (n.Op == OpAdd || n.Op == OpSubtract) {
		rate, err := eval(pct.Operand, env)
		if err != nil {
			return 0, err
		}
		delta := left * rate / 100
		if n.Op == OpSubtract {
			delta = -delta
		}
		return left + delta, nil
	}

	right, err := eval(n.Right, env)
	if err != nil {
		return 0, err
	}

	switch n.Op {
	case OpAdd:
		return left + right, nil
	case OpSubtract:
		return left - right, nil
	case OpMultiply:
		return left * right, nil
	case OpDivide:
		if right == 0 {
			return 0, calcerr.New(calcerr.CodeDivisionByZero, "division by zero is not allowed")
		}
		return left / right, nil
	case OpModulo:
		if right == 0 {
			return 0, calcerr.New(calcerr.CodeDivisionByZero, "modulo by zero is not allowed")
		}
		return math.Mod(left, right), nil
	case OpPower:
		if left == 0 && right < 0 {
			return 0, calcerr.New(calcerr.CodeUndefinedResult, "0 cannot be raised to a negative power")
		}
		return math.Pow(left, right), nil
	default:
		return 0, calcerr.New(calcerr.CodeInternal, fmt.Sprintf("unsupported operator %q", n.Op))
	}
}

func evalPostfix(n Postfix, env Environment) (float64, error) {
	value, err := eval(n.Operand, env)
	if err != nil {
		return 0, err
	}

	switch n.Op {
	case OpPercent:
		return value / 100, nil
	case OpFactor:
		return factorial(value)
	default:
		return 0, calcerr.New(calcerr.CodeInternal, fmt.Sprintf("unsupported operator %q", n.Op))
	}
}

func factorial(value float64) (float64, error) {
	if value < 0 || value != math.Floor(value) {
		return 0, calcerr.New(calcerr.CodeDomain, "factorial is only defined for non-negative whole numbers")
	}
	if value > maxFactorialInput {
		return 0, calcerr.New(calcerr.CodeOverflow, "factorial result is too large")
	}
	result := 1.0
	for i := 2.0; i <= value; i++ {
		result *= i
	}
	return result, nil
}

func evalCall(n Call, env Environment) (float64, error) {
	fn, ok := env.Function(n.Name)
	if !ok {
		return 0, calcerr.At(calcerr.CodeUnknownFunction, n.Pos, fmt.Sprintf("unknown function %q", n.Name))
	}
	if len(n.Args) < fn.MinArgs || len(n.Args) > fn.MaxArgs {
		return 0, calcerr.At(calcerr.CodeWrongArgumentCount, n.Pos,
			fmt.Sprintf("%s expects %s, got %d", n.Name, describeArity(fn), len(n.Args)))
	}

	args := make([]float64, len(n.Args))
	for i, arg := range n.Args {
		value, err := eval(arg, env)
		if err != nil {
			return 0, err
		}
		args[i] = value
	}
	return fn.Call(args)
}

func describeArity(fn Function) string {
	plural := func(n int) string {
		if n == 1 {
			return "1 argument"
		}
		return fmt.Sprintf("%d arguments", n)
	}
	if fn.MinArgs == fn.MaxArgs {
		return plural(fn.MinArgs)
	}
	return fmt.Sprintf("%d to %d arguments", fn.MinArgs, fn.MaxArgs)
}

// checkFinite turns NaN and infinity into errors so they can never be
// returned to a client (they are not valid JSON numbers).
func checkFinite(value float64) (float64, error) {
	switch {
	case math.IsNaN(value):
		return 0, calcerr.New(calcerr.CodeUndefinedResult, "result is not a real number")
	case math.IsInf(value, 0):
		return 0, calcerr.New(calcerr.CodeOverflow, "result is too large to represent")
	}
	return value, nil
}
