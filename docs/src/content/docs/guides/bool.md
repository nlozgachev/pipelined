---
title: Bool — Boolean Utilities
description: Curried boolean algebra, lazy short-circuiting, truthiness narrowing, catamorphic branching, and type-safe Maybe and Result bridges.
---

Working with boolean logic in standard JavaScript and TypeScript frequently leads to nested ternary
expressions, repetitive inline arrow functions inside pipelines, and awkward conversions between
boolean flags and structured data types like `Maybe` and `Result`.

Simple pipeline steps — such as combining feature flags, evaluating permissions, parsing query
parameter flags, or conditionally lifting a value into a safe container — often force developers to
write imperative `if/else` statements or inline lambdas like `b => !b` and
`condition ? Maybe.make.some(data) : Maybe.make.none()`.

`Bool` provides curried, data-last boolean algebra, lazy short-circuiting operators, exhaustive
pattern matching, and type-safe conversion bridges designed specifically for pipelines.

## The problem with boolean handling in pipelines

Consider a service verifying whether a user is allowed to access a protected workspace feature:

```ts
function checkFeatureAccess(user: User, isFlagEnabled: boolean): string {
  const isEligible = user.isActive && user.isEmailVerified && !user.isSuspended;

  if (isEligible && isFlagEnabled) {
    return "Access Granted";
  } else {
    return "Access Denied";
  }
}
```

While simple, this imperative pattern breaks down when integrated into linear pipelines:

1. Combining multiple boolean conditions requires temporary variables or inline closures.
2. In-line ternaries like `condition ? computeExpensive() : fallback` cannot easily be composed or
   reused across pipe steps.
3. Parsing string flags from query parameters (e.g. `"?debug=true"`) using `Boolean("false")`
   produces `true` — a classic JavaScript coercion trap.
4. Converting a truthy condition into a `Maybe<T>` or `Result<E, T>` requires manual ternaries that
   obscure business logic.

`Bool` solves these challenges by treating booleans as first-class values with composable algebra
and safe boundaries.

## Type guards and truthiness narrowing

The `Bool.is` namespace provides type guards for runtime verification and compile-time narrowing:

```ts
import { Bool } from "@nlozgachev/pipelined/data";

// Type verification
Bool.is.boolean(true);      // true
Bool.is.boolean("true");    // false

// Literal narrowing
Bool.is.true(true);         // true
Bool.is.false(false);       // true

// Truthiness filtering
const rawValues = ["Alice", "", 42, 0, null, "Bob", undefined];
const activeItems = rawValues.filter(Bool.is.truthy);
// ["Alice", 42, "Bob"] — correctly narrowed without falsy primitives
```

`Bool.is.truthy` excludes `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, and `NaN`, giving
TypeScript a reliable filter predicate for arrays and streams.

## Curried boolean algebra

All logical operators in `Bool` are data-last, meaning the data being evaluated is placed last. This
enables clean, point-free composition inside `pipe`:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";

// Unary negation
pipe(true, Bool.not);  // false
pipe(false, Bool.not); // true

// Binary combinators
pipe(true, Bool.and(false)); // false
pipe(true, Bool.or(false));  // true
pipe(true, Bool.xor(false)); // true
pipe(true, Bool.xor(true));  // false
```

### Lazy evaluation and short-circuiting

When combining conditions where the second evaluation is computationally expensive, use
`Bool.andLazy` and `Bool.orLazy`. The secondary thunk will only run if required:

```ts
// If user.isActive is false, checkRemotePermissions() is NEVER evaluated
const canProceed = pipe(
  user.isActive,
  Bool.andLazy(() => checkRemotePermissions(user.id))
);

// If user.isSuperAdmin is true, verifyGroupMembership() is NEVER evaluated
const hasAdminAccess = pipe(
  user.isSuperAdmin,
  Bool.orLazy(() => verifyGroupMembership(user.id, "admins"))
);
```

### Array aggregations

To aggregate collections of booleans, `Bool.all` and `Bool.any` evaluate an array with
short-circuiting:

```ts
// Passes only when every condition is true (vacuous truth returns true for empty arrays)
Bool.all([user.isActive, user.isEmailVerified, user.hasAcceptedTerms]);

// Passes if any condition is true (returns false for empty arrays)
Bool.any([user.isOwner, user.isAdmin, user.isEditor]);
```

