---
title: Validation — Accumulating Errors
description: Collect all validation failures in one pass, ensuring a complete overview of errors rather than failing fast on the first one.
---

We have all experienced a frustrating user interface pattern: you fill out a long form, hit submit,
and are presented with a red validation error indicating your password is too short. You fix it,
submit again, only to be told that your email address is malformed. You fix that, submit once more,
and receive a third warning about your postal code.

This trial-and-error cycle is the direct result of a design choice in our code. When we use standard
`try/catch` blocks, conditional guards, or `Result` containers to validate input, we are using a
**fail-fast** model. This model short-circuits at the very first failure:

```ts
// Result-based short-circuiting:
pipe(
  validateName(form.name),
  Result.chain(() => validateEmail(form.email)),
  Result.chain(() => validateAge(form.age)),
);
```

If `validateName` fails, the execution stops. The subsequent checks for `email` and `age` are never
even evaluated. While this short-circuiting behavior is correct for sequential operations where step
B depends on the success of step A, it is highly unhelpful for validating independent data fields in
forms, API payloads, or configuration files.

`Validation<E, A>` is a data structure designed specifically to address this problem. It represents
either a `Passed<A>` success or a `Failed<E>` failure containing a list of accumulated errors.
Instead of short-circuiting, it runs all checks independently and merges all errors together.

---

## Creating Validations

To begin validating, we lift our data checks into the `Validation` context:

```ts
import { Validation } from "@nlozgachev/pipelined/core";

// Representing a successful validation check
const pass = Validation.passed("Alice"); // Validation<never, string>

// Representing a single failure
const fail = Validation.failed("Username must be at least 3 characters"); // Validation<string, never>
```

Under the hood, all failures in `Validation` are collected inside a `NonEmptyList` (a type-safe
array guaranteed to contain at least one element). When you call `Validation.failed(err)`, the
library automatically wraps your error in a list container.

If you already have an array of errors and want to lift it directly, you can use `failedAll`:

```ts
const multipleFails = Validation.failedAll([
  "Email is malformed",
  "Email domain is not allowed",
]);
```

### Constructing checks with `fromPredicate`

You can build reusable, rule-specific validation checkers using `fromPredicate`:

```ts
const validatePasswordLength = Validation.fromPredicate(
  (s: string) => s.length >= 8,
  (s) => `Password of length ${s.length} is too short (minimum 8 characters)`,
);
```

The second argument receives the original input, allowing you to format descriptive, clear feedback
for your users.

---

## The Accumulation Pattern: ap

What makes `Validation` structurally different from `Result` is how we combine multiple independent
checks.

The primary tool for this is `ap` (short for *apply*). The pattern begins by wrapping a curried
constructor function in `passed`, and then applying each validated argument one-by-one:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";

// A constructor function representing our valid target structure
const createUser = (name: string) => (email: string) => (age: number) => ({
  name,
  email,
  age,
});

const result = pipe(
  Validation.passed(createUser),
  Validation.ap(validateName(form.name)),   // Applies name check
  Validation.ap(validateEmail(form.email)), // Applies email check
  Validation.ap(validateAge(form.age)),     // Applies age check
);
```

Let's dissect what happens when this pipeline executes. Each `ap` step inspects both sides:

- If both the function and the argument have passed, the argument value is applied to the function.
- If either the function or the argument has failed, the errors are gathered.
- If *both* have failed, their respective error lists are merged.

Because each argument is validated independently before being combined, all validation checks are
guaranteed to run, and every failure is gathered into a single consolidated `Failed` container.

---

## Alternative Combinators: product and productAll

If the curried `ap` pattern feels unfamiliar or syntactically complex, `Validation` provides
simpler, array-based alternatives.

### Combining two checks with `product`

`product` takes two independent validations and merges them into a single `Validation` carrying a
tuple of both values:

```ts
const combined = Validation.product(
  validateName(form.name),
  validateAge(form.age),
); // Passed([name, age]) or Failed([nameErrors..., ageErrors...])
```

If either validation has failed, the errors from both sides are collected and merged.

### Combining many checks with `productAll`

`productAll` accepts an array of validations, runs all of them, and returns either a `Passed` tuple
containing all successfully validated values, or a `Failed` list containing every accumulated error:

```ts
const formValidation = Validation.productAll([
  validateName(form.name),
  validateEmail(form.email),
  validateAge(form.age),
]);
// Passed([name, email, age]) — if all pass
// Failed([...all errors]) — if any fail
```

Because `productAll` expects a `NonEmptyList` (a non-empty array) of validations, you are guaranteed
to receive a compiled result carrying a type-safe array of values, completely avoiding the
possibility of empty array inputs or undefined states at compile time.

---

## Transforming values

You can transform the success value inside a `Passed` container without worrying about the failure
branch using `map`:

```ts
pipe(
  validateAge(input),
  Validation.map((age) => age * 365), // Converts age in years to age in days
);
```

If the validation has failed, `map` does nothing and lets the accumulated errors propagate.

---

## Extracting the value

Once all checks have run and the errors have been accumulated, you must exit the `Validation`
context at the edge of your pipeline.

### Safe fallbacks with `getOrElse`

`getOrElse` extracts the validated value from a `Passed` container, or returns a safe fallback value
if the validations failed:

```ts
pipe(
  formValidation,
  Validation.getOrElse(() => defaultUserData),
);
```

As with other modules in this library, `getOrElse` expects a function (a thunk) to defer evaluating
the fallback value, saving execution costs if the validation checks pass successfully.

### Exhaustive matching with `match` and `fold`

To drive distinct UI rendering or business branches based on the outcome, you can analyze both cases
using `match` or `fold`:

```ts
// Named cases using match
const view = pipe(
  formValidation,
  Validation.match({
    passed: (data) => renderSuccessDashboard(data),
    failed: (errors) => renderErrorList(errors), // errors is NonEmptyList<E>
  }),
);

