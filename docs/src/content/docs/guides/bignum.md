---
title: BigNum — Arbitrary Precision Integers
description: Pure, non-throwing utilities for safe BigInt parsing, type conversions, and data-last arithmetic.
---

<!-- BUNDLE_SIZE:START -->

> 7.09 kB minified + gzipped (7,093 B)

<!-- BUNDLE_SIZE:END -->

Financial ledgers, billing engines, cryptocurrency balances, and 64-bit database snowflake IDs
cannot safely use JavaScript's standard `number` type. Because `number` is a 64-bit IEEE-754 float,
it suffers from two critical limitations:

1. **Floating-point precision drift**: Representing currency amounts in dollars (`0.1 + 0.2`)
   introduces binary rounding errors (`0.30000000000000004`), which compounds across ledger entries.
2. **Safe integer ceiling (`Number.MAX_SAFE_INTEGER`)**: Standard numbers lose integer precision
   above `9,007,199,254,740,991` (2^53 - 1). A 64-bit database identifier or an 18-decimal-place
   token balance (such as Wei in Ethereum) silently corrupts low-order digits when parsed as a
   `number`.

JavaScript's native `bigint` solves both representation limits, but its runtime ergonomics are
hazardous inside pipelines:

```ts
// Native BigInt throws SyntaxError on invalid strings or empty text:
const id = BigInt(req.query.cursor); // throws SyntaxError if cursor is "invalid"

// Native BigInt throws RangeError on floats:
const cents = BigInt(19.99); // throws RangeError

// Native bigint division throws RangeError when dividing by 0n:
const share = totalPool / participantCount; // throws RangeError if participantCount === 0n
```

`BigNum` wraps native `bigint` in pure, non-throwing, **data-last** utilities. Every conversion and
division operation that can fail returns an explicit `Maybe` container instead of throwing runtime
exceptions, and every arithmetic helper is curried for direct use in `pipe`.

---

## Mental Model

`BigNum` does not wrap `bigint` in a custom object or class; values remain native JavaScript
`bigint` primitives (`100n`, `0n`, `-42n`) with zero memory overhead. `BigNum` provides the safe
boundary converters (`BigNum.from.*`, `BigNum.to.*`), predicates (`BigNum.is.*`), curried
arithmetic, and collection aggregations needed to manipulate `bigint` values cleanly inside
functional pipelines.

---

## Safe Parsing and Conversions

To parse untrusted strings — such as API query parameters, JSON string fields, or database drivers
returning 64-bit integers as text — use `BigNum.from.string`. It returns `Some(bigint)` for valid
integer strings and `None` for empty, whitespace-only, or malformed strings without throwing a
`SyntaxError`:

```ts
import { BigNum } from "@nlozgachev/pipelined/data";

BigNum.from.string("9007199254740993"); // Some(9007199254740993n)
BigNum.from.string("  -42  ");          // Some(-42n)
BigNum.from.string("19.99");            // None (fractions cannot be BigInt)
BigNum.from.string("invalid");          // None
BigNum.from.string("");                 // None
```

When converting between `number` and `bigint`, `BigNum.from.number` and `BigNum.to.number` enforce
JavaScript's safe integer boundaries (`Number.MIN_SAFE_INTEGER` to `Number.MAX_SAFE_INTEGER`).
Passing a float, `NaN`, `Infinity`, or an integer outside the safe range returns `None` instead of
throwing or silently losing precision:

```ts
// Convert number -> Maybe<bigint>:
BigNum.from.number(42);                       // Some(42n)
BigNum.from.number(3.14);                     // None (not an integer)
BigNum.from.number(Number.MAX_SAFE_INTEGER + 1); // None (unsafe integer precision)

// Convert bigint -> Maybe<number>:
BigNum.to.number(42n);                        // Some(42)
BigNum.to.number(9007199254740993n);          // None (exceeds MAX_SAFE_INTEGER)
```

---

## Numeric Predicates (`BigNum.is`)

The `BigNum.is` namespace provides pure predicates for filtering and branching on `bigint` values:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Arr, BigNum } from "@nlozgachev/pipelined/data";

BigNum.is.zero(0n);       // true
BigNum.is.even(4n);       // true
BigNum.is.odd(3n);        // true
BigNum.is.positive(10n);  // true (strictly > 0n)
BigNum.is.negative(-10n); // true (strictly < 0n)

const ledgerEntries = [-500n, 0n, 1200n, 350n, -100n];
const credits = pipe(ledgerEntries, Arr.filter(BigNum.is.positive));
// [1200n, 350n]
```

---

## Curried Arithmetic and Safe Division

All arithmetic functions in `BigNum` are curried and data-last. `BigNum.add`, `BigNum.subtract`,
`BigNum.multiply`, and `BigNum.abs` operate on `bigint` values directly. Note that
`BigNum.subtract(amount)(from)` computes `from - amount`:

```ts
// Add a 250-cent platform fee:
pipe(5000n, BigNum.add(250n)); // 5250n

// Deduct a 500-cent voucher from a 5000-cent invoice (5000n - 500n):
pipe(5000n, BigNum.subtract(500n)); // 4500n

