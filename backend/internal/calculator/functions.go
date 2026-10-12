package calculator

import (
	"math"

	"sezzle-calculator/backend/internal/calcerr"
)

// definition describes one built-in function. The angle mode is passed in so
// that definitions stay plain data and need no per-request state.
type definition struct {
	name    string
	minArgs int
	maxArgs int
	call    func(mode AngleMode, args []float64) (float64, error)
}

// builtinFunctions lists every function an expression can call. Adding a
// function means adding one entry here; nothing else changes (Open/Closed).
func builtinFunctions() []definition {
	return []definition{
		// Trigonometry (angle aware)
		angleFn("sin", sin),
		angleFn("cos", cos),
		{name: "tan", minArgs: 1, maxArgs: 1, call: func(m AngleMode, a []float64) (float64, error) { return tan(m, a[0]) }},
		{name: "asin", minArgs: 1, maxArgs: 1, call: func(m AngleMode, a []float64) (float64, error) { return inverseTrig("asin", math.Asin, m, a[0]) }},
		{name: "acos", minArgs: 1, maxArgs: 1, call: func(m AngleMode, a []float64) (float64, error) { return inverseTrig("acos", math.Acos, m, a[0]) }},
		{name: "atan", minArgs: 1, maxArgs: 1, call: func(m AngleMode, a []float64) (float64, error) { return m.fromRadians(math.Atan(a[0])), nil }},

		// Hyperbolic
		plainFn("sinh", math.Sinh),
		plainFn("cosh", math.Cosh),
		plainFn("tanh", math.Tanh),

		// Powers, roots, logarithms
		checkedFn("sqrt", "square root of a negative number is not a real number", func(x float64) bool { return x >= 0 }, math.Sqrt),
		plainFn("cbrt", math.Cbrt),
		{name: "root", minArgs: 2, maxArgs: 2, call: func(_ AngleMode, a []float64) (float64, error) { return nthRoot(a[0], a[1]) }},
		plainFn("exp", math.Exp),
		checkedFn("ln", "ln is only defined for positive numbers", positive, math.Log),
		checkedFn("log", "log is only defined for positive numbers", positive, math.Log10),
		checkedFn("log2", "log2 is only defined for positive numbers", positive, math.Log2),

		// Rounding and sign
		plainFn("abs", math.Abs),
		plainFn("floor", math.Floor),
		plainFn("ceil", math.Ceil),
		{name: "round", minArgs: 1, maxArgs: 2, call: func(_ AngleMode, a []float64) (float64, error) { return round(a) }},
	}
}

func positive(x float64) bool { return x > 0 }

// plainFn wraps a one-argument function with no restrictions.
func plainFn(name string, fn func(float64) float64) definition {
	return definition{name: name, minArgs: 1, maxArgs: 1, call: func(_ AngleMode, a []float64) (float64, error) {
		return fn(a[0]), nil
	}}
}

// checkedFn wraps a one-argument function that is only defined where valid(x).
func checkedFn(name, message string, valid func(float64) bool, fn func(float64) float64) definition {
	return definition{name: name, minArgs: 1, maxArgs: 1, call: func(_ AngleMode, a []float64) (float64, error) {
		if !valid(a[0]) {
			return 0, calcerr.New(calcerr.CodeDomain, message)
		}
		return fn(a[0]), nil
	}}
}

func angleFn(name string, fn func(AngleMode, float64) float64) definition {
	return definition{name: name, minArgs: 1, maxArgs: 1, call: func(m AngleMode, a []float64) (float64, error) {
		return fn(m, a[0]), nil
	}}
}

// normalizeDegrees maps an angle to [0, 360) so exact values can be returned
// for multiples of 90 degrees instead of values like 6.1e-17.
func normalizeDegrees(angle float64) float64 {
	r := math.Mod(angle, 360)
	if r < 0 {
		r += 360
	}
	return r
}

// snapTiny turns floating point residue (|x| < 1e-15) into an exact zero.
func snapTiny(x float64) float64 {
	if math.Abs(x) < 1e-15 {
		return 0
	}
	return x
}

func sin(m AngleMode, x float64) float64 {
	if m == Degrees {
		switch normalizeDegrees(x) {
		case 0, 180:
			return 0
		case 90:
			return 1
		case 270:
			return -1
		}
	}
	return snapTiny(math.Sin(m.toRadians(x)))
}

func cos(m AngleMode, x float64) float64 {
	if m == Degrees {
		switch normalizeDegrees(x) {
		case 0:
			return 1
		case 90, 270:
			return 0
		case 180:
			return -1
		}
	}
	return snapTiny(math.Cos(m.toRadians(x)))
}

func tan(m AngleMode, x float64) (float64, error) {
	c := cos(m, x)
	if c == 0 {
		return 0, calcerr.New(calcerr.CodeUndefinedResult, "tan is undefined at this angle")
	}
	return sin(m, x) / c, nil
}

func inverseTrig(name string, fn func(float64) float64, m AngleMode, x float64) (float64, error) {
	if x < -1 || x > 1 {
		return 0, calcerr.New(calcerr.CodeDomain, name+" is only defined for values from -1 to 1")
	}
	return m.fromRadians(fn(x)), nil
}

// nthRoot computes the degree-th root of x. Odd roots of negative numbers are
// allowed (root(3, -27) = -3); even roots of negative numbers are not.
func nthRoot(degree, x float64) (float64, error) {
	switch {
	case degree == 0:
		return 0, calcerr.New(calcerr.CodeDomain, "root degree cannot be zero")
	case degree == 2:
		if x < 0 {
			return 0, calcerr.New(calcerr.CodeDomain, "square root of a negative number is not a real number")
		}
		return math.Sqrt(x), nil
	case degree == 3:
		return math.Cbrt(x), nil
	case x >= 0:
		return math.Pow(x, 1/degree), nil
	}

	isOddInteger := degree == math.Floor(degree) && math.Mod(degree, 2) != 0
	if !isOddInteger {
		return 0, calcerr.New(calcerr.CodeDomain, "even roots of negative numbers are not real numbers")
	}
	return -math.Pow(-x, 1/degree), nil
}

const maxRoundDigits = 15

// round(x) rounds to a whole number, round(x, d) to d decimal places. Halves
// round away from zero (4.5 -> 5, -4.5 -> -5).
func round(args []float64) (float64, error) {
	if len(args) == 1 {
		return math.Round(args[0]), nil
	}
	digits := args[1]
	if digits != math.Floor(digits) || math.Abs(digits) > maxRoundDigits {
		return 0, calcerr.New(calcerr.CodeDomain, "round digits must be a whole number between -15 and 15")
	}
	scale := math.Pow(10, digits)
	return math.Round(args[0]*scale) / scale, nil
}
