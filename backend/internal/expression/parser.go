package expression

import (
	"strings"

	"sezzle-calculator/backend/internal/calcerr"
)

const (
	// MaxLength bounds the input so a request cannot make the parser do unbounded work.
	MaxLength = 256
	// maxDepth bounds recursion (nested parentheses, chained unary signs, ...).
	maxDepth = 64
)

// Parse converts text into a syntax tree.
//
// Grammar, from the loosest to the tightest binding:
//
//	expression = term { ("+" | "-") term }
//	term       = unary { ("*" | "/" | "mod") unary }
//	unary      = ("-" | "+") unary | power
//	power      = postfix [ "^" unary ]            right associative: 2^3^2 = 2^9
//	postfix    = primary { "!" | "%" }
//	primary    = number | name | name "(" [ expression { "," expression } ] ")"
//	           | "(" expression ")"
//
// Because "power" sits below "unary", -2^2 is -(2^2) = -4, as in mathematics.
func Parse(input string) (Node, error) {
	if strings.TrimSpace(input) == "" {
		return nil, calcerr.New(calcerr.CodeEmptyExpression, "expression is empty")
	}
	if len([]rune(input)) > MaxLength {
		return nil, calcerr.New(calcerr.CodeExpressionTooLong, "expression is too long")
	}

	tokens, err := Tokenize(input)
	if err != nil {
		return nil, err
	}

	p := &parser{tokens: tokens}
	node, err := p.parseExpression()
	if err != nil {
		return nil, err
	}
	if tok := p.peek(); tok.Kind != TokEOF {
		return nil, p.unexpected(tok)
	}
	return node, nil
}

type parser struct {
	tokens []Token
	pos    int
	depth  int
}

func (p *parser) peek() Token { return p.tokens[p.pos] }

func (p *parser) next() Token {
	tok := p.tokens[p.pos]
	if tok.Kind != TokEOF {
		p.pos++
	}
	return tok
}

func (p *parser) unexpected(tok Token) error {
	return calcerr.At(calcerr.CodeSyntax, tok.Pos, "unexpected "+tok.describe())
}

// enter guards recursion; callers must `defer p.leave()` after a successful enter.
func (p *parser) enter() error {
	p.depth++
	if p.depth > maxDepth {
		return calcerr.At(calcerr.CodeTooDeeplyNested, p.peek().Pos, "expression is nested too deeply")
	}
	return nil
}

func (p *parser) leave() { p.depth-- }

func (p *parser) parseExpression() (Node, error) {
	if err := p.enter(); err != nil {
		return nil, err
	}
	defer p.leave()

	left, err := p.parseTerm()
	if err != nil {
		return nil, err
	}
	for {
		var op Operator
		switch p.peek().Kind {
		case TokPlus:
			op = OpAdd
		case TokMinus:
			op = OpSubtract
		default:
			return left, nil
		}
		p.next()
		right, err := p.parseTerm()
		if err != nil {
			return nil, err
		}
		left = Binary{Op: op, Left: left, Right: right}
	}
}

func (p *parser) parseTerm() (Node, error) {
	left, err := p.parseUnary()
	if err != nil {
		return nil, err
	}
	for {
		tok := p.peek()
		var op Operator
		switch {
		case tok.Kind == TokStar:
			op = OpMultiply
		case tok.Kind == TokSlash:
			op = OpDivide
		case tok.Kind == TokIdent && tok.Text == "mod":
			op = OpModulo
		default:
			return left, nil
		}
		p.next()
		right, err := p.parseUnary()
		if err != nil {
			return nil, err
		}
		left = Binary{Op: op, Left: left, Right: right}
	}
}

func (p *parser) parseUnary() (Node, error) {
	if err := p.enter(); err != nil {
		return nil, err
	}
	defer p.leave()

	if kind := p.peek().Kind; kind == TokMinus || kind == TokPlus {
		p.next()
		operand, err := p.parseUnary()
		if err != nil {
			return nil, err
		}
		return Unary{Negate: kind == TokMinus, Operand: operand}, nil
	}
	return p.parsePower()
}

func (p *parser) parsePower() (Node, error) {
	base, err := p.parsePostfix()
	if err != nil {
		return nil, err
	}
	if p.peek().Kind != TokCaret {
		return base, nil
	}
	p.next()
	exponent, err := p.parseUnary() // allows 2^-3 and gives right associativity
	if err != nil {
		return nil, err
	}
	return Binary{Op: OpPower, Left: base, Right: exponent}, nil
}

func (p *parser) parsePostfix() (Node, error) {
	node, err := p.parsePrimary()
	if err != nil {
		return nil, err
	}
	for {
		switch p.peek().Kind {
		case TokBang:
			node = Postfix{Op: OpFactor, Operand: node}
		case TokPercent:
			node = Postfix{Op: OpPercent, Operand: node}
		default:
			return node, nil
		}
		p.next()
	}
}

func (p *parser) parsePrimary() (Node, error) {
	tok := p.next()

	switch tok.Kind {
	case TokNumber:
		return Number{Value: tok.Value}, nil

	case TokLParen:
		inner, err := p.parseExpression()
		if err != nil {
			return nil, err
		}
		if _, err := p.expect(TokRParen, `missing closing ")"`); err != nil {
			return nil, err
		}
		return inner, nil

	case TokIdent:
		if p.peek().Kind == TokLParen {
			return p.parseCall(tok)
		}
		return Constant{Name: tok.Text, Pos: tok.Pos}, nil

	default:
		return nil, p.unexpected(tok)
	}
}

func (p *parser) parseCall(name Token) (Node, error) {
	p.next() // "("
	call := Call{Name: name.Text, Pos: name.Pos}

	if p.peek().Kind == TokRParen {
		p.next()
		return call, nil
	}
	for {
		arg, err := p.parseExpression()
		if err != nil {
			return nil, err
		}
		call.Args = append(call.Args, arg)

		if p.peek().Kind == TokComma {
			p.next()
			continue
		}
		if _, err := p.expect(TokRParen, `missing closing ")"`); err != nil {
			return nil, err
		}
		return call, nil
	}
}

func (p *parser) expect(kind TokenKind, message string) (Token, error) {
	tok := p.peek()
	if tok.Kind != kind {
		return Token{}, calcerr.At(calcerr.CodeSyntax, tok.Pos, message)
	}
	return p.next(), nil
}
