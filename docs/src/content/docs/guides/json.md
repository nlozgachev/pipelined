---
title: Json — Safe Parsing & Stringifying
description: Non-throwing JSON parsing and serialization returning typed Result containers.
---

Standard `JSON.parse` and `JSON.stringify` rely on runtime exceptions (`SyntaxError` when parsing
malformed text, `TypeError` when stringifying circular structures or invalid types).

`Json` wraps these operations in typed `Result` containers, eliminating runtime exceptions at your
application boundaries.

---

## Safe Parsing with Json.parse

`Json.parse` parses a raw JSON string into `unknown` and captures syntax errors inside an
`Err(SyntaxError)`:

```ts
import { Json } from "@nlozgachev/pipelined/data";
import { Result } from "@nlozgachev/pipelined/core";
import { pipe } from "@nlozgachev/pipelined/composition";

const payload = pipe(
  Json.parse('{"userId": "usr_123", "score": 95}'),
  Result.map((data: any) => data.score),
); // Ok(95)

const malformed = Json.parse('{invalid}'); // Err(SyntaxError)
```

---

## Safe Stringifying with Json.stringify

`Json.stringify` serializes a value to JSON and captures serialization errors inside an
`Err(TypeError)`:

```ts
const serialized = Json.stringify({ name: "Alice", active: true });
// Ok('{"name":"Alice","active":true}')

const circular: any = {};
circular.self = circular;
const failed = Json.stringify(circular); // Err(TypeError: Converting circular structure to JSON)
```

---

## Problems it solves

- **Safe parsing of untrusted webhook and API payloads**: Calling native `JSON.parse()` on malformed
  HTTP request bodies or corrupted cache entries throws runtime exceptions that crash endpoints if
  not surrounded by `try/catch`. `Json.parse` returns a typed `Result<Error, unknown>`, turning
  parse errors into ordinary failure variants.
- **Resilient serialization for local storage and caching**: Serializing dynamic application state
  to `localStorage` or network sockets can throw unexpected exceptions if objects contain circular
  references or unsupported types. `Json.stringify` returns a `Result<Error, string>`, preventing
  unhandled runtime crashes during state persistence.
- **Seamless pipeline integration**: Raw JSON strings can be parsed and piped directly into schema
  validators, `Refinement` guards, or `Maybe`/`Result` pipelines without temporary variables or
  enclosing try-catch statements.
