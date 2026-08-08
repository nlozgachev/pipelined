---
title: BigNum — Arbitrary Precision Integers
description: Pure, non-throwing utilities for safe BigInt parsing, type conversions, and data-last arithmetic.
---

JavaScript’s native `BigInt` constructor throws `SyntaxError` when given malformed string input, and
`TypeError` when given floats or numbers outside safe bounds.

`BigNum` provides total, non-throwing constructors returning `Maybe<bigint>`, alongside data-last
arithmetic helpers that compose with `pipe`.

---

## Safe Parsing and Conversions

```ts
import { BigNum } from "@nlozgachev/pipelined/data";

// Safe string parsing:
BigNum.from.string("9007199254740993"); // Some(9007199254740993n)
BigNum.from.string("invalid");          // None

// Safe number conversion (rejects floats, NaN, and unsafe integers):
BigNum.from.number(42);   // Some(42n)
BigNum.from.number(3.14); // None

// Safe conversion back to number (returns None if outside safe bounds):
BigNum.to.number(42n);               // Some(42)
BigNum.to.number(9007199254740993n); // None
```

---

## Data-Last Arithmetic

All arithmetic operations are curried and data-last, allowing direct use inside pipelines:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Maybe } from "@nlozgachev/pipelined/core";

const total = pipe(
  BigNum.from.string("100"),
  Maybe.map(BigNum.add(50n)),
  Maybe.chain(BigNum.div(2n)),
); // Some(75n)
```

---

## When to use BigNum

### Use BigNum when:

- **Parsing unvalidated inputs**: Reading large integer IDs, currency values in cents, or
  cryptographic hashes from user input or HTTP parameters without risk of thrown exceptions.
- **Performing pipelines over BigInts**: Chaining math operations with `pipe` using data-last
  combinators (`add`, `sub`, `mul`, `div`, `mod`, `clamp`, `inRange`).

### Use Num when:

- Standard 64-bit floating point numbers (`number`) are sufficient for your domain calculation.
