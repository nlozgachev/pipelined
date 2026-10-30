# Contributing to pipelined

`pipelined` brings structured error handling, optional values, and typed async to TypeScript
developers who have never touched Haskell, fp-ts, or category theory. That is the audience.

---

## The Golden Rule: The Three-Year TS Test

Every decision — naming, docs, parameter order, JSDoc examples — must pass this test:

> *"If a developer who has been writing TypeScript for three years but has never used an FP library
> read this, would they immediately understand what it does and whether they want it?"*

If the answer is no, simplify it. Names describe what functions do (`getOrElse`, `tryCatch`,
`startsWith`), not their algebraic classification.

---

## Development Setup

- **Runtime**: Node >= 24.19.0 (managed via [mise](https://mise.jdx.dev/))
- **Package Manager**: pnpm

```sh
# Clone and install
git clone https://github.com/pplnd/core.git
cd core
pnpm install

# Run the 4-in-1 quality gate (typecheck, type-tests, lint, format)
pnpm check

# Run runtime tests with 100% coverage
pnpm test:coverage
```

---

## Architectural Rules

1. **Plain Discriminated Unions**: No class definitions, no prototype mutation, no `instanceof`.
2. **Data-Last Currying**: The target data is always the final argument
   (`pipe(data, Module.fn(arg))`).
3. **Inner Curried Generic Placement**: When currying `fn(arg)(data)`, declare generics appearing
   only in `data` on the inner returned function with a default fallback (`<E = never>(data: ...)`),
   never on the outer signature.
4. **Single Canonical Way**: One way to accomplish any task. No alias functions, no duplicate
   namespaces. `match({ ok, err })` is the sole eliminator; positional `fold` is prohibited.
5. **No Barrel Imports Internally**: Subpaths in `src/Core/` must import siblings relatively
   (`import { Result } from "./Result.ts"`), never via `#core`.

---

## Testing Standards

- **Zero Type Masks**: `as`, `any`, and `unknown` casts in test suites (`__tests__/*.ts`) are
  strictly prohibited. If a test requires an `as` cast to compile, the module signature or domain
  model is broken.
- **Zero Conformity Tests**: Never write `// @ts-expect-error` merely because the compiler rejects a
  composition that a developer reasonably expects to work. Fix the signature.
- **CFA Narrowing Avoidance**: Exercise un-narrowed unions using `#test-utils` (`constTruthyBool`)
  rather than single-variant constructors (`make.ok(42)`).
- **Tri-Tier Testing**: Every module requires runtime tests (`.test.ts`), type tests (`.test-d.ts`),
  and property-based tests (`.prop.test.ts`).

---

## Pre-PR Checklist

Before opening a pull request, ensure all checks pass:

```sh
pnpm check          # typecheck + test:types + lint + format:check
pnpm test:coverage  # full runtime test suite with 100% coverage
pnpm build          # package build verification
```