## Branching and pattern matching

Rather than relying on nested ternaries, `Bool` offers declarative catamorphic branching via `fold`
and exhaustive pattern matching via `match`.

### Positional branching with `fold`

Following Pipelined's standard catamorphism convention (falsy/err case first, truthy/ok case
second), `Bool.fold` takes `(onFalse, onTrue)`:

```ts
const themeClass = pipe(
  isDarkMode,
  Bool.fold(
    () => "theme-light",
    () => "theme-dark"
  )
);
```

### Named-case matching with `match`

`Bool.match` matches on `{ true, false }` cases, making branching explicit and readable:

```ts
const statusBadge = pipe(
  service.isOnline,
  Bool.match({
    true: () => ({ label: "Operational", color: "green" }),
    false: () => ({ label: "Degraded", color: "red" }),
  })
);
```

## Safe parsing and conversions

### Intake with `Bool.from`

JavaScript coercion quirks are avoided through explicit parsing functions:

```ts
import { Maybe } from "@nlozgachev/pipelined/core";

// Safe string parsing (case-insensitive & trimmed)
Bool.from.string("true");     // Some(true)
Bool.from.string("FALSE");    // Some(false)
Bool.from.string("yes");      // None (strict parsing avoids unexpected truthiness)

// Strict numeric parsing (1 and 0 only)
Bool.from.number(1);          // Some(true)
Bool.from.number(0);          // Some(false)
Bool.from.number(42);         // None

// Standard boolean coercion
Bool.from.truthy("content");  // true
Bool.from.truthy(0);          // false
```

### Exporting with `Bool.to`

Convert boolean values into primitive representations:

```ts
Bool.to.number(true);  // 1
Bool.to.number(false); // 0

Bool.to.string(true);  // "true"
Bool.to.string(false); // "false"
```

## Lifting booleans into Maybe and Result

One of the most frequent patterns in functional TypeScript is converting a boolean check into a
container:

```ts
import { Result } from "@nlozgachev/pipelined/core";

// Lift to Maybe (Some on true, None on false)
const optionalToken: Maybe<string> = pipe(
  session.isValid,
  Bool.to.Maybe(() => session.token)
);

// Lift to Result (Ok on true, Err on false)
const authResult: Result<string, UserProfile> = pipe(
  user.hasSubscription,
  Bool.to.Result(
    () => "Active subscription required",
    () => user.profile
  )
);
```

Both `Bool.to.Maybe` and `Bool.to.Result` evaluate their value thunks lazily, ensuring expensive
object constructions or string interpolations only execute when the condition holds.

## Composing boolean pipelines

Combining these primitives allows complex access-control and validation logic to be modeled as a
single, readable pipeline:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Bool } from "@nlozgachev/pipelined/data";
import { Result } from "@nlozgachev/pipelined/core";

type RequestContext = {
  isAuthenticated: boolean;
  isAccountActive: boolean;
  isRateLimited: boolean;
  apiKey: string;
};

function authorizeRequest(ctx: RequestContext): Result<string, string> {
  return pipe(
    ctx.isAuthenticated,
    Bool.and(ctx.isAccountActive),
    Bool.and(Bool.not(ctx.isRateLimited)),
    Bool.to.Result(
      () => "Access unauthorized or rate limit exceeded",
      () => ctx.apiKey
    )
  );
}
```

## Problems it solves

- **Eliminating nested ternary chains**: Replaces complex `a ? (b ? c : d) : e` expressions with
  readable `Bool.and`, `Bool.or`, `Bool.fold`, and `Bool.match` combinators.
- **Preventing JavaScript boolean parsing bugs**: Using standard `Boolean("false")` evaluates to
  `true` in JavaScript. `Bool.from.string` reliably parses `"true"` and `"false"` into
  `Maybe<boolean>`, returning `None` for invalid strings.
- **Short-circuiting in pipelines without imperative `if` blocks**: `Bool.andLazy` and `Bool.orLazy`
  prevent executing secondary expensive operations unless the prior condition warrants it.
- **Streamlined bridges to `Maybe` and `Result`**: `Bool.to.Maybe` and `Bool.to.Result` turn
  validation flags into structured error-handling types point-free and lazily.
- **Reliable truthiness array filtering**: `Bool.is.truthy` provides a type-safe narrowing guard for
  removing falsy values from collections without manual type assertions.
