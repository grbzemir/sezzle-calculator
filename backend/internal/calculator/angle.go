// Package calculator contains the calculator's domain: which functions and
// constants exist, how angles are interpreted, and how results are cleaned up.
// It knows nothing about HTTP or JSON.
package calculator

import (
	"math"
	"strings"

	"sezzle-calculator/backend/internal/calcerr"
)

// AngleMode selects how trigonometric functions read and return angles.
type AngleMode string

const (
	Degrees AngleMode = "deg"
	Radians AngleMode = "rad"
)

// ParseAngleMode reads a mode name. An empty value means degrees.
func ParseAngleMode(value string) (AngleMode, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", string(Degrees):
		return Degrees, nil
	case string(Radians):
		return Radians, nil
	default:
		return "", calcerr.New(calcerr.CodeInvalidAngleMode, `angleMode must be "deg" or "rad"`)
	}
}

// toRadians converts an input angle to radians.
func (m AngleMode) toRadians(angle float64) float64 {
	if m == Degrees {
		return angle * math.Pi / 180
	}
	return angle
}

// fromRadians converts a result angle from radians to the active unit.
func (m AngleMode) fromRadians(angle float64) float64 {
	if m == Degrees {
		return angle * 180 / math.Pi
	}
	return angle
}
