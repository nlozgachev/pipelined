---
title: Performance and benchmarks
description: The overhead of functional composition in TypeScript, and how targeted compiler and engine optimizations keep pipelined performant.
---

In software systems, abstractions always carry a cost.

For the core structures of this library — `Maybe`, `Result`, `Task`, and `RemoteData` — that cost is
the price of representing context. Because JavaScript has no built-in equivalent to a typed failure
channel or an absent value that propagates through transformations, wrapping data in these types
represents the cost of introducing an abstraction where none existed.

For the utility modules — `Arr`, `Rec`, `Dict`, `Num`, `Str`, and `Uniq` — the equation is
different. These modules perform fundamental operations across common data structures: iterating
arrays, traversing object keys, parsing numbers, and splitting strings.

Standard JavaScript engines provide built-in methods on prototypes (`Array.prototype.map`,
`Array.prototype.filter`, `Object.entries`), but these methods are constrained by generic ECMAScript
specification invariants: handling sparse array holes (`HasProperty`), dispatching multi-argument
callbacks, and dynamic memory reallocation. As a result, native methods are frequently slower in
general than specialized, targeted algorithms.

This creates the opportunity not merely to match native built-ins, but to consistently outperform
them. Because `pipelined` controls its implementations, it employs optimal algorithms tailored to
each data structure's access patterns — ensuring the fastest execution path possible.

## The performance cost of composition

When writing code like `pipe(users, Arr.filter(active))` instead of `users.filter(active)`, the end
result is identical, but the execution mechanics differ. The pipelined version introduces an extra
layer of function allocation: `Arr.filter` returns a curried function, which then receives the
array, and only then executes the iteration.

In simple pipelines, modern JIT engines (such as V8, JavaScriptCore, and SpiderMonkey) optimize this
closure overhead away through inlining. In complex pipelines, however, currying can introduce a
small function-call overhead.

The architectural strategy of `pipelined` is straightforward: while currying introduces a small
function call cost for composability, custom algorithms for data-structure operations execute
significantly faster than standard native methods. This runtime advantage absorbs the composition
overhead, ensuring that real-world pipelines remain fast, lightweight, and efficient.

## Benchmarking and performance goals

The practical standard is that `pipelined` operations should match or exceed the performance of
idiomatic native JavaScript code on real-world workloads. Every operation is benchmarked at two
sizes: 100 elements, representing typical application data, and 10,000 elements, exposing
per-element characteristics that compound at scale.

When an operation in the library lags behind, it is treated as an optimization target and resolved.

## Optimization strategies

The simplest way to implement a utility like `Arr.filter` is to delegate directly to the native
method. In practice, however, this is often the slowest approach. In V8 benchmarks, native
`.filter()` takes roughly 75 microseconds for 10,000 elements, whereas a manual index loop with
direct pushes performs the same operation in only 19 microseconds. The native method carries
significant engine callback-dispatch overhead that a direct, low-level loop bypasses.

To close this performance gap, the library employs several targeting strategies across its modules.

One highly effective technique is pre-allocation. When the final size of an array is known before
iteration begins — as with `Arr.map`, `Arr.scan`, `Arr.zip`, `Arr.traverse`, or `Num.range` —
allocating the exact capacity upfront using `new Array(size)` avoids runtime resizing. Direct slot
assignment is far faster than growing an array dynamically. A dynamic push-based loop on 10,000
numbers takes roughly 24 microseconds, while the pre-allocated equivalent runs in about 10
microseconds.

A second strategy is replacing native callbacks with direct index loops. Standard methods like
`.filter()`, `.every()`, and `.some()` carry high callback-dispatch overhead. Replacing them
internally with simple `for` loops and inlining the checks completely eliminates this overhead. For
instance, replacing the native `.every()` method drops execution time from 43 microseconds to just 6
microseconds.

A third optimization involves record and dictionary iteration. Standard operations like
`Object.entries` allocate a nested `[key, value]` array for every key in the object, which creates
significant memory pressure when scaled. For operations that read both keys and values
unconditionally — such as `Rec.map` — calling `Object.keys` and `Object.values` separately to
produce flat arrays avoids this tuple allocation, yielding a faster run. For conditional filtering,
the cost is dominated by branching, making a plain `for...of Object.entries` loop more effective.
The library matches the iteration strategy to the specific access pattern of the operation.

Finally, optimization requires knowing when to yield to the native engine. Contiguous memory copies
like `.slice()` — which powers `take`, `drop`, and `splitAt` — are implemented directly in V8's C++
layer. A pure JavaScript loop writing element by element is roughly five to seven times slower than
this native operation. Where the runtime engine possesses a structural advantage that no JavaScript
loop can match, the library delegates directly to the native implementation.

## Running the benchmarks

The benchmark suite compares every utility operation directly against its equivalent, hand-written
native implementation. The benchmarks live in the respective `__bench__` directories of each module.
They run both variants with identical inputs, measure the execution time per iteration, and report
the relative speed ratio.

To execute the benchmarks, run the following command:

```sh
pnpm bench
```

Vitest reports the ratio between the fastest variant and the others, displaying the relative
performance as a multiplier. Many operations run faster than their native counterparts because the
library employs highly optimized iteration patterns tailored specifically to the semantics of each
function.

## Measurement environment

The performance metrics in this documentation were collected using the following environment:

| Platform Component | Environment Detail     |
| :----------------- | :--------------------- |
| **CPU**            | Apple M1 Pro (aarch64) |
| **OS**             | macOS (darwin)         |
| **Node.js**        | 24                     |
| **V8 Engine**      | 13.6.233.17            |
| **TypeScript**     | 5.9.3                  |

Ratios and absolute numbers will vary depending on hardware, architecture, and runtime engines. For
example, x86 architectures may yield different relative ratios than ARM-based systems due to
variations in JIT compiler optimization strategies and memory layout characteristics. However, the
relative order of performance strategies remains stable.

## Limitations of micro-benchmarks

Micro-benchmarks are not a performance guarantee, nor do they represent a production contract.
Performance characteristics change between V8 versions and across system architectures. These
measurements are valuable because they show the *relationship* between `pipelined` operations and
their native counterparts, ensuring the library does not introduce silent bottlenecks.

Furthermore, isolated benchmarks measure pure data transformations on contiguous memory. Real-world
applications perform complex tasks: allocating intermediate states, traversing deep object graphs,
and interacting with network or filesystem boundaries.

The benchmark suite exists to ensure that writing elegant, composable code does not require worrying
about whether the library is introducing structural overhead. In cases where the library does
introduce a bottleneck, that bottleneck is treated as a bug and is resolved.
