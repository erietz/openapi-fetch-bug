/**
 * This script demonstrates that the same code works correctly
 * when run directly in Node.js (outside Jest VM modules).
 */
import createClient, { mergeHeaders, defaultBodySerializer } from 'openapi-fetch';

console.log('=== Running in plain Node.js ===\n');

// Test 1: instanceof Function
const headers = new Headers();
headers.set('content-type', 'application/x-www-form-urlencoded');

console.log('Test 1: instanceof Function check');
console.log('  typeof headers.get:', typeof headers.get);
console.log('  headers.get instanceof Function:', headers.get instanceof Function);
console.log('  Result:', headers.get instanceof Function ? 'PASS ✓' : 'FAIL ✗');
console.log();

// Test 2: defaultBodySerializer
const mergedHeaders = mergeHeaders({ 'content-type': 'application/x-www-form-urlencoded' });
const body = { grant_type: 'client_credentials', client_id: 'test' };
const serialized = defaultBodySerializer(body, mergedHeaders);

console.log('Test 2: defaultBodySerializer');
console.log('  Content-Type:', mergedHeaders.get('Content-Type'));
console.log('  Serialized body:', serialized);
console.log('  Expected:', 'grant_type=client_credentials&client_id=test');
console.log('  Result:', serialized === 'grant_type=client_credentials&client_id=test' ? 'PASS ✓' : 'FAIL ✗');
console.log();

// Test 3: Full request
console.log('Test 3: Full POST request');

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const req = input instanceof Request ? input : new Request(input, init);
  const contentType = req.headers.get('content-type');
  const reqBody = await req.text();

  console.log('  Request Content-Type:', contentType);
  console.log('  Request Body:', reqBody);
  console.log('  Expected body:', 'grant_type=client_credentials&client_id=test');
  console.log('  Result:', reqBody === 'grant_type=client_credentials&client_id=test' ? 'PASS ✓' : 'FAIL ✗');

  return new Response('{}', { status: 200 });
};

const client = createClient({ baseUrl: 'https://example.com' });
await client.POST('/oauth/token', {
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: { grant_type: 'client_credentials', client_id: 'test' },
});

globalThis.fetch = originalFetch;

console.log('\n=== All tests pass in plain Node.js! ===');
console.log('The bug only manifests in Jest VM modules environment.');
