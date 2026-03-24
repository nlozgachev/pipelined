---
title: Reader — deferred dependencies
description: Model computations that depend on a shared environment, supplied once at the boundary.
---

Some values belong to the pipeline, not to any individual function — a database connection, an API
config, a locale. Yet they end up threaded through every signature as an extra parameter, repeated
at every call site, cluttering code that doesn't actually use them. `Reader<R, A>` lets you describe
a computation that needs an environment `R` to produce `A`, compose it freely, and supply `R` once
at the edge of your program.

## The problem with parameter drilling

When multiple functions in a pipeline all need the same input, that input ends up in every signature
even when most functions only forward it:

```ts
function buildUrl(config: ApiConfig, path: string): string {
	return `${config.baseUrl}${path}`;
}

function withApiKey(config: ApiConfig, url: string): string {
	return `${url}?key=${config.apiKey}`;
}

function endpoint(config: ApiConfig, path: string): string {
	return withApiKey(config, buildUrl(config, path));
}
```

`endpoint` doesn't use `config` for anything other than passing it along. As pipelines deepen, this
pattern becomes noise — every signature carries a parameter that belongs to the pipeline, not the
function.

## The Reader approach

With Reader, each function returns a description of the computation it intends to perform, rather
than accepting the dependency as an argument. The pipeline is built first, and the dependency flows
through automatically when it is supplied once at the end:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Reader } from "@nlozgachev/pipelined/core";

type ApiConfig = { baseUrl: string; apiKey: string; };

const buildUrl = (path: string): Reader<ApiConfig, string> => Reader.asks((c) => `${c.baseUrl}${path}`);

const withApiKey = (url: string): Reader<ApiConfig, string> => Reader.asks((c) => `${url}?key=${c.apiKey}`);

const endpoint = (path: string): Reader<ApiConfig, string> => pipe(buildUrl(path), Reader.chain(withApiKey));

pipe(endpoint("/users"), Reader.run(apiConfig));
// "https://api.example.com/users?key=secret"
```

No function accepts `apiConfig` directly. Each step declares what it reads from the configuration,
the composition wires it together, and `Reader.run` injects the value once.

## Creating Readers

**`Reader.asks`** is the primary constructor. It builds a Reader that projects a value from `R`:

```ts
const getBaseUrl: Reader<ApiConfig, string> = Reader.asks((c) => c.baseUrl);
const getApiKey: Reader<ApiConfig, string> = Reader.asks((c) => c.apiKey);
```

**`Reader.ask`** returns the entire `R` unchanged, when you need to pass it whole to something else:

```ts
const logConfig: Reader<ApiConfig, void> = pipe(
	Reader.ask<ApiConfig>(),
	Reader.map((c) => console.log("Config:", c)),
);
```

**`Reader.resolve`** lifts a pure value that needs nothing from `R`:

```ts
const version: Reader<ApiConfig, string> = Reader.resolve("1.0.0");
```

## Transforming with `map`

`map` transforms the value a Reader produces. The environment passes through unchanged.

Consider locale-aware formatting, where rendering an amount correctly depends on the display
context — but that context is not a property of the amount itself:

```ts
type Locale = { symbol: string; separator: string; };

const formatCents = (cents: number): Reader<Locale, string> =>
	Reader.asks(
		(locale) => `${locale.symbol}${(cents / 100).toFixed(2).replace(".", locale.separator)}`,
	);

const labeledAmount = (label: string, cents: number): Reader<Locale, string> =>
	pipe(
		formatCents(cents),
		Reader.map((amount) => `${label}: ${amount}`),
	);

const usd: Locale = { symbol: "$", separator: "." };
const eur: Locale = { symbol: "€", separator: "," };

pipe(labeledAmount("Total", 1999), Reader.run(usd)); // "Total: $19.99"
pipe(labeledAmount("Total", 1999), Reader.run(eur)); // "Total: €19,99"
```

The same Reader, two different environments. `R` is the rendering context; the amounts are ordinary
arguments.

## Sequencing with `chain`

`chain` sequences two Readers where the second depends on the output of the first. Both receive the
same `R`:

```ts
const formatSummary = (subtotal: number, tax: number): Reader<Locale, string> =>
	pipe(
		labeledAmount("Subtotal", subtotal),
		Reader.chain((sub) =>
			pipe(
				labeledAmount("Tax", tax),
				Reader.map((t) => `${sub}\n${t}`),
			)
		),
	);

