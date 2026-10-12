import { vi } from 'vitest';
import { ApiError, createCalculatorApi } from './calculatorApi';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const request = { expression: '2+3', angleMode: 'deg' } as const;

describe('createCalculatorApi', () => {
  it('POSTs the request as JSON and returns the parsed response', async () => {
    const body = { expression: '2+3', angleMode: 'deg', result: 5 };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body));
    const api = createCalculatorApi('/api/v1', fetchMock);

    const result = await api.evaluate(request);

    expect(result).toEqual(body);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  });

  it('turns backend error payloads into ApiError', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        { error: { code: 'division_by_zero', message: 'division by zero is not allowed' } },
        400,
      ),
    );
    const api = createCalculatorApi('/api/v1', fetchMock);

    await expect(api.evaluate({ expression: '1/0', angleMode: 'deg' })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'division_by_zero',
      status: 400,
      message: 'division by zero is not allowed',
    });
  });

  it('reports network failures with a helpful message', async () => {
    const api = createCalculatorApi('/api/v1', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(api.evaluate(request)).rejects.toMatchObject({ code: 'network_error' });
  });

  it('handles error responses that are not JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('Bad gateway', { status: 502 }));
    const api = createCalculatorApi('/api/v1', fetchMock);

    const error = await api.evaluate(request).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'unexpected_response', status: 502 });
  });

  it('rejects successful responses with an unexpected shape', async () => {
    const api = createCalculatorApi('/api/v1', vi.fn().mockResolvedValue(jsonResponse({ nope: true })));

    await expect(api.evaluate(request)).rejects.toMatchObject({ code: 'unexpected_response' });
  });

  it('rejects successful responses that are not JSON at all', async () => {
    const api = createCalculatorApi('/api/v1', vi.fn().mockResolvedValue(new Response('ok', { status: 200 })));

    await expect(api.evaluate(request)).rejects.toMatchObject({ code: 'unexpected_response' });
  });
});
