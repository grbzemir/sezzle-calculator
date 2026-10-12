package expression

import (
	"strconv"
	"strings"
	"unicode"

	"sezzle-calculator/backend/internal/calcerr"
)

// symbols maps single-character operators (including the typographic ones the
// UI may show) to their token kind.
var symbols = map[rune]TokenKind{
	'+': TokPlus,
	'-': TokMinus, '−': TokMinus,
	'*': TokStar, '×': TokStar,
	'/': TokSlash, '÷': TokSlash,
	'^': TokCaret,
	'!': TokBang,
	'%': TokPercent,
	'(': TokLParen,
	')': TokRParen,
	',': TokComma,
}

// Tokenize splits input into tokens. The returned slice always ends with TokEOF.
func Tokenize(input string) ([]Token, error) {
	runes := []rune(input)
	var tokens []Token

	for i := 0; i < len(runes); {
		r := runes[i]

		switch {
		case unicode.IsSpace(r):
			i++

		case isDigit(r) || (r == '.' && i+1 < len(runes) && isDigit(runes[i+1])):
			token, next, err := scanNumber(runes, i)
			if err != nil {
				return nil, err
			}
			tokens = append(tokens, token)
			i = next

		case unicode.IsLetter(r):
			start := i
			for i < len(runes) && (unicode.IsLetter(runes[i]) || isDigit(runes[i]) || runes[i] == '_') {
				i++
			}
			text := string(runes[start:i])
			if text == "π" {
				text = "pi"
			}
			tokens = append(tokens, Token{Kind: TokIdent, Text: strings.ToLower(text), Pos: start})

		default:
			kind, ok := symbols[r]
			if !ok {
				return nil, calcerr.At(calcerr.CodeSyntax, i, `unexpected character "`+string(r)+`"`)
			}
			tokens = append(tokens, Token{Kind: kind, Text: string(r), Pos: i})
			i++
		}
	}

	tokens = append(tokens, Token{Kind: TokEOF, Pos: len(runes)})
	return tokens, nil
}

// scanNumber reads a decimal number such as 12, 12.5, .5, 5. or 1.5e-3 that
// starts at runes[start], and returns the token and the index after it.
func scanNumber(runes []rune, start int) (Token, int, error) {
	i := start
	for i < len(runes) && isDigit(runes[i]) {
		i++
	}
	if i < len(runes) && runes[i] == '.' {
		i++
		for i < len(runes) && isDigit(runes[i]) {
			i++
		}
	}
	if i < len(runes) && runes[i] == '.' {
		return Token{}, 0, calcerr.At(calcerr.CodeSyntax, i, `unexpected "." in number`)
	}

	// Exponent: only when "e" is followed by digits, so "2e" stays 2 times e.
	if i < len(runes) && (runes[i] == 'e' || runes[i] == 'E') {
		j := i + 1
		if j < len(runes) && (runes[j] == '+' || runes[j] == '-') {
			j++
		}
		if j < len(runes) && isDigit(runes[j]) {
			for j < len(runes) && isDigit(runes[j]) {
				j++
			}
			i = j
		}
	}

	text := string(runes[start:i])
	value, err := strconv.ParseFloat(text, 64)
	if err != nil { // the shape is valid, so the only failure is a range error
		return Token{}, 0, calcerr.At(calcerr.CodeOverflow, start, "number is too large")
	}
	return Token{Kind: TokNumber, Text: text, Value: value, Pos: start}, i, nil
}

func isDigit(r rune) bool { return r >= '0' && r <= '9' }
