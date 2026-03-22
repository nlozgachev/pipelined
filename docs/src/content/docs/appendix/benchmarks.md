---
title: Performance & benchmarks
description: Why wrapping native data types with a friendlier API requires ongoing benchmarking, and how custom implementations beat native methods without touching the public API.
---

The types in `pipelined/core` — `Option`, `Result`, `Task`, `RemoteData` — replace patterns that
don't have a built-in equivalent in JavaScript. There is no native "absent value that propagates
through transformations" or "typed failure channel". The overhead of introducing them is the cost
of abstraction over nothing.

The utilities in `pipelined/utils` are different. `Arr`, `Rec`, `Num`, and `Str` wrap things
JavaScript already does — iterating arrays, looking up keys, parsing numbers, splitting strings.
Every method has a native counterpart one call away. The gap between the pipelined version and the
plain JavaScript version is visible and measurable.

That proximity is what makes benchmarking necessary. It is also what creates the opportunity to do
better than the native equivalent — not by magic, but because the library controls the
implementation and can choose strategies that the language's built-in methods cannot.

## What the gap is

When you write:

```ts
pipe(users, Arr.filter(u => u.active))
```

instead of:

```ts
users.filter(u => u.active)
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
)
```

feel as natural as chaining methods, without making it meaningfully slower. A small overhead is
the expected cost of composability and data-last currying. A large overhead — one that would make
a reasonable developer reach back for the native equivalent — is a bug.

## What "acceptable" looks like

The practical threshold is: pipelined should not be measurably slower than an idiomatic native
implementation on real-world input sizes. For array and record operations, that means measuring at
around 1 000 elements — large enough that per-element overhead adds up, small enough to represent
typical application data rather than a stress test.

Operations that stay within roughly 10–15% of the native baseline at that scale are considered
within noise. The cost is the cost of composability, and composability is the point.

Operations that exceed that threshold by a significant margin are worth examining.

## How implementations are kept fast

The simplest implementation of `Arr.filter` is one line — delegate to the native method:

```ts
data.filter(predicate)
```

That is also, in practice, the slowest option. Benchmarks showed `.filter()` taking 75 µs for
10 000 elements; a manual index loop with `push` performs the same operation in 17 µs. The native
method carries overhead that a direct loop does not — the difference is not theoretical.

This pattern repeats across the library. Several techniques appear wherever the benchmarks show
a real gap:

**Pre-allocation.** When the output length is known before the loop, `new Array<T>(n)` reserves
the exact capacity upfront. Writing `result[i] = value` is then a direct slot write, with no
re-allocation. A push-based loop on 10 000 numbers runs in ~23 µs; the pre-allocated equivalent
runs in ~10 µs. `Arr.map`, `Arr.scan`, `Arr.zip`, `Arr.traverse`, and `Num.range` all use this.

**Direct index loops over native methods.** `.filter()`, `.every()`, `.some()`, and `.flatMap()`
all carry callback-dispatch overhead that cannot be avoided through the native API. Replacing them
with `for (let i = 0; i < n; i++)` loops and inlining the check eliminates that overhead entirely.
`Arr.every` dropped from 51 µs to 5.7 µs. `Arr.filter` dropped from 75 µs to 17 µs.

**Keys + values + index for records.** `Object.entries` allocates a `[key, value]` pair for every
entry — 1 000 entries means 1 000 small arrays. Calling `Object.keys` and `Object.values`
separately produces two flat arrays, then index access replaces the pair lookup. At 1 000 keys,
`Rec.filter` went from 128 µs to 19 µs — faster than the idiomatic native `for...of` loop.

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
deno task bench
```

Each benchmark group names its pipelined variant as the baseline so the native comparison shows
whether pipelined is slower, faster, or at parity. Many operations now run faster than their
native counterpart — not because the library is doing less, but because it can choose a better
strategy for the specific operation.

## Benchmark environment

The numbers in this documentation were collected on the following setup:

|                |                        |
| -------------- | ---------------------- |
| **CPU**        | Apple M1 Pro (aarch64) |
| **OS**         | macOS (darwin)         |
| **Deno**       | 2.7.7 (stable)         |
| **V8**         | 14.6.202.9             |
| **TypeScript** | 5.9.2                  |

Results on other hardware or runtime versions will differ. x86 machines may show different ratios
because V8's JIT strategies and memory layout characteristics vary by architecture. The relative
order of approaches tends to be stable; the exact multipliers do not.

## What the benchmarks are not

They are not a performance contract. The numbers shift between Deno versions, V8 versions, and
machine architectures. What they measure is the *relationship* between pipelined and native —
and that relationship is what matters.

They are also not a guarantee that every use of the library is fast. Benchmarks measure isolated
operations on arrays of numbers and records of strings. Real code does more: it allocates
intermediate objects, traverses trees, reaches across abstraction boundaries. If performance
matters in a specific context, measure that specific context.

The benchmarks exist so that writing expressive, composable code over arrays and records does not
require thinking about whether the library is getting in the way. It should not be. When it is,
that is what gets fixed.
