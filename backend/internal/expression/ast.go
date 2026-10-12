package expression

// Node is a node of the syntax tree.
type Node interface{ isNode() }

// Operator is a binary or postfix operator.
type Operator string

const (
	OpAdd      Operator = "+"
	OpSubtract Operator = "-"
	OpMultiply Operator = "*"
	OpDivide   Operator = "/"
	OpModulo   Operator = "mod"
	OpPower    Operator = "^"
	OpFactor   Operator = "!"
	OpPercent  Operator = "%"
)

// Number is a numeric literal.
type Number struct{ Value float64 }

// Constant is a named value such as pi or e.
type Constant struct {
	Name string
	Pos  int
}

// Unary is a sign applied to an operand: -x or +x.
type Unary struct {
	Negate  bool
	Operand Node
}

// Binary is "Left Op Right".
type Binary struct {
	Op          Operator
	Left, Right Node
}

// Postfix is "Operand Op" for factorial (n!) and percent (n%).
type Postfix struct {
	Op      Operator
	Operand Node
}

// Call is a function call such as sin(30) or round(4.67, 1).
type Call struct {
	Name string
	Args []Node
	Pos  int
}

func (Number) isNode()   {}
func (Constant) isNode() {}
func (Unary) isNode()    {}
func (Binary) isNode()   {}
func (Postfix) isNode()  {}
func (Call) isNode()     {}
