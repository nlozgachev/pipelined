---
title: Bool — Boolean Utilities
description: Curried boolean algebra, lazy short-circuiting, truthiness narrowing, exhaustive branching, and type-safe Maybe and Result bridges.
---

Working with boolean logic in standard JavaScript and TypeScript frequently leads to nested ternary
expressions, repetitive inline arrow functions inside pipelines, and subtle coercion bugs:

```ts
function checkFeatureAccess(user: User, rawDebugFlag: string): string {
  // Bug 1: Boolean("false") evaluates to true in JavaScript!
  const isDebug = Boolean(rawDebugFlag);

  const isEligible = user.isActive && user.isEmailVerified && !user.isSuspended;
  if (isEligible || isDebug) {
    return "Access Granted";
  }
  return "Access Denied";
}
```

When integrating boolean conditions into functional pipelines, four friction points appear
repeatedly:

1. **JavaScript string coercion traps**: Passing `"false"` or `"0"` to `Boolean(...)` evaluates to
   `true` because any non-empty string is truthy.
2. **Inline negation and combinator noise**: Negating or combining flags inside `pipe` requires
   inline lambdas like `b => !b` or `b => b && isEnabled`.
3. **Eager evaluation of expensive checks**: Passing `Bool.and(checkPermissions())` evaluates
   `checkPermissions()` immediately, even when the upstream boolean is already `false`.
4. **Manual ternaries to enter `Maybe` or `Result`**: Turning a boolean validation check into a
   `Maybe<A>` or `Result<E, A>` requires writing
   `isValid ? Result.make.ok(val) : Result.make.err(err)` by hand.

`Bool` solves these challenges by providing curried, **data-last** boolean algebra, lazy
short-circuiting operators, exhaustive named-case matching, and direct conversion bridges to `Maybe`
and `Result`.

---

## Type Guards and Truthiness Narrowing

The `Bool.is` namespace provides type guards for runtime checks and compile-time type narrowing:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Arr, Bool } from "@nlozgachev/pipelined/data";

// Type verification:
Bool.is.boolean(true);   // true
Bool.is.boolean("true"); // false

// Literal narrowing:
Bool.is.true(true);      // true (narrows to literal true)
Bool.is.false(false);    // true (narrows to literal false)

// Truthiness and falsiness narrowing:
const rawValues = ["Alice", "", 42, 0, null, "Bob", undefined] as const;

const presentValues = pipe(rawValues, Arr.filter(Bool.is.truthy));
// ["Alice", 42, "Bob"] — narrowed to exclude "", 0, false, 0n, null, undefined

const emptyValues = pipe(rawValues, Arr.filter(Bool.is.falsy));
// ["", 0, null, undefined]
```

`Bool.is.truthy` narrows a type `T` by excluding `false`, `0`, `0n`, `""`, `null`, and `undefined`,
while `Bool.is.falsy` narrows unknown inputs to those falsy primitive values.

---

## Curried Boolean Algebra

All logical operators in `Bool` are data-last, placing the boolean condition being piped as the
final argument:

```ts
// Unary negation:
pipe(true, Bool.not);  // false
pipe(false, Bool.not); // true

// Binary combinators:
pipe(true, Bool.and(false)); // false (true && false)
pipe(true, Bool.or(false));  // true  (true || false)
pipe(true, Bool.xor(false)); // true  (true !== false: exactly one is true)
pipe(true, Bool.xor(true));  // false
```

### Lazy evaluation and short-circuiting

When the second condition in an `AND` or `OR` check involves an expensive computation, use
`Bool.andLazy` and `Bool.orLazy`. The callback thunk is only invoked if the upstream boolean cannot
decide the outcome on its own:

```ts
// If user.isActive is false, hasValidLicense() is never called:
const canLaunchApp = pipe(
  user.isActive,
  Bool.andLazy(() => hasValidLicense(user.id)),
);

// If user.isSuperAdmin is true, hasWorkspaceRole() is never called:
const canManageBilling = pipe(
  user.isSuperAdmin,
  Bool.orLazy(() => hasWorkspaceRole(user.id, "billing_admin")),
);
```

### Array aggregations (`all` and `any`)

To combine an array of booleans into a single result, `Bool.all` and `Bool.any` evaluate the list
from left to right and short-circuit as soon as the answer is known:

```ts
// Returns true only when every condition is true.
// For an empty array [], Bool.all([]) returns true because no condition failed (just like Array.prototype.every):
Bool.all([user.isActive, user.isEmailVerified, user.hasAcceptedTerms]);

