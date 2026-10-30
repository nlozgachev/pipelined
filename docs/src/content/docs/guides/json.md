---
title: Json — Safe Parsing & Stringifying
description: Non-throwing JSON parsing and serialization returning typed Result containers.
---

<!-- BUNDLE_SIZE:START -->

> 6.99 kB minified + gzipped

<!-- BUNDLE_SIZE:END -->

Almost every network boundary, webhook handler, cache layer, and browser storage adapter serializes
and deserializes JSON. Yet JavaScript's built-in `JSON.parse` and `JSON.stringify` are designed
around runtime exceptions and untyped return values that undermine TypeScript pipelines:

1. **`JSON.parse` throws `SyntaxError` and returns `any`**: Passing a truncated payload or an HTML
   `502 Bad Gateway` error page to `JSON.parse` throws an unhandled `SyntaxError`. Even when parsing
   succeeds, its return type is `any`, which silently disables TypeScript type checking downstream.
2. **`JSON.stringify` throws `TypeError` on `BigInt` and circular references**: If an object
   contains a `bigint` field (such as a 64-bit database ID or cent balance) or a circular object
   reference, `JSON.stringify` throws a runtime `TypeError` and crashes the request.
3. **`JSON.stringify` silently returns `undefined` on un-serializable inputs**: Passing `undefined`,
   a function, or a `Symbol` directly to `JSON.stringify` does not return a `string` — it returns
   `undefined`, which can corrupt storage writes or message queues expecting valid JSON text.

```ts
// Native JSON operations can throw or silently return undefined:
const data = JSON.parse(rawWebhookBody); // Throws SyntaxError on invalid JSON; typed as any!
const payload = JSON.stringify({ id: 9007199254740993n }); // Throws TypeError: Do not know how to serialize a BigInt
const empty = JSON.stringify(undefined); // Returns undefined instead of a string!
```

`Json` wraps both operations in typed `Result` containers, turning syntax failures and
un-serializable values into explicit `Err(SyntaxError)` and `Err(TypeError)` values that compose
linearly inside `pipe`.

---

## Safe Parsing with `Json.parse`

`Json.parse<T = unknown>(text)` parses a JSON string and returns `Result<SyntaxError, T>`. By
default, the success value is typed as `unknown` rather than `any`, prompting you to validate the
structure or supply an explicit domain interface before accessing fields. If the input string is
malformed, `Json.parse` catches the exception and returns `Err(SyntaxError)`:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Result } from "@nlozgachev/pipelined/core";
import { Json } from "@nlozgachev/pipelined/data";

type WebhookEvent = {
  readonly eventId: string;
  readonly amountCents: number;
};

const parsed = pipe(
  Json.parse<WebhookEvent>('{"eventId": "evt_101", "amountCents": 2500}'),
  Result.map((event) => event.amountCents),
); // Ok(2500)

const malformed = Json.parse("{unclosed_json");
// Err(SyntaxError: ...)
```

Because `Json.parse` returns a `Result`, you can chain structural validation steps directly after
parsing using `Result.chain` or `Result.ensure`:

```ts
const isRecord = (val: unknown): val is Record<string, unknown> =>
  typeof val === "object" && val !== null && !Array.isArray(val);

const extractEventId = (rawBody: string): Result<string, string> =>
  pipe(
    Json.parse(rawBody),
    Result.mapError((err) => `Malformed JSON: ${err.message}`),
    Result.chain((parsed) =>
      isRecord(parsed) && typeof parsed.eventId === "string"
        ? Result.make.ok(parsed.eventId)
        : Result.make.err("Missing string field 'eventId'"),
    ),
  );

extractEventId('{"eventId": "evt_99"}'); // Ok("evt_99")
extractEventId('{"eventId": 123}');      // Err("Missing string field 'eventId'")
extractEventId("not json");              // Err("Malformed JSON: ...")
```

---

## Safe Serialization with `Json.stringify`

`Json.stringify(value, replacer?, space?)` serializes any JavaScript value into a JSON string and
returns `Result<TypeError, string>`.

It protects against all three failure modes of native `JSON.stringify`:

- **Circular object references**: Caught and returned as `Err(TypeError)`.
- **Unsupported `BigInt` values**: Caught and returned as `Err(TypeError)` (unless converted by a
  custom `replacer`).
- **Un-serializable top-level values (`undefined`, functions, symbols)**: Instead of returning
  `undefined`, `Json.stringify` returns `Err(TypeError("Value is not JSON serializable"))`.

```ts
// Standard serialization:
Json.stringify({ status: "ok", retries: 3 });
// Ok('{"status":"ok","retries":3}')

