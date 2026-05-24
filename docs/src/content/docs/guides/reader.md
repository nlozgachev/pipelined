---
title: Reader — Shared Contexts
description: Model computations that read from a shared environment, eliminating parameter drilling and making dependency injection clean and testable.
---

In software architecture, certain values belong to the context of a pipeline rather than to any
single, individual function. A database connection pool, a global API configuration, a user's
language locale, or a feature flag sheet are typical examples.

When we build pipelines, these values frequently end up threaded through every single function
signature as an extra parameter:

```ts
function formatUrl(config: ApiConfig, path: string): string {
  return `${config.baseUrl}${path}`;
}

function addApiKey(config: ApiConfig, url: string): string {
  return `${url}?key=${config.apiKey}`;
}

function getEndpoint(config: ApiConfig, path: string): string {
  return addApiKey(config, formatUrl(config, path));
}
```

Notice the structural duplication. The intermediate function `getEndpoint` does not use the `config`
object for any internal logic; it accepts it only to forward it to the next step. As pipelines
deepen, this **parameter drilling** introduces noise, clutters type signatures, and makes
refactoring extremely difficult.

We often try to solve this by importing a global singleton or creating a shared state. But this
couples our modules to a specific instance, making it impossible to test them in isolation or run
them against different configurations (e.g. test vs. production contexts).

`Reader<R, A>` solves this structurally. It represents a computation that requires a shared
environment `R` to produce a value `A`:

```ts
type Reader<R, A> = (environment: R) => A;
```

With `Reader`, our functions do not accept dependencies as direct arguments. Instead, they return a
description of a computation waiting for its context. The pipeline is built as a pure, inactive
blueprint, and the environment is supplied once at the boundary of our program.

---

## Creating Readers

To describe how we want to read from our context, we use the constructors of `Reader`:

```ts
import { Reader } from "@nlozgachev/pipelined/core";

interface ApiConfig {
  baseUrl: string;
  apiKey: string;
}

// Projecting specific values from the environment
const getBaseUrl: Reader<ApiConfig, string> = Reader.asks((c) => c.baseUrl);
const getApiKey: Reader<ApiConfig, string> = Reader.asks((c) => c.apiKey);
```

`Reader.asks` is the primary constructor. It takes a selector function that projects a value from
the environment. If a step requires the entire environment, you can use `Reader.ask()`. If you want
to lift a static value that does not depend on the environment at all, you can use
`Reader.resolve(value)`.

---

## Transforming and Sequencing

Once our computations are represented as `Reader` values, we can compose them linearly.

### Transforming values with `map`

`map` transforms the value produced by a Reader, leaving the environment path completely untouched.

Consider locale-aware formatting, where rendering a price depends on a shared context that is not a
property of the price value itself:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";

interface LocaleConfig {
  symbol: string;
  decimalSeparator: string;
}

const formatPrice = (cents: number): Reader<LocaleConfig, string> =>
  Reader.asks(
    (locale) => `${locale.symbol}${(cents / 100).toFixed(2).replace(".", locale.decimalSeparator)}`,
  );

const renderPriceTag = (label: string, cents: number): Reader<LocaleConfig, string> =>
  pipe(
    formatPrice(cents),
    Reader.map((price) => `${label}: ${price}`),
  );

const usdLocale: LocaleConfig = { symbol: "$", decimalSeparator: "." };
const eurLocale: LocaleConfig = { symbol: "€", decimalSeparator: "," };

pipe(renderPriceTag("Total", 1999), Reader.run(usdLocale)); // "Total: $19.99"
pipe(renderPriceTag("Total", 1999), Reader.run(eurLocale)); // "Total: €19,99"
```

The same pipeline runs against two different environments. The locale configuration is injected once
at the very end of our execution.

### Sequencing dependencies with `chain`

When a transformation step itself requires the environment, we use `chain` to sequence them
together. Both steps automatically receive the same shared context:

```ts
const buildEndpoint = (path: string): Reader<ApiConfig, string> =>
  pipe(
    Reader.asks((c: ApiConfig) => `${c.baseUrl}${path}`),
    Reader.chain((url) => Reader.asks((c) => `${url}?key=${c.apiKey}`)),
  );
```

The environment is threaded through the pipeline automatically. No intermediate step is forced to
accept or forward the `ApiConfig` explicitly.

---

## Adapting Contexts: local

In large systems, different modules expect different context slices. A database helper only needs
database credentials, whereas a logger only needs an output stream.

`Reader.local` allows you to adapt a Reader expecting a narrow environment so that it can operate
inside a broader one, by supplying a mapping function:

```ts
interface DbConfig { host: string }
interface LoggerConfig { level: string }
interface AppEnv { db: DbConfig; log: LoggerConfig }

