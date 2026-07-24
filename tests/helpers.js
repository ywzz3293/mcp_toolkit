export function withMockedFetch(mockFn, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = mockFn;
  return Promise.resolve(fn()).finally(() => {
    globalThis.fetch = original;
  });
}

export function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function textResponse(status, body) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain" },
  });
}