// Pretty-printing with indentation space:
Json.stringify({ status: "ok" }, undefined, 2);
// Ok('{\n  "status": "ok"\n}')

// Un-serializable values become Err(TypeError) instead of returning undefined:
Json.stringify(undefined);
// Err(TypeError: Value is not JSON serializable)

Json.stringify(() => {});
// Err(TypeError: Value is not JSON serializable)

// Circular references and raw BigInts become Err(TypeError) instead of throwing:
const circular: { self?: unknown } = {};
circular.self = circular;

Json.stringify(circular);
// Err(TypeError: Converting circular structure to JSON ...)

Json.stringify({ ledgerId: 9007199254740993n });
// Err(TypeError: Do not know how to serialize a BigInt)
```

If your payload legitimately contains `bigint` values, you can pass a custom `replacer` function as
the second argument to serialize them as strings:

```ts
const withBigIntReplacer = Json.stringify(
  { invoiceId: 9007199254740993n },
  (_key, val) => (typeof val === "bigint" ? val.toString() : val),
);
// Ok('{"invoiceId":"9007199254740993"}')
```

---

## Pipeline Composition

Here is an end-to-end payment webhook processor that parses an incoming JSON request body, validates
the required payload fields, computes a settlement summary, and serializes the response back to a
JSON string with a unified error channel:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Result } from "@nlozgachev/pipelined/core";
import { Json } from "@nlozgachev/pipelined/data";

type ChargePayload = {
  readonly chargeId: string;
  readonly subtotalCents: number;
  readonly taxCents: number;
};

const validateCharge = (input: unknown): Result<string, ChargePayload> => {
  if (typeof input !== "object" || input === null) {
    return Result.make.err("Payload must be a JSON object");
  }
  const candidate = input as Record<string, unknown>;
  if (
    typeof candidate.chargeId === "string" &&
    typeof candidate.subtotalCents === "number" &&
    typeof candidate.taxCents === "number"
  ) {
    return Result.make.ok({
      chargeId: candidate.chargeId,
      subtotalCents: candidate.subtotalCents,
      taxCents: candidate.taxCents,
    });
  }
  return Result.make.err("Invalid ChargePayload schema");
};

function processChargeWebhook(rawBody: string): Result<string, string> {
  return pipe(
    Json.parse(rawBody),
    Result.mapError((err) => `JSON parse error: ${err.message}`),
    Result.chain(validateCharge),
    Result.map((charge) => ({
      chargeId: charge.chargeId,
      totalCents: charge.subtotalCents + charge.taxCents,
      processed: true,
    })),
    Result.chain((receipt) =>
      pipe(
        Json.stringify(receipt),
        Result.mapError((err) => `JSON serialize error: ${err.message}`),
      ),
    ),
  );
}

processChargeWebhook('{"chargeId":"ch_1","subtotalCents":1000,"taxCents":80}');
// Ok('{"chargeId":"ch_1","totalCents":1080,"processed":true}')

processChargeWebhook("{corrupted");
// Err("JSON parse error: ...")
```

---

## Problems it solves

- **Safe parsing of untrusted webhook and API payloads (`Json.parse`)**: Calling native
  `JSON.parse()` on malformed HTTP request bodies or corrupted cache entries throws runtime
  exceptions and returns untyped `any`. `Json.parse<T>` returns `Result<SyntaxError, T>` (defaulting
  `T` to `unknown`), turning syntax errors into explicit failure values.
- **Resilient serialization without runtime crashes (`Json.stringify`)**: Serializing dynamic
  objects to `localStorage`, message queues, or HTTP responses throws `TypeError` when objects
  contain circular references or `BigInt` values, and silently returns `undefined` when given
  `undefined` or functions. `Json.stringify` returns `Result<TypeError, string>`, guaranteeing that
  every `Ok` contains a valid JSON string and every failure is captured as an `Err(TypeError)`.
- **Linear pipeline composition**: Raw JSON text can be parsed, validated with `Result.chain`,
  transformed, and re-serialized inside a single `pipe` flow without `try/catch` blocks or mutable
  `let` variables.
