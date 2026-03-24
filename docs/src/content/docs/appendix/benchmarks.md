---
title: Performance & benchmarks
description: Why wrapping native data types with a friendlier API requires ongoing benchmarking, and how custom implementations beat native methods without touching the public API.
---

The types in `pipelined/core` — `Maybe`, `Result`, `Task`, `RemoteData` — replace patterns that
don't have a built-in equivalent in JavaScript. There is no native "absent value that propagates
through transformations" or "typed failure channel". The overhead of introducing them is the cost
of abstraction over nothing.

The utilities in `pipelined/utils` are different. `Arr`, `Rec`, `Num`, `Str`, `Dict`, and `Uniq` wrap things
JavaScript already does — iterating arrays, looking up keys, parsing numbers, splitting strings.
Every method has a native counterpart one call away. The gap between the pipelined version and the
plain JavaScript version is visible and measurable.

That proximity is what makes benchmarking necessary. It is also what creates the opportunity to do
better than the native equivalent — not by magic, but because the library controls the
implementation and can choose strategies that the language's built-in methods cannot.

## What the gap is

When you write:

```ts
pipe(users, Arr.filter(u => u.active));
```

instead of:

```ts
users.filter(u => u.active);
```

the result is identical, but the path to get there is not. The pipelined version goes through
an extra function call — `Arr.filter` returns a curried function, that function receives the
array, and then the implementation runs. In the simplest cases the JIT sees through this quickly.
In other cases — particularly where the overhead compounds across thousands of elements — it does
not. And in some cases, the implementation inside that extra call is faster than the native method
it would otherwise delegate to.

The goal of the utilities is to make this:

```ts
pipe(
	rawData,
	Rec.filter(isActive),
	Rec.mapKeys(toSnakeCase),
	Rec.map(formatValue),
);
```

feel as natural as chaining methods, without making it meaningfully slower. A small overhead is
the expected cost of composability and data-last currying. A large overhead — one that would make
a reasonable developer reach back for the native equivalent — is a bug.

## What "acceptable" looks like

The practical threshold is: pipelined should not be measurably slower than an idiomatic native
implementation on real-world input sizes. Each operation is measured at 100 and 10 000 elements —
the smaller size represents typical application data; the larger exposes per-element overhead that
only compounds at scale.

Operations that stay within roughly 10–15% of the native baseline at that scale are considered
within noise. The cost is the cost of composability, and composability is the point.

Operations that exceed that threshold by a significant margin are worth examining.

## How implementations are kept fast

The simplest implementation of `Arr.filter` is one line — delegate to the native method:

```ts
data.filter(predicate);
```

That is also, in practice, the slowest option. Benchmarks showed `.filter()` taking 75 µs for
10 000 elements; a manual index loop with `push` performs the same operation in 19 µs. The native
method carries overhead that a direct loop does not — the difference is not theoretical.

This pattern repeats across the library. Several techniques appear wherever the benchmarks show
a real gap:

**Pre-allocation.** When the output length is known before the loop, `new Array<T>(n)` reserves
the exact capacity upfront. Writing `result[i] = value` is then a direct slot write, with no
re-allocation. A push-based loop on 10 000 numbers runs in ~24 µs; the pre-allocated equivalent
runs in ~10 µs. `Arr.map`, `Arr.scan`, `Arr.zip`, `Arr.traverse`, and `Num.range` all use this.

**Direct index loops over native methods.** `.filter()`, `.every()`, `.some()`, and `.flatMap()`
all carry callback-dispatch overhead that cannot be avoided through the native API. Replacing them
with `for (let i = 0; i < n; i++)` loops and inlining the check eliminates that overhead entirely.
`Arr.every` dropped from 42 µs to ~6 µs. `Arr.filter` dropped from 75 µs to 19 µs.

**Choosing the right record iteration strategy.** `Object.entries` allocates a `[key, value]` pair
per entry, which adds up across many keys. For operations that unconditionally read both key and
value — like `Rec.map` — calling `Object.keys` and `Object.values` separately produces two flat
arrays and avoids the pair allocation, which is measurably faster at small sizes. For conditional
operations like `Rec.filter` and `Rec.compact`, the pair allocation is dominated by the branching
cost at 10 000 keys, and a plain `for...of Object.entries` loop performs at parity or better.
The right approach depends on the access pattern, not a single rule.

**Knowing when not to replace native.** `.slice()` — used in `take`, `drop`, and `splitAt` — is
a contiguous memory copy implemented in V8's C++ layer. A JavaScript loop writing element by
element is 5–7× slower. When the native method has a structural advantage that no JS loop can
match, the implementation keeps it.

And yes, the difference is invisible to callers, visible only in the numbers.

## The benchmarks

The benchmarks live in `__bench__` directories and compare each pipelined operation directly
against an equivalent hand-written native implementation. Each group runs both versions with
identical input, measures the time per iteration, and reports the ratio.

To run them:

```sh
pnpm bench
```

Each benchmark group compares the pipelined operation directly against its native equivalent.
Vitest reports the ratio between the fastest variant and the others, so the summary reads as
"X is Yx faster than Z". Many operations now run faster than their native counterpart — not
because the library is doing less, but because it can choose a better strategy for the specific
operation.

## Benchmark environment

The numbers in this documentation were collected on the following setup:

|                |                        |
| -------------- | ---------------------- |
| **CPU**        | Apple M1 Pro (aarch64) |
| **OS**         | macOS (darwin)         |
| **Node.js**    | 24                     |
| **V8**         | 13.6.233.17            |
| **TypeScript** | 5.9.3                  |

Results on other hardware or runtime versions will differ. x86 machines may show different ratios
because V8's JIT strategies and memory layout characteristics vary by architecture. The relative
order of approaches tends to be stable; the exact multipliers do not.

## What the benchmarks are not

They are not a performance contract. The numbers shift between V8 versions, and
machine architectures. What they measure is the _relationship_ between pipelined and native —
and that relationship is what matters.

They are also not a guarantee that every use of the library is fast. Benchmarks measure isolated
operations on arrays of numbers and records of strings. Real code does more: it allocates
intermediate objects, traverses trees, reaches across abstraction boundaries. If performance
matters in a specific context, measure that specific context.

The benchmarks exist so that writing expressive, composable code over arrays and records does not
require thinking about whether the library is getting in the way. It should not be. When it is,
that is what gets fixed.
