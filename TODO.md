# Roadmap

# 1.0.0

- [ ] `ReaderTask<R, A>` -- Reader + Task for async operations with dependencies
- [ ] `ReaderTaskResult<R, E, A>` -- Reader + Task + Result for real-world async with deps
- [ ] `gen()` -- generator-based syntax for Option, Result, Task, TaskResult, TaskOption, TaskValidation; lets you write sequential async/effectful code without nested callbacks (?)
- [ ] `Lazy<A>` -- synchronous, memoised thunk; complements `Task` for expensive pure computations
- [ ] `Resource<A>` -- safe acquire-use-release lifecycle built on `TaskResult`; ensures cleanup even on error
- [ ] `Equality<A>` -- structured equality (`equals`); instances for primitives, used by `Arr.uniq` and `Map`
- [ ] `Ordering<A>` -- structured ordering (`compare`); instances for primitives, used by `Arr.sortBy`
- [ ] `Combinable<A>` -- combining algebra (`concat`); instances for string, number, boolean, Array, Option
- [ ] `Struct` -- lift field-level transformations over plain objects without optics boilerplate
- [ ] `Iter<A>` -- lazy iterable with `map`, `filter`, `take`, `drop`, `flatMap`, `zip`, `scan`; avoids materialising large intermediate arrays