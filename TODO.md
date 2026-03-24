# Roadmap

# 1.0.0

- [ ] `ReaderTask<R, A>` -- Reader + Task for async operations with dependencies
- [ ] `ReaderTaskResult<R, E, A>` -- Reader + Task + Result for real-world async with deps
- [ ] `gen()` -- generator-based syntax for Maybe, Result, Task, TaskResult, TaskMaybe, TaskValidation; lets you write sequential async/effectful code without nested callbacks (?)
- [ ] `Lazy<A>` -- synchronous, memoised thunk; complements `Task` for expensive pure computations
- [ ] `Equality<A>` -- structured equality (`equals`); instances for primitives, used by `Arr.uniq` and `Map`
- [ ] `Ordering<A>` -- structured ordering (`compare`); instances for primitives, used by `Arr.sortBy`
- [ ] `Combinable<A>` -- combining algebra (`concat`); instances for string, number, boolean, Array, Maybe
- [ ] `Struct` -- lift field-level transformations over plain objects without optics boilerplate
- [ ] `Iter<A>` -- lazy iterable with `map`, `filter`, `take`, `drop`, `flatMap`, `zip`, `scan`; avoids materialising large intermediate arrays