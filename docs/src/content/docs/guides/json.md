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

## When to use Json

### Use Json when:

- **Ingesting raw API payloads**: You are parsing incoming HTTP body text or reading JSON
  configuration files and want typed `Result` error handling.
- **Serializing dynamic state**: You are serializing state payloads for network transmission or
  local storage without throwing runtime errors on unexpected inputs.
