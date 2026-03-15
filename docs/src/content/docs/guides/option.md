---
title: Option — absent values
description: Model values that may not exist without null checks scattered across your code.
---

Absence is everywhere in real code. A user that might not be in the database, a config value that
might not be set, a lookup that might come up empty. The usual answer is `T | null`, and then a null
check at every call site — each one a reminder that something might not be there. `Option<A>` makes
the absence part of the type itself, so the check happens once and composes cleanly with everything
else.

## The problem with null

When a function returns `User | null`, nothing in the type system stops you from accessing `.name`
without checking first. The compiler will warn you in strict mode, but the check lives in your code
— and your code alone. Every caller has to remember to do it:

```ts
const user = getUser(id);
const name = user ? user.name : "Unknown"; // remember at every call site
```

This scales poorly. The more values that might be absent, the more `if (x !== null)` checks you
accumulate, often spread across different files and functions.

## The Option approach

With `Option`, the absence is encoded in the type itself. You can't accidentally skip the check —
the operations that work on an `Option` handle both cases for you:

```ts
import { Option } from "@nlozgachev/pipelined/core";
import { pipe } from "@nlozgachev/pipelined/composition";

declare function getUser(id: string): Option<User>;

const name = pipe(
  getUser(id),
  Option.map((user) => user.name), // only runs if user exists
  Option.getOrElse("Unknown"), // provides the fallback
);
```

The `map` step only executes if the value is `Some`. If `getUser` returns `None`, the `map` is
skipped and `None` flows through to `getOrElse`, which then returns the fallback. You never wrote a
conditional — the type enforced the handling.

## Creating Options

```ts
Option.some(42); // Some(42) — wrap a value
Option.none(); // None     — explicit absence
Option.fromNullable(value); // Some if non-null, None if null or undefined
Option.fromUndefined(value); // Some if defined, None if undefined
```

`fromNullable` is the most common entry point when working with existing APIs that return `null` or
`undefined`:

```ts
const setting = pipe(
  config.get("theme"), // string | undefined
  Option.fromNullable, // Option<string>
  Option.getOrElse("light"), // string
);
```

## Transforming values with `map`

`map` transforms the value inside a `Some`, leaving `None` untouched:

```ts
pipe(
  Option.some(5),
  Option.map((n) => n * 2),
); // Some(10)
pipe(
  Option.none(),
  Option.map((n) => n * 2),
); // None
```

You can chain multiple `map` calls — each one only runs if the previous step produced a `Some`:

```ts
pipe(
  Option.fromNullable(user),
  Option.map((u) => u.address),
  Option.map((a) => a.city),
  Option.getOrElse("Unknown city"),
);
```

## Chaining with `chain`

When a transformation itself might produce an absent value, use `chain` instead of `map`. It
prevents nesting `Option<Option<A>>`:

```ts
const parseNumber = (s: string): Option<number> => {
  const n = parseInt(s, 10);
  return isNaN(n) ? Option.none() : Option.some(n);
};

pipe(Option.some("42"), Option.chain(parseNumber)); // Some(42)
pipe(Option.some("abc"), Option.chain(parseNumber)); // None
pipe(Option.none(), Option.chain(parseNumber)); // None
```

Think of it as: `map` is for transformations that always succeed; `chain` is for transformations
that might not.

## Filtering

`filter` turns a `Some` into `None` if the value doesn't satisfy a predicate:

```ts
pipe(
  Option.some(5),
  Option.filter((n) => n > 3),
); // Some(5)
pipe(
  Option.some(2),
  Option.filter((n) => n > 3),
); // None
```

This is useful for narrowing values within a pipeline without breaking out of the `Option` context.

## Extracting the value

At the edge of your pipeline, you need to get a plain value back. There are a few ways:

**`getOrElse`** — provide a fallback value:

```ts
pipe(Option.some(5), Option.getOrElse(0)); // 5
pipe(Option.none(), Option.getOrElse(0)); // 0
```

**`match`** — handle each case explicitly, producing a value from either branch:

```ts
pipe(
  optionUser,
  Option.match({
    some: (user) => `Welcome, ${user.name}`,
    none: () => "Please log in",
  }),
);
```

**`fold`** — same as `match` but with positional arguments (none handler first, some handler
second):

```ts
pipe(
  optionUser,
  Option.fold(
    () => "Please log in",
    (user) => `Welcome, ${user.name}`,
  ),
);
```

**`toNullable` / `toUndefined`** — escape hatch back to null/undefined when interoperating with APIs
that expect them:

```ts
const value: string | null = pipe(opt, Option.toNullable);
```

## Recovering from None

`recover` provides a fallback `Option` when the current one is `None`. Unlike `getOrElse`, the
fallback is itself an `Option` — useful when the fallback operation might also fail:

```ts
pipe(
  Option.fromNullable(cache.get(key)),
  Option.recover(() => Option.fromNullable(db.get(key))),
  Option.getOrElse(defaultValue),
);
```

## Converting to and from Result

`Option` and `Result` are closely related — the difference is whether the absent case carries an
error message. You can convert between them:

```ts
// Option → Result: provide an error for the None case
pipe(
  Option.fromNullable(user),
  Option.toResult(() => "User not found"),
); // Result<string, User>

// Result → Option: discard the error, keep only the success
Option.fromResult(Result.err("oops")); // None
Option.fromResult(Result.ok(42)); // Some(42)
```

## When to use Option vs null

Use `Option` when:

- You want absence to be visible in the type signature and composable through pipelines
- Multiple operations in sequence might each fail to find a value
- You want to use `map`, `chain`, and `filter` without manual null checks at every step

Keep returning `null` or `undefined` when:

- You're writing a small utility that only you consume and null is simpler
- You're interfacing with code that expects null (use `toNullable` at the boundary)
