---
title: Optional — Nullable Paths
description: Focus on a property or index that may be absent to read, set, and modify nested nullable paths safely.
---

Reading deep nested structures that might be missing is a problem standard TypeScript solves
elegantly. The optional chaining operator (`?.`) allows us to navigate through potentially absent
objects without throwing runtime errors.

However, a significant gap appears when we need to update these structures. While optional chaining
allows safe reads, there is no corresponding operator for writes. There is no `?.=` operator in
JavaScript. When we want to update a value at the end of a nullable path, we are forced to write
verbose, conditional branching code filled with intermediate checks and nested object spreads.

`Optional` closes this gap. It represents a two-way path through a structure where elements along
the way may or may not exist. Reads through an optional return a `Maybe` context, while writes and
modifications automatically apply if the path is complete, and act as a safe, silent no-op if any
part of the path is missing.

## The problem with updating optional paths

Consider a system that tracks a user's notification preferences, where both the preferences
sub-object and individual notification channels are completely optional:

```ts
type UserSettings = {
  username: string;
  notifications?: {
    email?: boolean;
    slack?: {
      webhookUrl?: string;
      enabled?: boolean;
    };
  };
};

const settings: UserSettings = {
  username: "alice",
  notifications: {
    email: true,
  },
};
```

If we want to enable the Slack channel, we cannot simply write:

```ts
// Syntax Error: Optional chaining cannot be used on the left-hand side of an assignment
settings.notifications?.slack?.enabled = true;
```

To update this safely and immutably using standard JavaScript, we must manually guard each nullable
level to determine whether we need to create it or skip the update:

```ts
const updatedSettings = {
  ...settings,
  notifications: settings.notifications
    ? {
        ...settings.notifications,
        slack: settings.notifications.slack
          ? {
              ...settings.notifications.slack,
              enabled: true,
            }
          : undefined, // Or create a default Slack object
      }
    : undefined,
};
```

This code is incredibly difficult to read, write, and maintain. It forces the developer to manually
manage the control flow of absence, mixing business logic with defensive null-checking.

## The shift to nullable paths

An `Optional<S, A>` models a traversal that might fail to reach its destination.

- Reading through an optional yields `Maybe<A>` (returning `Some` if the path is valid and holds a
  value, or `None` if any segment is absent).
- Overwriting or modifying through an optional returns a new structure with the update applied if
  the path exists, or the original structure unchanged if the path is broken.

```mermaid
flowchart TD
    S["Outer Structure (S)"] -- "get" --> M["Maybe<A>"]
    S -- "modify(fn)" --> S2["New Structure (S)"]
    S2 -- "If path exists" --> S3["Updated Structure"]
    S2 -- "If path broken" --> S["Original Structure (Unchanged)"]
```

## Creating optional paths

We can target optional object properties using `Optional.from.property`, and array elements by index
using `Optional.index`:

```ts
import { Optional } from "@nlozgachev/pipelined/core";

// Focus on an optional field within an object
const notificationsOptional = Optional.from.property<UserSettings>()("notifications");

// Focus on a specific element of an array by index
const firstItemOptional = Optional.index<string>(0); // Optional<string[], string>
```

If we need a custom optional path — such as parsing a string value that might be empty or invalid —
we can define it manually with `Optional.from.accessors`:

```ts
import { Maybe } from "@nlozgachev/pipelined/core";

const firstCharOptional = Optional.from.accessors(
  (str: string) => str.length > 0 ? Maybe.make.some(str[0]) : Maybe.make.none(),
  (char) => (str) => str.length > 0 ? char + str.slice(1) : str
);
```

## Reading values safely

When reading a value through an `Optional`, we receive a `Maybe` context. We then use standard
functional helpers to extract or fold the value:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";

const slackOptional = Optional.from.property<UserSettings["notifications"]>()("slack");

