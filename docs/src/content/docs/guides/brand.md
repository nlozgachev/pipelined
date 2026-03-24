---
title: Brand — distinguishing values
description: Make the type system distinguish values that share the same underlying type.
---

TypeScript's structural typing is usually a strength — types that look the same are treated the
same, without ceremony. For primitive values like IDs and codes, though, it can work against you:
every `string` is interchangeable with every other `string`, so a `CustomerId` and a `UserId` are
compatible even when they shouldn't be. `Brand<K, T>` uses a phantom type to make them distinct at
compile time, with no runtime cost.

## The problem with structural typing

TypeScript uses structural typing: two types are compatible if they have the same shape. For
primitives, this means every `string` is interchangeable with every other `string`:

```ts
function getUser(id: string): User { ... }
function getProduct(id: string): Product { ... }

const customerId = "c-99";
getUser(customerId); // no error — it's just a string
```

The function signature says `string`. TypeScript sees a `string`. It compiles. But `customerId` is
semantically wrong here — the function expects a user ID, not a customer ID. The bug is invisible to
the type system.

## The Brand approach

`Brand` adds a phantom tag to a type — a marker that exists only at compile time, with zero runtime
overhead. The underlying value is still a plain `string`, but TypeScript now treats `UserId` and
`CustomerId` as distinct:

```ts
import { Brand } from "@nlozgachev/pipelined/types";

type UserId     = Brand<"UserId",     string>;
type CustomerId = Brand<"CustomerId", string>;

const toUserId     = Brand.wrap<"UserId",     string>();
const toCustomerId = Brand.wrap<"CustomerId", string>();

function getUser(id: UserId): User { ... }

const uid = toUserId("u-42");
const cid = toCustomerId("c-99");

getUser(uid); // ✓
getUser(cid); // TypeError: Argument of type 'CustomerId' is not assignable to parameter of type 'UserId'
```

The type error happens at the call site, not at runtime. The values themselves are unchanged — `uid`
is still just the string `"u-42"`.

## Creating a brand

```ts
type UserId = Brand<"UserId", string>;

const toUserId = Brand.wrap<"UserId", string>();
```

`Brand.wrap<K, T>()` returns a constructor. Calling that constructor wraps a value of type `T` in
the brand:

```ts
const id: UserId = toUserId("u-42"); // UserId
```

The convention is to name the constructor `to<TypeName>` — `toUserId`, `toPositiveNumber`,
`toEmailAddress`. This makes it clear that the constructor is performing a conceptual cast, not just
a rename.

## Unwrapping

Because `Brand<K, T>` extends `T`, branded values are assignable to the underlying type without any
conversion:

```ts
const id: UserId = toUserId("u-42");
const raw: string = id; // works — UserId extends string
```

If you need to be explicit, `Brand.unwrap` does the same thing while making the intent clear in the
code:

```ts
const raw: string = Brand.unwrap(id); // "u-42"
```

## Zero runtime cost

The brand is entirely erased by the TypeScript compiler. At runtime, `Brand.wrap` and `Brand.unwrap`
are identity functions — they return the value unchanged. No wrapper object, no extra allocation, no
tag field in the actual value. The only thing that exists is the compile-time phantom type.

## Common use cases

**Distinct ID types** — prevent mixing IDs that share the same underlying type:

```ts
type UserId = Brand<"UserId", string>;
type ProductId = Brand<"ProductId", string>;
type OrderId = Brand<"OrderId", string>;
```

**Validated strings** — encode that a string has passed a check:

```ts
type Email = Brand<"Email", string>;
type Slug = Brand<"Slug", string>;
type NonEmpty = Brand<"NonEmpty", string>;
```

**Units of measurement** — prevent adding metres to kilograms:

```ts
type Metres = Brand<"Metres", number>;
type Kilograms = Brand<"Kilograms", number>;
type Seconds = Brand<"Seconds", number>;
```

**Sanitised values** — mark strings that have been escaped or sanitised:

```ts
type SafeHtml = Brand<"SafeHtml", string>;
```

## Smart constructors

`Brand.wrap` returns an unchecked constructor — it trusts you to provide a valid value. For brands
that carry invariants (like "this string is a valid email"), wrap the constructor in a function that
validates first:

```ts
type Email = Brand<"Email", string>;

const toEmail = Brand.wrap<"Email", string>();

const parseEmail = (s: string): Maybe<Email> => s.includes("@") ? Maybe.some(toEmail(s)) : Maybe.none();
```

Now the only way to get an `Email` value is through `parseEmail`, which enforces the invariant. Any
function accepting `Email` knows it has already been validated — it doesn't need to re-check.

This pattern — a private raw constructor paired with a public validated one — is called a smart
constructor. The brand is what makes it work: without it, nothing stops someone from passing a raw
`string` directly.
