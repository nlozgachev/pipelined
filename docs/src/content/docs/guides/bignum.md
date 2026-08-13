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

## Problems it solves

- **Financial ledger arithmetic without precision drift**: In billing systems, crypto ledgers, and
  ecommerce platforms, calculating money using standard floating-point numbers produces subtle
  rounding errors. `BigNum` provides exact integer arithmetic for cents, basis points, and wei using
  `bigint`.
- **Crypto token and subunit scaling without float loss**: Scaling crypto tokens (such as converting
  between Ether and 18-decimal-place Wei, or Bitcoin and Satoshis) exceeds JavaScript's
  `Number.MAX_SAFE_INTEGER` (which caps at ~9 quadrillion). `BigNum` handles arbitrarily large
  integers with mathematical precision.
- **Safe parsing of 64-bit database identifiers and snowflake IDs**: Calling `BigInt()` on untrusted
  query strings or JSON tokens throws runtime exceptions on invalid characters. `BigNum.from.string`
  returns `Maybe<bigint>`, safely handling unvalidated input at API boundaries without try/catch
  blocks.
- **Pipelined BigInt transformations and boundary clamping**: Chaining mathematical adjustments
  (such as calculating fee tiers, applying percentage splits, and clamping transaction minimums)
  inside `pipe` using curried, data-last combinators (`BigNum.add`, `BigNum.mul`, `BigNum.clamp`).
