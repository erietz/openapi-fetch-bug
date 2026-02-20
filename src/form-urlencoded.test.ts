import { describe, it, expect } from '@jest/globals';
import createClient, { mergeHeaders } from 'openapi-fetch';

// Access defaultBodySerializer (not exported in types but available at runtime)
const { defaultBodySerializer } = await import('openapi-fetch') as any;

describe('Bug: instanceof Function fails in Jest VM modules', () => {

  it('demonstrates the root cause: instanceof Function returns false', () => {
    const headers = new Headers();
    headers.set('content-type', 'application/x-www-form-urlencoded');

    // This works correctly - Headers.get() IS a function
    console.log('typeof headers.get:', typeof headers.get);
    expect(typeof headers.get).toBe('function');

    // THE BUG: In Jest VM modules, instanceof Function returns false
    console.log('headers.get instanceof Function:', headers.get instanceof Function);

    // This assertion shows the bug - it SHOULD be true but is false in Jest
    // Comment: In normal Node.js this passes, in Jest VM modules it fails
    expect(headers.get instanceof Function).toBe(true);
  });

  it('shows how this breaks defaultBodySerializer', () => {
    const headers = mergeHeaders({ 'content-type': 'application/x-www-form-urlencoded' });
    const body = { grant_type: 'client_credentials', client_id: 'test' };

    // The serializer checks: headers.get instanceof Function
    // When false, it falls back to headers["Content-Type"] which returns undefined
    // So it never detects the form-urlencoded content-type
    const serialized = defaultBodySerializer(body, headers);

    console.log('Content-Type from headers.get():', headers.get('Content-Type'));
    console.log('Serialized body:', serialized);

    // EXPECTED: 'grant_type=client_credentials&client_id=test'
    // ACTUAL:   '{"grant_type":"client_credentials","client_id":"test"}'
    expect(serialized).toBe('grant_type=client_credentials&client_id=test');
  });

  it('shows the full request sends JSON despite form-urlencoded header', async () => {
    let capturedBody: string | null = null;
    let capturedContentType: string | null = null;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input, init);
      capturedContentType = req.headers.get('content-type');
      capturedBody = await req.text();
      return new Response('{}', { status: 200 });
    };

    try {
      const client = createClient<any>({ baseUrl: 'https://example.com' });
      await client.POST('/oauth/token', {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: { grant_type: 'client_credentials', client_id: 'test' },
      });

      console.log('Request Content-Type:', capturedContentType);
      console.log('Request Body:', capturedBody);

      // Header is correct
      expect(capturedContentType).toBe('application/x-www-form-urlencoded');

      // But body is JSON instead of form-urlencoded!
      expect(capturedBody).toBe('grant_type=client_credentials&client_id=test');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Proposed fix: use typeof instead of instanceof', () => {

  it('typeof works correctly in Jest VM modules', () => {
    const headers = new Headers();

    // instanceof fails in cross-realm scenarios
    console.log('instanceof Function:', headers.get instanceof Function);

    // typeof works correctly everywhere
    console.log('typeof === "function":', typeof headers.get === 'function');

    expect(typeof headers.get === 'function').toBe(true);
  });

  it('fixed defaultBodySerializer would work', () => {
    const headers = mergeHeaders({ 'content-type': 'application/x-www-form-urlencoded' });
    const body = { grant_type: 'client_credentials', client_id: 'test' };

    // Simulate the fix: use typeof instead of instanceof
    function fixedBodySerializer(body: any, headers: Headers) {
      if (body instanceof FormData) return body;
      if (headers) {
        const contentType =
          typeof headers.get === 'function'  // <-- THE FIX
            ? (headers.get('Content-Type') ?? headers.get('content-type'))
            : ((headers as any)['Content-Type'] ?? (headers as any)['content-type']);
        if (contentType === 'application/x-www-form-urlencoded') {
          return new URLSearchParams(body).toString();
        }
      }
      return JSON.stringify(body);
    }

    const serialized = fixedBodySerializer(body, headers);
    console.log('Fixed serialized body:', serialized);

    expect(serialized).toBe('grant_type=client_credentials&client_id=test');
  });
});
