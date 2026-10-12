package calculator

import (
	"math"
	"strconv"

	"sezzle-calculator/backend/internal/expression"
)

// resultPrecision is the number of significant digits kept in a result. A
// float64 holds about 15-17, so this removes noise such as 0.1 + 0.2 =
// 0.30000000000000004 without losing meaningful digits.
const resultPrecision = 15

// FunctionInfo describes a function an expression can call.
type FunctionInfo struct {
	Name    string
	MinArgs int
	MaxArgs int
}

// Service evaluates calculator expressions.
type Service struct {
	functions map[string]definition
	order     []string
	constants map[string]float64
}

// NewService creates a Service with every built-in function and constant.
func NewService() *Service {
	s := &Service{
		functions: make(map[string]definition),
		constants: map[string]float64{"pi": math.Pi, "e": math.E},
	}
	for _, def := range builtinFunctions() {
		s.functions[def.name] = def
		s.order = append(s.order, def.name)
	}
	return s
}

// Evaluate parses and evaluates text in the given angle mode.
func (s *Service) Evaluate(text string, mode AngleMode) (float64, error) {
	tree, err := expression.Parse(text)
	if err != nil {
		return 0, err
	}
	value, err := expression.Evaluate(tree, environment{service: s, mode: mode})
	if err != nil {
		return 0, err
	}
	return cleanResult(value), nil
}

// Functions lists the available functions in a stable order.
func (s *Service) Functions() []FunctionInfo {
	infos := make([]FunctionInfo, 0, len(s.order))
	for _, name := range s.order {
		def := s.functions[name]
		infos = append(infos, FunctionInfo{Name: def.name, MinArgs: def.minArgs, MaxArgs: def.maxArgs})
	}
	return infos
}

// environment adapts a Service plus an angle mode to expression.Environment.
type environment struct {
	service *Service
	mode    AngleMode
}

func (e environment) Function(name string) (expression.Function, bool) {
	def, ok := e.service.functions[name]
	if !ok {
		return expression.Function{}, false
	}
	return expression.Function{
		Name:    def.name,
		MinArgs: def.minArgs,
		MaxArgs: def.maxArgs,
		Call:    func(args []float64) (float64, error) { return def.call(e.mode, args) },
	}, true
}

func (e environment) Constant(name string) (float64, bool) {
	value, ok := e.service.constants[name]
	return value, ok
}

// cleanResult rounds to resultPrecision significant digits and normalizes -0.
func cleanResult(value float64) float64 {
	if value == 0 {
		return 0
	}
	rounded, err := strconv.ParseFloat(strconv.FormatFloat(value, 'g', resultPrecision, 64), 64)
	if err != nil || math.IsInf(rounded, 0) { // rounding up at the very top of the float range
		return value
	}
	return rounded
}