// This Reader only knows about DbConfig
const dbConnectionString: Reader<DbConfig, string> = Reader.asks(
  (db) => `postgres://${db.host}:5432/db`,
);

// This Reader only knows about LoggerConfig
const activeLogLevel: Reader<LoggerConfig, string> = Reader.asks(
  (log) => `Log level: ${log.level}`,
);

// Lift both into the broader AppEnv
const systemDiagnostics: Reader<AppEnv, string> = pipe(
  dbConnectionString,
  Reader.local((env: AppEnv) => env.db),
  Reader.chain((connStr) =>
    pipe(
      activeLogLevel,
      Reader.local((env: AppEnv) => env.log),
      Reader.map((level) => `${connStr} | ${level}`),
    )
  ),
);
```

This represents an elegant, modular design pattern. Your individual domain helpers declare only the
narrow context they actually require. When composing the main application, you use `local` to map
the global environment into these modular slices.

---

## Combining Computations: ap

`ap` applies a function wrapped inside a Reader to a value wrapped inside a Reader. Both operations
receive the same environment:

```ts
const calculateTotal = (tax: number) => (price: number) => price + tax;

const productPrice: Reader<ApiConfig, number> = Reader.asks((c) => c.defaultPrice);
const productTax: Reader<ApiConfig, number> = Reader.asks((c) => c.defaultTax);

const total: Reader<ApiConfig, number> = pipe(
  Reader.resolve(calculateTotal),
  Reader.ap(productTax),
  Reader.ap(productPrice),
);
```

---

## Peeking into pipelines: tap

To perform a side effect — such as logging a value or executing an assertion — mid-pipeline without
altering the flow, you can use `tap`:

```ts
pipe(
  buildEndpoint("/users"),
  Reader.tap((url) => console.log(`Configured request target: ${url}`)),
  Reader.run(configInstance),
);
```

---

## Injecting the environment at the edge: run

To execute a Reader, we pass it the environment context using `Reader.run`. This is the data-last
equivalent of invoking the function directly:

```ts
// These two invocations are equivalent:
pipe(buildEndpoint("/users"), Reader.run(apiConfig));
buildEndpoint("/users")(apiConfig);
```

`Reader.run` is typically called once, at the outer boundary of your application where your startup
dependencies and environment variables are resolved.

---

## Accumulating values: bind / bindTo

When you need to perform multiple sequential operations reading from the same environment and
accumulate their results into a single object, traditional pipelines can become deeply nested
because each successive function needs access to previous results:

```ts
const userProfile = pipe(
  getUser(userId),
  Reader.chain((user) =>
    pipe(
      getPreferences(user.id),
      Reader.map((prefs) => ({ user, prefs }))
    )
  ),
  Reader.chain(({ user, prefs }) =>
    pipe(
      getTheme(prefs.themeId),
      Reader.map((theme) => ({ user, prefs, theme }))
    )
  )
);
```

To solve this, you can use `bindTo` and `bind` to cleanly accumulate environment-derived values
key-by-key in a flat, readable pipeline.

`bindTo` lifts a value into the pipeline's accumulator object:

```ts
pipe(
  Reader.resolve(42),
  Reader.bindTo("value")
); // Reader({ value: 42 })
```

`bind` runs a new operation using the accumulated object and attaches the result to a new key:

```ts
const userProfile = pipe(
  getUser(userId),
  Reader.bindTo("user"),
  Reader.bind("prefs", ({ user }) => getPreferences(user.id)),
  Reader.bind("theme", ({ prefs }) => getTheme(prefs.themeId))
); // Reader({ user: User, prefs: Preferences, theme: Theme })
```

---

## When to use Reader

### Use Reader when:

- **You suffer from parameter drilling**: Multiple nested functions require access to the same
  context configuration, and you want to clean up their type signatures.
- **You want clean dependency injection**: You are building modular components with narrow
  environment dependencies and want to compose them using `local`.
- **You run different environments**: You need to run the same business pipeline against production
  configs, local mocks, or test environments.

### Keep passing arguments directly when:

- **The dependency is localized**: Only one or two functions need the value, and the drilling
  overhead is negligible.
- **The value is dynamic**: The value changes frequently between calls (if a value alters during
  execution, it belongs in the function argument channel, not the environment context).
