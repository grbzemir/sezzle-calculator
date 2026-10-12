import type { EvaluateRequest, EvaluateResponse } from '../types/calculator';

/** Error raised for any failed call, carrying the backend's machine-readable code. */
export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/** The surface the UI depends on; tests substitute a fake. */
export interface CalculatorApi {
  evaluate(request: EvaluateRequest): Promise<EvaluateResponse>;
}

const DEFAULT_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

interface ErrorPayload {
  error?: { code?: string; message?: string };
}

export function createCalculatorApi(
  baseUrl: string = DEFAULT_BASE_URL,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): CalculatorApi {
  return {
    async evaluate(request) {
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });
      } catch {
        throw new ApiError(
          'Cannot reach the calculator service. Check that the backend is running.',
          'network_error',
        );
      }

      const payload: unknown = await response.json().catch(() => undefined);

      if (!response.ok) {
        const error = (payload as ErrorPayload | undefined)?.error;
        throw new ApiError(
          error?.message ?? `Request failed with status ${response.status}.`,
          error?.code ?? 'unexpected_response',
          response.status,
        );
      }

      if (!isEvaluateResponse(payload)) {
        throw new ApiError(
          'The calculator service returned an unexpected response.',
          'unexpected_response',
          response.status,
        );
      }
      return payload;
    },
  };
}

function isEvaluateResponse(value: unknown): value is EvaluateResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as EvaluateResponse).result === 'number'
  );
}
