# Bug: `instanceof Function` fails in Jest VM modules

Minimal reproduction of a bug in `openapi-fetch@0.13.8` where `application/x-www-form-urlencoded` body serialization fails in Jest's experimental VM modules environment.

## The Bug

In `defaultBodySerializer` ([src/index.js:601](https://github.com/openapi-ts/openapi-typescript/blob/main/packages/openapi-fetch/src/index.js#L601)):

```javascript
const contentType =
  headers.get instanceof Function  // <-- BUG: returns false in Jest VM modules
    ? (headers.get("Content-Type") ?? headers.get("content-type"))
    : (headers["Content-Type"] ?? headers["content-type"]);
```

When running in Jest with `--experimental-vm-modules`, `instanceof Function` returns `false` due to cross-realm issues, even though `headers.get` IS a function.

This causes the code to fall back to `headers["Content-Type"]`, which returns `undefined` for `Headers` objects (they don't support bracket notation), so the form-urlencoded content-type is never detected.

## Root Cause

Jest's experimental VM modules creates separate JavaScript realms. The `Function` constructor in the test context differs from the one in the module context, causing `instanceof Function` to fail.

This is a known limitation of `instanceof` across realms.

## Proposed Fix

Replace `instanceof Function` with `typeof ... === 'function'`:

```diff
- headers.get instanceof Function
+ typeof headers.get === 'function'
```

`typeof` works correctly across realms.

## Run the Reproduction

```bash
npm install
npm test        # Fails in Jest (demonstrates the bug)
npm run test:node  # Passes in plain Node.js (shows it works normally)
```

## Test Output

### Jest (fails)
```
headers.get instanceof Function: false
Serialized body: {"grant_type":"client_credentials","client_id":"test"}
```

### Plain Node.js (passes)
```
headers.get instanceof Function: true
Serialized body: grant_type=client_credentials&client_id=test
```

## Environment

- openapi-fetch: 0.13.8
- Jest: 29.7.0
- Node.js: 20+
- Flag: `--experimental-vm-modules`

## Files

```
├── src/
│   ├── form-urlencoded.test.ts  # Jest tests demonstrating the bug
│   └── node-test.mjs            # Plain Node.js test (works correctly)
├── package.json
├── jest.config.js
├── tsconfig.json
└── README.md
```
