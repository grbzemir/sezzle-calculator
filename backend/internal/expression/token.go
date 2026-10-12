// Package expression turns text such as "(10 + 5) * 2 - 8 / 4" into a value.
//
// It is split in three small stages, each with one job:
//
//	Tokenize  text   -> tokens
//	Parse     tokens -> syntax tree (AST)
//	Evaluate  AST    -> number
//
// The package knows the grammar and the operators, but not which functions or
// constants exist: those are supplied through the Environment interface.
package expression

// TokenKind classifies a lexical token.
type TokenKind int

const (
	TokEOF TokenKind = iota
	TokNumber
	TokIdent
	TokPlus
	TokMinus
	TokStar
	TokSlash
	TokCaret
	TokBang
	TokPercent
	TokLParen
	TokRParen
	TokComma
)

// Token is one lexical unit. Pos is the zero-based character index.
type Token struct {
	Kind  TokenKind
	Text  string
	Value float64 // only set for TokNumber
	Pos   int
}

// describe returns how the token is quoted in error messages.
func (t Token) describe() string {
	if t.Kind == TokEOF {
		return "end of expression"
	}
	return `"` + t.Text + `"`
}
