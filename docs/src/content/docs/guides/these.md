---
title: These — inclusive OR
description: Hold a first value, a second value, or both simultaneously — without implying success or failure.
---

Most operations produce one of two outcomes. `These<A, B>` is for the cases where both can exist
at once. Where `Result<E, A>` is either an error _or_ a value, `These<A, B>` has three variants:

- `First(a)` — only a first value
- `Second(b)` — only a second value
- `Both(a, b)` — both a first and a second value simultaneously

Neither side carries a success or failure connotation. `These` is a neutral inclusive-OR pair:
any combination is valid, and neither side is privileged.


## When two sides coexist

Some operations naturally produce two pieces of information at once:

- Parsing a number from a string with extra whitespace: the number is valid, and the input was
  malformed
- A migration that completed with some rows skipped
- A computation that produced a result alongside a diagnostic notice

In these cases, discarding either piece loses information. `Both` holds them together.

## Creating These values

```ts
import { These } from "@nlozgachev/pipelined/core";

These.first(42); // First — only a first value
These.second("bad input"); // Second — only a second value
These.both(42, "trimmed"); // Both — first and second simultaneously
```

A typical use: a parser that's lenient but records what it fixed:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";

const parseNumber = (s: string): These<number, string> => {
	const trimmed = s.trim();
	const n = parseFloat(trimmed);
	if (isNaN(n)) return These.second("Not a number");
	if (s !== trimmed) return These.both(n, "Leading/trailing whitespace trimmed");
	return These.first(n);
};

parseNumber("  42  "); // Both(42, "Leading/trailing whitespace trimmed")
parseNumber("42"); // First(42)
parseNumber("abc"); // Second("Not a number")
```

## Transforming values

`mapFirst` transforms the first value in `First` and `Both`, leaving `Second` untouched:

```ts
pipe(These.first(5), These.mapFirst((n) => n * 2)); // First(10)
pipe(These.both(5, "warn"), These.mapFirst((n) => n * 2)); // Both(10, "warn")
pipe(These.second("warn"), These.mapFirst((n) => n * 2)); // Second("warn")
```

`mapSecond` transforms the second value in `Second` and `Both`, leaving `First` untouched:

```ts
pipe(These.second("warn"), These.mapSecond((e) => e.toUpperCase())); // Second("WARN")
pipe(These.both(5, "warn"), These.mapSecond((e) => e.toUpperCase())); // Both(5, "WARN")
```

`mapBoth` transforms both sides at once:

```ts
pipe(
	These.both(5, "warn"),
	These.mapBoth(
		(n) => n * 2,
		(e) => e.toUpperCase(),
	),
); // Both(10, "WARN")
```

## Chaining

`chainFirst` passes the first value to the next step, leaving `Second` unchanged. For `Both`,
the second value is not preserved — the result of `f` is returned directly:

```ts
const double = (n: number): These<number, string> => These.first(n * 2);

pipe(These.first(5), These.chainFirst(double)); // First(10)
pipe(These.both(5, "warn"), These.chainFirst(double)); // First(10) — second not carried
pipe(These.second("warn"), These.chainFirst(double)); // Second("warn")
```

`chainSecond` is the symmetric operation on the second side:

```ts
const shout = (s: string): These<number, string> => These.second(s.toUpperCase());

pipe(These.second("warn"), These.chainSecond(shout)); // Second("WARN")
pipe(These.both(5, "warn"), These.chainSecond(shout)); // Second("WARN")
pipe(These.first(5), These.chainSecond(shout)); // First(5)
```

## Extracting values

**`match`** — handle all three cases. `fold` is the positional form if you'd rather not name them:

```ts
pipe(
	result,
	These.match({
		first: (value) => `First: ${value}`,
		second: (note) => `Second: ${note}`,
		both: (value, note) => `Both — ${value} / ${note}`,
	}),
);
```

**`getFirstOrElse`** — returns the first value from `First` or `Both`, or a fallback for `Second`.
The fallback can be a different type, widening the result to `A | C`:

```ts
pipe(These.first(5), These.getFirstOrElse(0)); // 5
pipe(These.both(5, "warn"), These.getFirstOrElse(0)); // 5
pipe(These.second("warn"), These.getFirstOrElse(0)); // 0
pipe(These.second("warn"), These.getFirstOrElse(null)); // null — typed as number | null
```

**`getSecondOrElse`** — symmetric: returns the second value or a fallback for `First`. The fallback
can be a different type, widening the result to `B | D`:

```ts
pipe(These.second("warn"), These.getSecondOrElse("none")); // "warn"
pipe(These.both(5, "warn"), These.getSecondOrElse("none")); // "warn"
pipe(These.first(5), These.getSecondOrElse("none")); // "none"
pipe(These.first(5), These.getSecondOrElse(null)); // null — typed as string | null
```

## Type guards

For checking the variant directly:

```ts
These.isFirst(t); // true if First only
These.isSecond(t); // true if Second only
These.isBoth(t); // true if Both

These.hasFirst(t); // true if First or Both
These.hasSecond(t); // true if Second or Both
```

## Utilities

**`swap`** — flips first and second roles:

```ts
These.swap(These.first(5)); // Second(5)
These.swap(These.second("warn")); // First("warn")
These.swap(These.both(5, "warn")); // Both("warn", 5)
```

**`tap`** — run a side effect on the first value without changing the These:

```ts
pipe(These.first(5), These.tap(console.log)); // logs 5, returns First(5)
```

## When to use These

Use `These` when:

- An operation can produce two pieces of information simultaneously
- You need to carry two independent values — where either or both may be present — through a
  pipeline
- Neither side represents a "primary" success or failure path; both are equally valid

`These` is the less commonly reached-for type in the family. When you find yourself wanting to
carry two independent pieces of data where any combination is possible, that's the signal to
reach for it. If you're unsure whether you need it, you probably don't — reach for `Result` or
`Maybe` first and only switch to `These` when one of those would lose information you need to keep.

One thing to watch out for: `chainFirst` on a `Both` does not carry the second value forward — the
result of `f` is returned directly. If you need the second value preserved through a chain, `Both`
is not a transparent container for it.
