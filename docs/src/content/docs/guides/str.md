---
title: Str — string utilities
description: Data-last string operations and safe parsers — designed to compose with pipe.
---

JavaScript's `String` prototype has a rich set of methods, but they're all data-first: you call
them on the string itself, which doesn't compose inside `pipe`. `Str` provides the same operations
as data-last curried functions, plus two safe parsers that return `Maybe` instead of `NaN`.

## Transforming case

`Str.toUpperCase` and `Str.toLowerCase` are direct data-last wrappers — pass them to `pipe` or
`Arr.map`:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Arr, Str } from "@nlozgachev/pipelined/utils";

pipe("hello", Str.toUpperCase); // "HELLO"
pipe("WORLD", Str.toLowerCase); // "world"

pipe(["alice", "bob"], Arr.map(Str.toUpperCase)); // ["ALICE", "BOB"]
```

## Cleaning input with `trim`

`Str.trim` removes leading and trailing whitespace:

```ts
pipe("  user input  ", Str.trim); // "user input"
```

In a validation pipeline, `trim` is typically the first step before any pattern checking.

## Splitting strings

`Str.split` splits a string by a string or regex separator, returning a readonly array:

```ts
pipe("a,b,c", Str.split(",")); // ["a", "b", "c"]
pipe("2024-03-22", Str.split("-")); // ["2024", "03", "22"]
```

For splitting into natural words or lines, `Str.words` and `Str.lines` handle whitespace and
line-ending edge cases for you.

## Splitting into lines and words

`Str.lines` splits a string into lines, normalising `\r\n`, `\r`, and `\n` endings — useful when
parsing multi-line text from different sources:

```ts
Str.lines("one\ntwo\nthree"); // ["one", "two", "three"]
Str.lines("one\r\ntwo\r\nthree"); // ["one", "two", "three"]
```

`Str.words` splits a string on any whitespace boundary, trims both ends, and filters out empty
tokens — no need to chain `trim` + `split` + `filter`:

```ts
Str.words("  hello   world  "); // ["hello", "world"]
Str.words("a\tb\nc"); // ["a", "b", "c"]
```

## Predicates for filtering

`Str.includes`, `Str.startsWith`, and `Str.endsWith` are curried predicates that work directly
with `Arr.filter`:

```ts
const logLines = [
	"[ERROR] disk full",
	"[INFO] server started",
	"[ERROR] connection refused",
];

pipe(logLines, Arr.filter(Str.startsWith("[ERROR]")));
// ["[ERROR] disk full", "[ERROR] connection refused"]
```

## Safe number parsing

Parsing a number with `Number(s)` or `parseInt` returns `NaN` on failure, which propagates
silently. `Str.parse.int` and `Str.parse.float` return `Maybe<number>` instead:

```ts
Str.parse.int("42"); // Some(42)
Str.parse.int("3.7"); // Some(3) — truncates to integer
Str.parse.int("abc"); // None
Str.parse.int(""); // None

Str.parse.float("3.14"); // Some(3.14)
Str.parse.float("abc"); // None
```

`Str.parse.int("3.7")` returns `Some(3)` — it truncates like `parseInt`, not like `parseFloat`.
If you need the decimal, use `Str.parse.float`.

This integrates with the `Maybe` API for safe fallback handling:

```ts
import { Maybe } from "@nlozgachev/pipelined/core";

pipe(
	req.query.limit,
	Str.parse.int,
	Maybe.map(n => Math.min(n, 100)),
	Maybe.getOrElse(() => 20),
); // validated page limit, defaulting to 20
```

## Composing it all

`Str` functions are designed to appear as steps in a `pipe` chain alongside other operations:

```ts
pipe(
	rawCsv,
	Str.trim,
	Str.split("\n"),
	Arr.map(Str.trim),
	Arr.filter(Str.includes(",")),
	Arr.map(Str.split(",")),
); // a 2D array of trimmed, non-empty CSV rows
```

## When to use Str

Use `Str` when:

- You're composing string operations inside a `pipe` chain and want point-free style
- You're filtering or mapping arrays of strings and want named predicates instead of inline lambdas
- You're parsing numeric strings from user input, query parameters, or configuration and need a
  typed `Maybe` rather than a `NaN` check
- You're splitting multi-line or whitespace-separated text and want consistent handling of edge
  cases

Keep using the native `String` prototype methods when:

- The operation is a one-liner in a function body where the method call is already clear
- You need locale-sensitive operations (`localeCompare`, `toLocaleLowerCase`, etc.)
- You don't need the result to compose in a pipeline