// Positional callbacks using fold (failed handler first)
const status = pipe(
  formValidation,
  Validation.fold(
    (errors) => `Failed with ${errors.length} errors`,
    (data) => `Success: user ${data[0]} verified`,
  ),
);
```

---

## Side effects with tapError

When you want to log or inspect validation failures mid-pipeline without altering the validation
flow, you can use `tapError`. It executes a side-effectful callback only if the validation has
failed, passing the full list of accumulated errors:

```ts
pipe(
  formValidation,
  Validation.tapError((errors) => {
    logger.warn(`Form validation failed with ${errors.length} errors`, { errors });
  }),
);
```

---

## Fallback strategies: recover

`recover` provides a fallback `Validation` when validation has failed. It passes the accumulated
error list to your fallback function, allowing you to inspect what went wrong and decide how to
recover dynamically:

```ts
pipe(
  validatePayload(input),
  Validation.recover((errors) => {
    console.warn("Payload validation failed. Using default configuration.", errors);
    return Validation.passed(defaultPayload);
  }),
);
```

---

## Interoperability and Hand-offs

Because software systems use a variety of modeling types, you can translate `Validation` to and from
other modules.

### Discarding errors to Maybe

If you only care about obtaining a valid value and do not need to report the reasons for failure,
you can downgrade the `Validation` to a `Maybe` using `toMaybe`:

```ts
const maybeValidData = Validation.toMaybe(formValidation); // Some(data) or None
```

### Bridging from Result

When incorporating an operation that throws or fail-fast checks (like a `Result` parser) into an
accumulating validation flow, you can lift it using `fromResult`:

```ts
const emailCheck = Validation.fromResult(parseEmail(input)); // Passed(email) or Failed([err])
```

The single error from the `Err` is wrapped in a type-safe `NonEmptyList` automatically.

### Sequencing actions by converting to Result

`Validation` is outstanding for running parallel, independent checks. However, once you have
established that the data is 100% valid, you typically need to run sequential side effects that can
fail (like saving to a database, sending a request, or writing to disk).

For this, you should hand off execution to a `Result` pipeline using `toResult`:

```ts
pipe(
  Validation.productAll([validateName(form.name), validateEmail(form.email)]),
  Validation.toResult, // Passed becomes Ok, Failed becomes Err([errors...])
  Result.chain((data) => db.saveUser(data)), // Sequential, fail-fast side effect
  Result.getOrElse(() => null),
);
```

This hand-off represents a highly common, elegant pattern in production applications: use
`Validation` to gather all input friction, convert to `Result` once the data is clean, and use
`Result.chain` to sequence sequential database or network actions.

---

## When to use Validation vs Result

### Use Validation when:

- **Checks are independent**: Validating form fields, structural payload parsing, or configuration
  sheets.
- **You need comprehensive feedback**: You want to display all errors at once to a user or log them
  all to an audit sheet.
- **The combinations are parallel**: You are fanning out data to multiple checkers simultaneously.

### Use Result when:

- **Checks are dependent**: Validating step B requires step A to have succeeded (e.g. validating an
  address requires the user record to have been successfully fetched first).
- **You want to fail-fast**: Halting execution immediately at the first sign of friction is the
  desired control flow behavior.
- **The operation is a side effect**: Writing files, connecting to networks, or querying databases.
