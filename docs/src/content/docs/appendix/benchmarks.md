---
title: Performance and benchmarks
description: What curried pipelines cost, which data operations beat native methods, and where the library is slower.
---

The two halves of `pipelined` have different performance stories.

The core containers (`Maybe`, `Result`, `Task`, `RemoteData`) wrap values in `{ kind, value }` or
`{ kind, error }` objects. JavaScript has no built-in equivalent to a typed error channel, so every
`Ok` or `Some` is an extra small object allocation that plain `throw` or `null` would not make.

The data modules (`Arr`, `Rec`, `Dict`, `Num`, `Str`, `Uniq`) do work that JavaScript already has
methods for: mapping arrays, filtering keys, splitting strings. Here the question is simpler: how
much does `pipe(items, Arr.filter(fn))` cost compared to `items.filter(fn)`?

## What currying costs, and what the loops win back

Writing `pipe(users, Arr.filter(isActive))` allocates a curried wrapper function before the loop
runs. On its own, that wrapper is pure overhead.

What makes up for it is the loop inside. Built-in array methods (`Array.prototype.filter`,
`Array.prototype.flatMap`, `Array.prototype.map`) have to follow the full ECMAScript specification,
including sparse-array checks (`HasProperty`) and generic `thisArg` callback dispatch. A plain `for`
loop over a dense array skips those checks.

In practice, that means several `Arr` and `Rec` functions finish faster than the built-in methods
they replace, even with the curried call around them. Others come out roughly even, and a few are
slower. Both sets of numbers are below.

## Techniques used in the data modules

### Direct index loops instead of array callbacks

Delegating `Arr.filter` to `items.filter(predicate)` is the shortest implementation, and also the
slowest. On 10,000 numbers, `data.filter(fn)` takes about 77 microseconds in V8, while
`pipe(data, Arr.filter(fn))` using an index loop and `push` takes about 20 microseconds.

`Arr.flatMap` shows a similar gap: about 60 microseconds with a loop pushing into a result array,
compared to 279 microseconds for native `.flatMap()`. For `.every()` and `.some()` over 10,000
elements that all pass, an index loop runs in 5.7 microseconds on average versus 13.6 microseconds
for the native methods, mainly because the loop avoids occasional tail spikes.

### Pre-allocating the result array

When the output length is known up front, as in `Arr.map`, `Arr.scan`, `Arr.zip`, `Arr.traverse`,
and `Num.range`, allocating the array once with `new Array(n)` and writing to `result[i]` avoids
growing the backing store as elements are pushed.

On 10,000 numbers, `Arr.scan` with a pre-allocated array takes 10.5 microseconds, compared to 26
microseconds for a `push` loop. `Arr.zip` drops from 57 microseconds with `push` to 38 microseconds
when pre-allocated.

For `Arr.map`, the raw pre-allocated loop runs in 10 microseconds on 10,000 numbers versus 42 to 48
microseconds for `data.map(fn)`. When called through `pipe(data, Arr.map(fn))`, the curried wrapper
preventing V8 from inlining the callback brings the mean time to 52 microseconds, though its 75th
percentile (52 microseconds) still beats native `.map()` (63 microseconds). At 100 elements, both
finish in about 0.1 microseconds.

### Avoiding `Object.entries` tuple allocations

`Object.entries(record)` allocates a two-element `[key, value]` array for every property before your
loop even starts. When an operation transforms every property unconditionally, reading `Object.keys`
and indexing into the record avoids those inner arrays.

On a 100-key record, `Rec.map` runs in 2.6 microseconds, compared to 5.8 microseconds for
`Object.fromEntries(Object.entries(rec).map(...))`. On 10,000 keys, `Rec.compact` takes 1.09
milliseconds versus 1.97 milliseconds for a `for...of Object.entries` loop, and `Rec.mapKeys` takes
1.82 milliseconds versus 2.75 milliseconds.

### Delegating to C++ built-ins for contiguous copies

A JavaScript `for` loop cannot beat the engine at copying a contiguous slice of memory. V8
implements `Array.prototype.slice` in C++, so `Arr.take`, `Arr.drop`, and `Arr.splitAt` delegate to
`.slice()` directly.

On 10,000 elements, `Arr.take` using `.slice()` runs in 0.8 microseconds, while a pre-allocated
JavaScript loop copying element by element takes 4.7 microseconds. `Arr.drop` is 0.7 microseconds
with `.slice()` versus 5.1 microseconds with a loop.

## Where the library is slower

Not every operation beats a hand-written loop or a direct native call. In the current benchmarks on
10,000 elements:

- **`Arr.reduce` (51 us vs 14 us for `data.reduce`)**: `Arr.reduce` delegates to `items.reduce`, but
  passing the reducer through a curried wrapper stops V8 from inlining the callback at the call
  site.
- **`Arr.groupBy` (132 us vs 65 us for a plain loop)**: `Arr.groupBy` checks `Object.hasOwn` on
  every key and guards against `"__proto__"` to prevent prototype pollution, while the baseline loop
  indexes `result[key]` directly.
- **`Rec.filter` (2.31 ms vs 1.81 ms for a `for...of Object.entries` loop)**: calling a curried
  predicate function per key costs more than an inline `if` test inside a `for...of` loop.
- **`Arr.reverse` (13 us vs 10 us for `data.toReversed()`)**: `Arr.reverse` spreads the readonly
  input before calling `.toReversed()`, paying for an extra copy.

For typical application arrays of a few dozen or a few hundred items, these differences are measured
in nanoseconds. In a hot loop over tens of thousands of items, write the loop directly.

## Running the benchmarks

Each module keeps its benchmarks in a `__bench__` directory and compares the `pipelined` function
against the idiomatic native equivalent on the same input. Most benchmarks test 10,000 elements to
make per-element costs visible; `Rec`, `Dict`, `Uniq`, and `Arr.map` also test 100 elements.

To run the suite locally:

```sh
pnpm bench
```

## Measurement environment

The numbers on this page were recorded on:

| Component      | Detail               |
| :------------- | :------------------- |
| **CPU**        | Apple M1 Pro (arm64) |
| **OS**         | macOS (darwin)       |
| **Node.js**    | 26.10.0              |
| **V8**         | 14.6.202.34          |
| **TypeScript** | 6.0.3                |

## What micro-benchmarks do and don't tell you

A micro-benchmark runs the same function thousands of times in a tight loop with hot instruction
caches and predictable branch history. That makes it useful for comparing two implementations of the
same operation on the same machine, and poor at predicting wall-clock time in a real request handler
where memory layout is colder and most time goes to I/O, serialization, or DOM updates.

Use the suite to check whether a change to a data helper made it faster or slower against its native
baseline, not as a production SLA.
