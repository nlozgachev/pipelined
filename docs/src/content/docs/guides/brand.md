---
title: Brand — Distinguishing Values
description: Use compile-time phantom tags to distinguish between primitive values that share the same underlying type, preventing semantic bugs at zero runtime cost.
---

TypeScript’s type system is built on **structural typing**. If two types have the same shape, they
are treated as compatible and fully interchangeable.

Usually, this structural compatibility is a major strength — it allows us to compose objects and
interfaces with minimal ceremony. However, when working with primitive values like identifiers,
measurement units, or validated strings, structural typing can work against us.

In standard TypeScript, every `string` is structurally compatible with every other `string`.
Consider this everyday scenario:

```ts
function getUser(id: string): User { ... }
function getProduct(id: string): Product { ... }

const customerId = "cust_99";
getUser(customerId); // Compiles with zero errors
```

The compiler sees a `string`, receives a `string`, and remains silent. Yet, passing a customer
identifier to a function expecting a user identifier is a clear semantic bug. The type system has
failed to capture our design intent because `string` is too permissive.

`Brand<K, T>` solves this. It adds a compile-time **phantom tag** `K` to a primitive type `T`. It
allows us to overlay a nominal (named) type system on top of TypeScript’s structural one:

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
  s.includes("@") ? Maybe.some(toEmail(s)) : Maybe.none();
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

## When to use Brand

### Use Brand when:

- **Preventing identifier mixing**: You want to distinguish between `UserId`, `OrderId`, and
  `ProductId` to prevent query mismatches.
- **Enforcing validation invariants**: You want to lock down validated domains like `Email`, `Slug`,
  or `SecureHtml` using smart constructors.
- **Distinguishing metrics**: You want to prevent arithmetic errors by separating units like
  `Seconds`, `Meters`, or `Kilograms`.

### Keep using raw types when:

- **Structural compatibility is desired**: You are modeling objects where structural compatibility
  is the intended architectural behavior.
- **Working with complex structures**: You are wrapping rich object models that already carry
  sufficient type distinction through their interface structures.
