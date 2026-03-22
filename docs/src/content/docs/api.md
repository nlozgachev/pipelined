---
title: API Reference
description: Complete reference for all types and functions in pipelined.
---

The library is split into four entry points. Each is independently importable.

## Core

import from `@nlozgachev/pipelined/core`

| Type                                                          | Description                                                                       |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [Option](/api/core/type-aliases/option)                       | A value that may or may not exist. Replaces `T \| null \| undefined`.             |
| [Result](/api/core/type-aliases/result)                       | An operation that succeeds with a value or fails with an error.                   |
| [Validation](/api/core/type-aliases/validation)               | Like Result, but accumulates all errors instead of stopping at the first.         |
| [Task](/api/core/type-aliases/task)                           | A lazy, infallible async operation.                                               |
| [TaskResult](/api/core/type-aliases/taskresult)               | A lazy async operation that can fail.                                             |
| [TaskOption](/api/core/type-aliases/taskoption)               | A lazy async operation that may return nothing.                                   |
| [TaskValidation](/api/core/type-aliases/taskvalidation)       | A lazy async operation that accumulates errors.                                   |
| [RemoteData](/api/core/type-aliases/remotedata)               | The four states of a data fetch: NotAsked, Loading, Failure, Success.             |
| [Deferred](/api/core/type-aliases/deferred)                   | A minimal async value that always resolves — no rejection handling needed.        |
| [These](/api/core/type-aliases/these)                         | An inclusive-OR: holds a first value, a second value, or both simultaneously.     |
| [Tuple](/api/core/type-aliases/tuple)                         | A typed pair where both values are always present.                                |
| [Lens](/api/core/type-aliases/lens)                           | Focus on and immutably update a required nested field.                            |
| [Optional](/api/core/type-aliases/optional)                   | Focus on and update an optional nested field or array index.                      |
| [Reader](/api/core/type-aliases/reader)                       | Computations that read from a shared environment without threading it everywhere. |
| [State](/api/core/type-aliases/state)                         | Thread mutable state through a pipeline without explicit passing.                 |
| [Logged](/api/core/type-aliases/logged)                       | A value paired with an accumulated log; thread logs through a pipeline.           |
| [Predicate](/api/core/type-aliases/predicate)                 | Composable boolean checks; combine with `and`, `or`, `not`.                      |
| [Refinement](/api/core/type-aliases/refinement)               | Type predicates with runtime validation; narrows a broad type to a specific one.  |

## Utils

import from `@nlozgachev/pipelined/utils`

| Module                                                      | Description                                                                        |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [Arr](/api/utils/namespaces/arr/functions)                  | Array utilities (find, groupBy, zip, partition) that return Option instead of throwing. |
| [Dict](/api/utils/namespaces/dict/functions)                | Build, look up, and transform key-value maps.                                      |
| [Num](/api/utils/namespaces/num/functions)                  | Number utilities: clamp, range, sum, and arithmetic helpers.                       |
| [Rec](/api/utils/namespaces/rec/functions)                  | Record/object utilities: pick, omit, mapValues, and key transformations.           |
| [Str](/api/utils/namespaces/str/functions)                  | String utilities: trim, split, capitalize, and parsing helpers.                    |
| [Uniq](/api/utils/namespaces/uniq/functions)                | Deduplicate and manage sets represented as arrays.                                 |

## Types

import from `@nlozgachev/pipelined/types`

| Type                                                 | Description                                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| [Brand](/api/types/type-aliases/brand)               | Nominal typing — prevents mixing values that share the same underlying type. |
| [NonEmptyList](/api/types/type-aliases/nonemptylist) | An array guaranteed to have at least one element.                            |

## Composition

import from `@nlozgachev/pipelined/composition`

| Function                                        | Description                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| [pipe](/api/composition/functions/pipe)         | Pass a value through a sequence of functions, left to right.                 |
| [flow](/api/composition/functions/flow)         | Compose functions into a reusable pipeline.                                  |
| [compose](/api/composition/functions/compose)   | Compose functions right to left.                                             |
| [tap](/api/composition/functions/tap)           | Run a side effect without breaking the pipeline.                             |
| [curry](/api/composition/functions/curry)       | Convert a multi-argument function into a chain of single-argument functions. |
| [memoize](/api/composition/functions/memoize)   | Cache function results by argument.                                          |
| [identity](/api/composition/functions/identity) | Return the argument unchanged.                                               |
| [constant](/api/composition/functions/constant) | Return a function that always returns the same value.                        |
| [not](/api/composition/functions/not)           | Negate a predicate function.                                                 |
| [once](/api/composition/functions/once)         | Call a function at most once; return the cached result thereafter.           |