pipe(formatSummary(1999, 160), Reader.run(usd));
// "Subtotal: $19.99\nTax: $1.60"
```

Each step reads from the locale independently. `chain` threads the environment through without any
step having to accept or forward it explicitly.

## Adapting environments with `local`

Different parts of a program often need different slices of the total environment. `local` adapts a
Reader that expects a narrow type to work inside a broader one, by providing the extraction function:

```ts
type DbConfig = { host: string; port: number; };
type AppEnv = { db: DbConfig; api: ApiConfig; };

// This Reader knows only about DbConfig
const connectionString: Reader<DbConfig, string> = Reader.asks(
	(db) => `postgres://${db.host}:${db.port}/myapp`,
);

// This Reader knows only about ApiConfig
const authHeader: Reader<ApiConfig, string> = Reader.asks(
	(api) => `Bearer ${api.apiKey}`,
);

// Widen each to AppEnv by telling it where to find its slice
const diagnostics: Reader<AppEnv, string> = pipe(
	connectionString,
	Reader.local((env: AppEnv) => env.db),
	Reader.chain((conn) =>
		pipe(
			authHeader,
			Reader.local((env: AppEnv) => env.api),
			Reader.map((auth) => `db=${conn}  auth=${auth}`),
		)
	),
);

pipe(
	diagnostics,
	Reader.run({
		db: { host: "localhost", port: 5432 },
		api: { baseUrl: "...", apiKey: "secret" },
	}),
);
// "db=postgres://localhost:5432/myapp  auth=Bearer secret"
```

`connectionString` and `authHeader` are independently useful Readers with narrow, precise
requirements. `local` lifts them into `AppEnv` without changing their implementations. Library
functions declare only what they need; application code composes them using `local`.

## Applying wrapped functions with `ap`

`ap` applies a function wrapped in a Reader to a value wrapped in a Reader. Both Readers see the
same environment. This is useful when you need to combine the outputs of multiple dependent
computations:

```ts
const multiply = (a: number) => (b: number) => a * b;

const firstNumber: Reader<Config, number> = Reader.asks((c) => c.multiplier);
const secondNumber: Reader<Config, number> = Reader.asks((c) => c.offset);

const product: Reader<Config, number> = pipe(
	Reader.resolve(multiply),
	Reader.ap(firstNumber),
	Reader.ap(secondNumber),
);

pipe(product, Reader.run({ multiplier: 3, offset: 5 })); // 15
```

`ap` sequences applications where the function and value both depend on the environment.

## Side effects with `tap`

`tap` runs a side effect on the produced value and returns it unchanged — useful for logging in the
middle of a pipeline:

```ts
pipe(
	buildUrl("/users"),
	Reader.tap((url) => console.log("Requesting:", url)),
	Reader.chain(withApiKey),
	Reader.run(apiConfig),
);
```

## Running with `run`

`Reader.run` executes a Reader by supplying the environment. It is the data-last equivalent of
calling the function directly:

```ts
// These are equivalent
pipe(endpoint("/users"), Reader.run(apiConfig));
endpoint("/users")(apiConfig);
```

`Reader.run` fits naturally at the end of a `pipe` chain. Call it once, at the point in your
program where the environment is available.

## When to use Reader

Use Reader when:

- Multiple steps in a pipeline all need the same input and you want to avoid threading it through
  every function signature
- You want to compose functions with narrow, precise requirements into a broader context using
  `local`
- You want to run the same pipeline against different inputs — different locales, test vs.
  production config, different strategies — without changing the pipeline itself

Keep passing arguments directly when:

- Only one or two functions need the value — the overhead of Reader is not worth it
- The value changes between calls in a way that belongs in the function signature, not the
  environment