// Convert 12 dollars to cents:
pipe(12n, BigNum.multiply(100n)); // 1200n

// Normalize a debit delta to its absolute magnitude:
pipe(-1500n, BigNum.abs); // 1500n
```

In native JavaScript, dividing or taking the remainder of a `bigint` by `0n` throws a runtime
`RangeError: Division by zero`. `BigNum.divide(divisor)(dividend)` and
`BigNum.remainder(divisor)(dividend)` catch zero divisors before evaluation and return
`Maybe<bigint>` (performing truncating integer division when the divisor is non-zero):

```ts
// Split a 1000-cent bill across 3 participants:
pipe(1000n, BigNum.divide(3n));    // Some(333n)
pipe(1000n, BigNum.remainder(3n)); // Some(1n) (1 cent unallocated remainder)

// Safe handling when participant count is 0n:
pipe(1000n, BigNum.divide(0n));    // None (never throws RangeError)
pipe(1000n, BigNum.remainder(0n)); // None
```

---

## Boundaries and Clamping

To enforce minimum and maximum transaction limits or check whether an identifier falls within a
shard range, use `BigNum.clamp`, `BigNum.between`, and `BigNum.inRange`:

```ts
// Clamp a withdrawal request between 1000n ($10.00) and 500000n ($5,000.00):
pipe(750000n, BigNum.clamp(1000n, 500000n)); // 500000n
pipe(250n, BigNum.clamp(1000n, 500000n));    // 1000n

// Closed interval check [min, max] (both inclusive):
pipe(500n, BigNum.between(100n, 500n)); // true

// Half-open interval check [start, end) (start inclusive, end exclusive):
pipe(500n, BigNum.inRange(100n, 500n)); // false
pipe(499n, BigNum.inRange(100n, 500n)); // true
```

---

## Collection Aggregations

`BigNum.sum` totals an array of `bigint` values (returning `0n` for an empty array), while
`BigNum.min` and `BigNum.max` return `Maybe<bigint>` so empty arrays are handled explicitly:

```ts
const invoiceCents = [1500n, 4200n, 890n];

BigNum.sum(invoiceCents); // 6590n
BigNum.sum([]);           // 0n

BigNum.min(invoiceCents); // Some(890n)
BigNum.min([]);           // None

BigNum.max(invoiceCents); // Some(4200n)
BigNum.max([]);           // None
```

---

## Pipeline Composition

Here is an end-to-end financial settlement pipeline that parses raw string line items (in cents),
filters for positive charges, applies a minimum charge floor of `100n` cents (`$1.00`), sums the
batch total, and computes an equal split across `recipientCount` payout accounts:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Maybe } from "@nlozgachev/pipelined/core";
import { Arr, BigNum } from "@nlozgachev/pipelined/data";

const rawLineItems = ["2500", "invalid", "-300", "80", "4120"];
const recipientCount = 3n;

const payoutPerRecipient = pipe(
  rawLineItems,
  Arr.filterMap(BigNum.from.string),       // [2500n, -300n, 80n, 4120n]
  Arr.filter(BigNum.is.positive),          // [2500n, 80n, 4120n]
  Arr.map(BigNum.clamp(100n, 1_000_000n)), // [2500n, 100n, 4120n]
  BigNum.sum,                              // 6720n
  BigNum.divide(recipientCount),           // Some(2240n)
  Maybe.getOrElse(() => 0n),               // 2240n ($22.40 per recipient)
);
```

---

## Problems it solves

- **Financial ledger arithmetic without precision drift**: In billing systems, payment processors,
  and ecommerce platforms, calculating money using floating-point numbers produces subtle rounding
  errors. `BigNum` provides exact integer arithmetic for cents, basis points, and minor currency
  units using `bigint`.
- **Crypto token and subunit scaling without precision loss**: Scaling crypto tokens (such as
  converting between Ether and 18-decimal-place Wei, or Bitcoin and Satoshis) exceeds JavaScript's
  `Number.MAX_SAFE_INTEGER`. `BigNum` handles arbitrarily large integers with exact precision and
  guards `number` conversions via `BigNum.from.number` and `BigNum.to.number`.
- **Safe parsing of 64-bit database identifiers and snowflake IDs**: Calling `BigInt()` on untrusted
  query strings or JSON payloads throws runtime exceptions on invalid characters.
  `BigNum.from.string` returns `Maybe<bigint>`, safely handling unvalidated input at API boundaries
  without `try/catch` blocks.
- **Crash-free division and remainder calculations**: Native `bigint` division by `0n` throws a
  runtime `RangeError`. `BigNum.divide` and `BigNum.remainder` return `Maybe<bigint>`, turning zero
  divisors into explicit `None` values.
- **Pipelined `bigint` transformations and boundary clamping**: Chaining mathematical adjustments
  (such as calculating fee tiers, applying deductions, and clamping transaction minimums) inside
  `pipe` using curried, data-last combinators (`BigNum.add`, `BigNum.subtract`, `BigNum.multiply`,
  `BigNum.between`, `BigNum.inRange`, `BigNum.clamp`).