// Extract the Slack settings as a Maybe context
const slackSettings = pipe(settings.notifications, Optional.get(slackOptional));
// Returns: None (since 'slack' is undefined in our settings)

// Fold the result with a fallback value using positional ordering (none handler first)
const hasWebhook = pipe(
  settings.notifications,
  Optional.fold(slackOptional)(
    () => false,                // Handle None
    (slack) => !!slack.webhookUrl // Handle Some
  )
);
```

## Modifying and writing through optionals

Writing or modifying a value through an `Optional` always returns a new object reference if the path
is resolved and a change occurs, preserving reference equality and returning the original object if
the path is broken:

```ts
const slackEnabledOptional = Optional.from.property<{ webhookUrl?: string; enabled?: boolean }>()("enabled");

// Safely modify a value if it exists, otherwise do nothing
const updatedNotifications = pipe(
  settings.notifications,
  Optional.modify(slackOptional)(
    slack => ({ ...slack, enabled: true })
  )
);
// Returns the original 'notifications' reference because 'slack' was undefined.
```

## Composing deep optional paths

Just like lenses, optionals compose. We can combine multiple optional paths using
`Optional.andThen`. If any step in the composition fails, the entire chain resolves to a safe no-op
or a `None` value:

```ts
const notifications = Optional.from.property<UserSettings>()("notifications");
const slack = Optional.from.property<Required<UserSettings>["notifications"]>()("slack");
const webhook = Optional.from.property<Required<Required<UserSettings>["notifications"]>["slack"]>()("webhookUrl");

// Compose a deep optional path
const slackWebhookOptional = pipe(
  notifications,
  Optional.andThen(slack),
  Optional.andThen(webhook)
);

// Read the deep webhook URL if it exists
const urlMaybe = pipe(settings, Optional.get(slackWebhookOptional)); // None

// Attempt to set a value deep inside the structure safely
const nextSettings = pipe(
  settings,
  Optional.set(slackWebhookOptional)("https://hooks.slack.com/services/...")
);
```

## Bridging Lenses and Optionals

It is very common for a path to start with fields that are guaranteed to exist, and then reach a
field that is optional. We can transition from a `Lens` to an `Optional` using `Lens.toOptional`, or
compose a lens directly using `Optional.andThenLens` or `Lens.andThenOptional`:

```ts
import { Lens } from "@nlozgachev/pipelined/core";

type Config = {
  server: {
    host: string;
    port: number;
    ssl?: {
      certPath: string;
    };
  };
};

const serverLens = Lens.from.property<Config>()("server");
const sslOptional = Optional.from.property<Config["server"]>()("ssl");

// Compose a guaranteed path with an optional path
const sslCertOptional = pipe(
  serverLens,
  Lens.toOptional,
  Optional.andThen(sslOptional)
);
```

## Problems it solves

- **Updating optional nested properties safely**: In user preference trees and optional
  configuration blocks (such as `user?.preferences?.notifications?.emailDigest`), modifying an
  optional leaf requires multiple existence checks to avoid modifying non-existent objects.
  `Optional` safely retrieves values as `Maybe` and immutably modifies target fields only when the
  path is present.
- **Conditional modifications without creating phantom fields (`Optional.modify`)**: Applying
  updates (such as trimming an optional nickname or incrementing an optional retry count) should
  only take place if the field already exists. `Optional.modify` applies functions to existing
  targets without creating unwanted default properties.
- **Modifying specific items in nested array state**: Updating an element at an index inside an
  array nested inside state (such as `cart.items[index].quantity`) requires cloning the array,
  checking bounds, and spreading parent objects. `Optional.index` allows direct, boundary-safe
  updates to indexed collection elements.
- **Composing guaranteed and optional paths**: Real-world domain models mix required structural
  wrappers with optional fields. `Optional` connects guaranteed paths (`Lens`) with optional leaves
  (`Optional`), providing a unified, type-safe pipeline for deep reads and writes.
