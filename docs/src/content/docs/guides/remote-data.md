---
title: RemoteData — loading states
description: Model the four states of a data fetch explicitly instead of juggling boolean flags.
---

Every async data fetch has exactly four moments: before it starts, while it's loading, when it
fails, and when it succeeds. That's the whole picture. But it's common to spread these four states
across separate variables that can get out of sync and produce combinations that shouldn't exist.
`RemoteData<E, A>` gives each state a name and keeps them mutually exclusive — only one is active at
any given time.

## The problem with flag soup

A typical approach to loading states looks like this:

```ts
const [data, setData] = useState<User | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

Three separate pieces of state, but they're not actually independent — only certain combinations are
meaningful. The type allows `loading: true` and `error: "timeout"` at the same time, which is
contradictory. Nothing prevents you from forgetting to reset `error` when a new request starts, or
showing stale data while `loading` is true.

## The RemoteData approach

`RemoteData` makes the states explicit and mutually exclusive. There's one value with one state at a
time:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { RemoteData } from "@nlozgachev/pipelined/core";

type State = RemoteData<string, User>;

// State transitions:
let state: State = RemoteData.notAsked(); // before the user triggers a fetch
state = RemoteData.loading(); // request in flight
state = RemoteData.failure("Timed out"); // request failed
state = RemoteData.success(user); // request succeeded
```

Each state is represented once, and they can't overlap. The type system prevents you from combining
them incorrectly.

## Creating RemoteData values

```ts
RemoteData.notAsked(); // NotAsked — no fetch triggered yet
RemoteData.loading(); // Loading  — fetch in progress
RemoteData.failure("Not found"); // Failure  — fetch failed with an error
RemoteData.success(user); // Success  — fetch succeeded with a value
```

## Rendering all four states with `match`

`match` is the primary way to consume a `RemoteData`. It requires a handler for every state, so the
compiler ensures you've covered all cases:

```ts
const message = pipe(
	userData,
	RemoteData.match({
		notAsked: () => "Click to load",
		loading: () => "Loading...",
		failure: (err) => `Failed: ${err}`,
		success: (user) => `Hello, ${user.name}`,
	}),
);
```

Because all four branches are required, there's no way to accidentally skip the loading state or
forget to handle errors. The type checker will tell you if a case is missing.

**`fold`** does the same thing with positional arguments:

```ts
pipe(
	userData,
	RemoteData.fold(
		() => "Not asked",
		() => "Loading...",
		(err) => `Error: ${err}`,
		(user) => `Hello, ${user.name}`,
	),
);
```

## Transforming the success value with `map`

`map` transforms the value inside `Success`, leaving all other states unchanged:

```ts
pipe(
	RemoteData.success(5),
	RemoteData.map((n) => n * 2),
); // Success(10)
pipe(
	RemoteData.loading(),
	RemoteData.map((n) => n * 2),
); // Loading
pipe(
	RemoteData.failure("!"),
	RemoteData.map((n) => n * 2),
); // Failure("!")
pipe(
	RemoteData.notAsked(),
	RemoteData.map((n) => n * 2),
); // NotAsked
```

This lets you transform data as part of a pipeline without breaking out of the `RemoteData` context:

```ts
const userName = pipe(
	userData, // RemoteData<string, User>
	RemoteData.map((u) => u.name), // RemoteData<string, string>
	RemoteData.getOrElse(() => "Unknown"),
);
```

## Transforming errors with `mapError`

`mapError` transforms the error inside `Failure`, leaving other states unchanged:

```ts
pipe(
	RemoteData.failure("connection refused"),
	RemoteData.mapError((e) => ({ code: 503, message: e })),
); // Failure({ code: 503, message: "connection refused" })
```

Useful for normalizing error types from different sources before they reach your rendering logic.

## Chaining dependent fetches

`chain` sequences a second fetch that depends on the result of the first. If the current state is
`Success`, it passes the value to the function and returns whatever that produces. All other states
pass through:

```ts
pipe(
	userData, // RemoteData<string, User>
	RemoteData.chain((user) => fetchUserPosts(user.id)), // RemoteData<string, Post[]>
);
```

If `userData` is `Loading`, `Failure`, or `NotAsked`, the chain step is skipped and that state
propagates.

## Recovering from failures

`recover` provides a fallback `RemoteData` when the current state is `Failure`. Unlike
`Result.recover`, it receives the error value so you can use it in the recovery logic. The fallback
can produce a different success type, widening the result to `RemoteData<E, A | B>`:

```ts
pipe(
	fetchFromPrimary(url),
	RemoteData.recover((err) => {
		console.warn("Primary failed:", err);
		return fetchFromFallback(url);
	}),
);
```

## Extracting the value

**`getOrElse`** — returns the success value or a default thunk `() => B` for any other state. The
thunk is only called when the value is not `Success`. The default can be a different type, widening
the result to the union of both:

```ts
pipe(RemoteData.success(5), RemoteData.getOrElse(() => 0)); // 5
pipe(RemoteData.loading(), RemoteData.getOrElse(() => 0)); // 0
pipe(RemoteData.failure("!"), RemoteData.getOrElse(() => 0)); // 0
pipe(RemoteData.loading(), RemoteData.getOrElse(() => null)); // null — typed as number | null
```

## Converting to other types

When you need to work with a part of the system that uses `Maybe` or `Result`, you can convert:

**`toMaybe`** — `Success` becomes `Some`, everything else becomes `None`:

```ts
RemoteData.toMaybe(RemoteData.success(42)); // Some(42)
RemoteData.toMaybe(RemoteData.loading()); // None
```

**`toResult`** — `Success` becomes `Ok`, `Failure` becomes `Err`. `NotAsked` and `Loading` become
`Err` using a fallback error you provide:

```ts
pipe(
	RemoteData.success(42),
	RemoteData.toResult(() => "not loaded yet"),
); // Ok(42)

pipe(
	RemoteData.loading(),
	RemoteData.toResult(() => "not loaded yet"),
); // Err("not loaded yet")
```

## When to use RemoteData

Use `RemoteData` when:

- You're displaying fetched data in a UI and need to handle all loading states explicitly
- You want the type system to prevent invalid state combinations like simultaneous loading and error
- You want a single value in state instead of three separate flags

It's also useful outside UI contexts — any time you're tracking the lifecycle of an async operation
and need to distinguish "hasn't started" from "in progress" from "done".
