import { Calculator } from './components/Calculator';
import { createCalculatorApi } from './services/calculatorApi';

// Created once at module level so the instance is stable across renders.
const api = createCalculatorApi();

export default function App() {
  return <Calculator api={api} />;
}
