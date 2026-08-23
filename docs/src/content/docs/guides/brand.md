---
title: Brand — Distinguishing Values
description: Use compile-time phantom tags to distinguish between primitive values that share the same underlying type, preventing semantic bugs at zero runtime cost.
---

TypeScript uses structural typing: any `string` is compatible with every other `string`. This allows
semantic bugs—such as passing an `OrderId` into a function expecting a `UserId`—to compile without
warnings.

`Brand<K, T>` attaches a compile-time phantom tag `K` to an underlying type `T`, enforcing nominal
type safety at zero runtime cost:

```ts
import { Brand } from "@nlozgachev/pipelined/types";

type UserId     = Brand<"UserId",     string>;
type CustomerId = Brand<"CustomerId", string>;
```

The underlying values remain plain JavaScript strings, but the compiler now treats `UserId` and
`CustomerId` as completely distinct, incompatible types.

---

## Creating and Wrapping Brands

To lift a raw primitive value into a branded context, we first declare a wrapping constructor using
`Brand.wrap`:

```ts
const toUserId     = Brand.wrap<"UserId",     string>();
const toCustomerId = Brand.wrap<"CustomerId", string>();

const uid = toUserId("usr_42");    // Typed as UserId
const cid = toCustomerId("cust_99"); // Typed as CustomerId
```

At the compile level, passing a `CustomerId` to a function expecting a `UserId` will now trigger a
static type error:

```ts
function getUserProfile(id: UserId): User { ... }

getUserProfile(uid); // ✓ Compiles successfully
getUserProfile(cid); // ✗ Static Type Error: CustomerId is not assignable to UserId
```

This error is resolved entirely at compile time.

---

## Unwrapping Values

Because `Brand<K, T>` structurally extends the underlying type `T`, any branded value is naturally
assignable back to its raw type without requiring any conversion:

```ts
const id: UserId = toUserId("usr_42");
const rawString: string = id; // Compiles successfully — UserId extends string
```

If you prefer to make this unwrapping explicit in your code to document your boundary transitions,
you can use `Brand.unwrap`:

```ts
const rawString: string = Brand.unwrap(id); // "usr_42"
```

---

## Zero Runtime Cost

The brand tag exists solely for the benefit of the TypeScript compiler. The compiled JavaScript
output contains no wrapper objects, no class instantiations, and no tag fields on the actual values.

`Brand.wrap` and `Brand.unwrap` compile directly down to identity functions: `x => x`. They incur
**zero runtime memory allocation** and zero CPU overhead.

---

## Structural Integrity: Smart Constructors

Branding becomes exceptionally powerful when combined with validation to build **Smart
Constructors**.

A standard brand constructor like `toUserId` is unchecked — it trusts you to supply a valid string.
For branded types that must enforce invariants (such as a valid email address, a non-empty string,
or a positive integer), we wrap the brand creator in a validation function:

```ts
import { Maybe } from "@nlozgachev/pipelined/core";

export type Email = Brand<"Email", string>;

const toEmail = Brand.wrap<"Email", string>();

// The only public entryway to create an Email value:
export const parseEmail = (s: string): Maybe<Email> =>
  s.includes("@") ? Maybe.make.some(toEmail(s)) : Maybe.make.none();
```

By hiding the raw `toEmail` constructor and only exporting `parseEmail`, we guarantee that **it is
structurally impossible to instantiate an `Email` type that has not passed validation**.

Downstream functions that accept the `Email` type can trust it completely, bypassing redundant
validation checks:

```ts
// No need to check for "@" here; the type Email guarantees it has passed parseEmail
function sendInvoice(email: Email) {
  smtp.send(Brand.unwrap(email));
}
```

---

## Problems it solves

- **Preventing accidental identifier swapping**: In database queries and service calls, functions
  often accept multiple string IDs (such as `senderId`, `recipientId`, and `organizationId`).
  Because standard TypeScript uses structural typing, swapping these arguments goes unnoticed by the
  compiler. `Brand` creates distinct nominal types (like `UserId` and `AccountId`) that catch
  parameter mismatches at compile time with zero runtime overhead.
- **Enforcing validation boundaries with smart constructors**: Functions that accept emails, slugs,
  or formatted telephone numbers often repeat regex checks defensively or assume incoming strings
  are valid. `Brand` pairs nominal types with smart constructors, ensuring that once a string passes
  validation at the API edge, downstream business logic can rely on that invariant without
  re-validating.
- **Security-critical input sanitization**: Distinguishing sanitized, safe HTML (`SanitizedHtml`) or
  safe SQL fragments from raw user-submitted text prevents XSS and injection vulnerabilities by
  enforcing at compile time that raw strings cannot be passed directly into dangerous rendering or
  query APIs.
- **Eliminating unit and currency mixups**: In calculations involving units (such as `Milliseconds`
  vs `Seconds`, or `UsdCents` vs `EurCents`), raw numbers allow arithmetic across incompatible
  units. `Brand` attaches compile-time units to primitives, preventing mathematical bugs across
  domain layers.