// Returns true as soon as at least one condition is true (returns false for an empty array []):
Bool.any([user.isOwner, user.isAdmin, user.isEditor]);
```

---

## Exhaustive Branching with `match`

Instead of writing ternary expressions inside a pipeline, `Bool.match` branches on named
`{ true, false }` handlers:

```ts
const statusBadge = pipe(
  service.isOnline,
  Bool.match({
    true: () => ({ label: "Operational", color: "green" }),
    false: () => ({ label: "Degraded", color: "red" }),
  }),
);
```

---

## Safe Parsing and Conversions

### Parsing with `Bool.from`

To parse environment variables, query flags, or numeric bit flags without falling victim to
JavaScript's truthiness coercion, `Bool.from.string` and `Bool.from.number` return `Maybe<boolean>`:

```ts
import { Maybe } from "@nlozgachev/pipelined/core";

// Case-insensitive, whitespace-trimmed string parsing:
Bool.from.string("true");    // Some(true)
Bool.from.string(" FALSE "); // Some(false)
Bool.from.string("yes");     // None (unrecognized strings return None, never true)

// Strict numeric bit parsing (1 and 0 only):
Bool.from.number(1);         // Some(true)
Bool.from.number(0);         // Some(false)
Bool.from.number(42);        // None

// Explicit JavaScript truthiness coercion when intended:
Bool.from.truthy("content"); // true
Bool.from.truthy(0);         // false
```

### Formatting and lifting with `Bool.to`

`Bool.to.number` and `Bool.to.string` convert booleans to literal `1 | 0` or `"true" | "false"`:

```ts
Bool.to.number(true);  // 1
Bool.to.number(false); // 0

Bool.to.string(true);  // "true"
Bool.to.string(false); // "false"
```

When a boolean check gates access to a value or decides whether a pipeline succeeds or fails,
`Bool.to.Maybe` and `Bool.to.Result` lift the boolean directly into a container using lazy
callbacks:

```ts
import { Result } from "@nlozgachev/pipelined/core";

// Lift to Maybe (Some on true, None on false):
const activeDiscountCode = pipe(
  cart.qualifiesForPromo,
  Bool.to.Maybe(() => "SAVE20"),
); // Some("SAVE20") or None

// Lift to Result (Ok on true, Err on false):
const accessResult = pipe(
  user.hasActiveSubscription,
  Bool.to.Result(
    () => ({ code: "SUBSCRIPTION_REQUIRED", userId: user.id }),
    () => user.workspaceConfig,
  ),
); // Ok(workspaceConfig) or Err({ code: "SUBSCRIPTION_REQUIRED", ... })
```

---

## Pipeline Composition

Combining parsing, boolean algebra, and container lifting lets you express feature-flag and
authorization checks as a linear pipeline:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Maybe, Result } from "@nlozgachev/pipelined/core";
import { Bool } from "@nlozgachev/pipelined/data";

type RequestContext = {
  readonly rawMaintenanceHeader: string;
  readonly isAuthenticated: boolean;
  readonly isAccountActive: boolean;
  readonly sessionToken: string;
};

function authorizeRequest(ctx: RequestContext): Result<string, string> {
  const isMaintenanceMode = pipe(
    ctx.rawMaintenanceHeader,
    Bool.from.string,
    Maybe.getOrElse(() => false),
  );

  return pipe(
    ctx.isAuthenticated,
    Bool.and(ctx.isAccountActive),
    Bool.and(Bool.not(isMaintenanceMode)),
    Bool.to.Result(
      () => "Request rejected: unauthenticated, inactive, or service in maintenance",
      () => ctx.sessionToken,
    ),
  );
}
```

---

## Problems it solves

- **Eliminating nested ternary chains**: Replaces `a ? (b ? c : d) : e` expressions with readable
  `Bool.and`, `Bool.or`, `Bool.xor`, and `Bool.match` combinators.
- **Preventing JavaScript boolean parsing bugs**: Using standard `Boolean("false")` evaluates to
  `true` in JavaScript. `Bool.from.string` and `Bool.from.number` strictly parse `"true"` /
  `"false"` and `1` / `0` into `Maybe<boolean>`, returning `None` for unexpected inputs.
- **Short-circuiting in pipelines without imperative `if` blocks**: `Bool.andLazy` and `Bool.orLazy`
  avoid executing secondary expensive checks unless the upstream boolean requires it.
- **Lazy bridges to `Maybe` and `Result`**: `Bool.to.Maybe` and `Bool.to.Result` turn boolean
  conditions into structured containers point-free while only evaluating their value or error thunks
  when needed.
- **Type-safe truthiness and falsiness filtering**: `Bool.is.truthy` and `Bool.is.falsy` provide
  narrowing type guards for filtering collections without manual type assertions.
