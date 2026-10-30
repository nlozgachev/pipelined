---
title: Arr — Array Utilities
description: Work with collections linearly, replacing data-first array method chains and unsafe undefined values with pipeline-ready, type-safe array helpers.
---

<!-- BUNDLE_SIZE:START -->

> 5.94 kB minified + gzipped

<!-- BUNDLE_SIZE:END -->

JavaScript arrays feature a rich built-in set of methods, yet building structured data pipelines
with native array operations exposes two major sources of bugs and boilerplate:

1. **Prototype methods are data-first**: Because `.map()`, `.filter()`, and `.slice()` live on the
   array instance, combining them with standalone functions inside a pipeline requires wrapping
   every step in an inline arrow function such as `(items) => items.map(transform)`.
2. **Lookups and bounds accesses are unsafe**: Indexing an array directly (`items[0]`) or calling
   `.find()` silently produces `undefined` when an array is empty or a search misses. TypeScript's
   default array indexing does not force you to handle that missing case before accessing properties
   on the result.

```ts
// Native array access can crash at runtime when activeUsers is empty:
const leadEmail = activeUsers[0].email.toLowerCase();
```

`Arr` addresses both problems by providing pure, curried, **data-last** functions over immutable
`readonly A[]` collections. Every operation that can fail to find an element returns an explicit
`Maybe<A>` container, and every transformation returns a new array without mutating the input.

---

## Safe Access: Bypassing Undefined

Accessing array boundaries directly in JavaScript can crash your program or introduce silent,
propagating `undefined` values. `Arr` provides explicit boundary accessors that return `Maybe`:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Maybe } from "@nlozgachev/pipelined/core";
import { Arr } from "@nlozgachev/pipelined/data";

Arr.head(["ord_101", "ord_102", "ord_103"]); // Some("ord_101")
Arr.head([]);                                // None

Arr.last(["ord_101", "ord_102", "ord_103"]); // Some("ord_103")
Arr.last([]);                                // None

Arr.tail(["ord_101", "ord_102", "ord_103"]); // Some(["ord_102", "ord_103"]) (all except first)
Arr.init(["ord_101", "ord_102", "ord_103"]); // Some(["ord_101", "ord_102"]) (all except last)
```

Because these functions return standard `Maybe` values, you can chain transformations and fallback
defaults linearly without writing defensive `if (items.length > 0)` guards:

```ts
const leadUserName = pipe(
  activeUsers,
  Arr.head,
  Maybe.map((user) => user.displayName),
  Maybe.getOrElse(() => "No active users found"),
);
```

To check array length or emptiness inside a pipeline, `Arr.size`, `Arr.is.empty`, and
`Arr.is.nonEmpty` inspect the collection directly. Furthermore, `Arr.is.nonEmpty` acts as a
TypeScript type guard that narrows `readonly A[]` to `Arr.NonEmpty<A>`:

```ts
const pendingOrders: readonly string[] = ["ord_101", "ord_102"];

Arr.size(pendingOrders);        // 2
Arr.is.empty(pendingOrders);    // false
Arr.is.nonEmpty(pendingOrders); // true (narrows to Arr.NonEmpty<string>)
```

---

## Searching and Predicates

When searching for elements or indices, `Arr.findFirst`, `Arr.findLast`, `Arr.findIndex`, and
`Arr.at` return `Maybe` rather than `-1` or `undefined`. `Arr.at` also supports negative indices to
count backward from the end of the array:

```ts
const latencies = [45, 120, 250, 80];

pipe(latencies, Arr.findFirst((ms) => ms > 100));  // Some(120)
pipe(latencies, Arr.findLast((ms) => ms > 100));   // Some(250)
pipe(latencies, Arr.findIndex((ms) => ms > 100));  // Some(1)
pipe(latencies, Arr.findFirst((ms) => ms > 1000)); // None

// Safe index lookup supporting negative offsets counting back from the end:
pipe(latencies, Arr.at(1));  // Some(120)
pipe(latencies, Arr.at(-1)); // Some(80)
pipe(latencies, Arr.at(10)); // None
```

When you need to search an array and transform the matching element at the same time, `Arr.findMap`
evaluates a `Maybe`-returning callback on each element and stops as soon as it receives the first
`Some`:

```ts
const parseDiscountCode = (raw: string): Maybe<number> =>
  raw.startsWith("PROMO_") ? Maybe.make.some(Number(raw.slice(6))) : Maybe.make.none();

pipe(
  ["WELCOME", "PROMO_15", "PROMO_25"],
  Arr.findMap(parseDiscountCode),
); // Some(15)
```

To test whether any or all elements in a collection satisfy a condition, `Arr.some` and `Arr.every`
provide curried boolean predicates that short-circuit as soon as the outcome is decided:

```ts
const cartPrices = [25, 40, 110];

pipe(cartPrices, Arr.some((price) => price >= 100)); // true
pipe(cartPrices, Arr.every((price) => price > 0));   // true
```

---

## Transformations, Filtering, and Unwrapping

Standard array transformations are curried and data-last. Use `Arr.map` to transform values,
`Arr.mapWithIndex` when your callback also needs the zero-based element index, `Arr.filter` to keep
matching elements, and `Arr.reverse` to produce a reversed copy without mutating the source array:

```ts
pipe([10, 20, 30], Arr.map((price) => price * 2)); // [20, 40, 60]

pipe(
  ["Bronze", "Silver", "Gold"],
  Arr.mapWithIndex((index, tier) => `${index + 1}. ${tier}`),
); // ["1. Bronze", "2. Silver", "3. Gold"]

pipe([15, 42, 8, 99], Arr.filter((score) => score >= 20)); // [42, 99]
pipe(["first", "second", "third"], Arr.reverse);           // ["third", "second", "first"]
```

For nested arrays, `Arr.flatMap` maps each element to an array and flattens the result by one level,
while `Arr.flatten` flattens an existing two-dimensional array:

```ts
pipe(
  [{ sku: "A1", tags: ["sale", "new"] }, { sku: "B2", tags: ["clearance"] }],
  Arr.flatMap((item) => item.tags),
); // ["sale", "new", "clearance"]

Arr.flatten([["us-east", "us-west"], ["eu-central"]]);
// ["us-east", "us-west", "eu-central"]
```

### Single-pass mapping and filtering with `filterMap` and `compact`

Mapping over a collection and discarding invalid items with native array methods requires multiple
iterations (`items.map(parse).filter(Boolean)`). `Arr.filterMap` combines mapping and filtering into
a single pass, keeping only the unwrapped `Some` values and discarding `None` results:

```ts
const parsePrice = (raw: string): Maybe<number> => {
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? Maybe.make.none() : Maybe.make.some(parsed);
};

const validPrices = pipe(
  ["19.99", "N/A", "45.00", "TBD", "9.50"],
  Arr.filterMap(parsePrice),
); // [19.99, 45, 9.5]
```

If you already have an array of `Maybe<A>` containers, `Arr.compact` unwraps all `Some` values and
removes all `None` entries in one step:

```ts
const resolvedEmails = Arr.compact([
  Maybe.make.some("alice@example.com"),
  Maybe.make.none(),
  Maybe.make.some("bob@example.com"),
]); // ["alice@example.com", "bob@example.com"]
```

---

## Partitioning and Grouping

When you need to keep both passing and failing items rather than discarding failures, `Arr` provides
four specialized partitioning tools:

`Arr.partition` splits an array using a boolean predicate (or TypeScript type guard) into a tuple of
`[passing, failing]` arrays. `Arr.partitionMaybe` applies a `Maybe`-returning parser and separates
the unparseable raw inputs from the parsed values into `[failures, successes]`:

```ts
// Split numbers into [passing, failing]:
const [highPriority, standardPriority] = pipe(
  [101, 45, 230, 12],
  Arr.partition((score) => score >= 100),
); // highPriority: [101, 230], standardPriority: [45, 12]

// Separate unparseable raw strings from valid parsed numbers:
const [rejectedInputs, parsedPrices] = pipe(
  ["19.99", "N/A", "45.00", "TBD"],
  Arr.partitionMaybe(parsePrice),
); // rejectedInputs: ["N/A", "TBD"], parsedPrices: [19.99, 45]
```

When your validation logic returns a `Result<E, B>` with a specific error message for each rejected
item, `Arr.partitionMap` maps each item and collects `[errors, successes]`. If you already hold an
array of `Result<E, A>` values, `Arr.separate` splits them directly into `[errors, successes]`:

```ts
import { Result } from "@nlozgachev/pipelined/core";

const validateQuantity = (qty: number): Result<string, number> =>
  qty > 0 ? Result.make.ok(qty) : Result.make.err(`Invalid quantity: ${qty}`);

const [quantityErrors, validQuantities] = pipe(
  [5, -1, 12, 0],
  Arr.partitionMap(validateQuantity),
);
// quantityErrors: ["Invalid quantity: -1", "Invalid quantity: 0"]
// validQuantities: [5, 12]

const [batchErrors, batchSuccesses] = Arr.separate([
  Result.make.ok("ord_1"),
  Result.make.err("Out of stock"),
  Result.make.ok("ord_2"),
]);
// batchErrors: ["Out of stock"], batchSuccesses: ["ord_1", "ord_2"]
```

To bucket items into a dictionary of non-empty arrays by a computed string key, use `Arr.groupBy`:

```ts
const tickets = [
  { id: "T-1", status: "open" },
  { id: "T-2", status: "closed" },
  { id: "T-3", status: "open" },
];

const ticketsByStatus = pipe(
  tickets,
  Arr.groupBy((ticket) => ticket.status),
);
// {
//   open: [{ id: "T-1", status: "open" }, { id: "T-3", status: "open" }],
//   closed: [{ id: "T-2", status: "closed" }]
// }
```

---

## Deduplication and Sorting

`Arr` offers three deduplication strategies depending on how equality is defined in your domain:

`Arr.uniq` removes duplicates across the array using strict equality. `Arr.uniqBy` deduplicates
objects by comparing a projected key such as an ID or email address. `Arr.uniqWith` accepts a custom
`Equality<A>` function for deep or composite comparisons. In all cases, the order of first
occurrence is preserved:

```ts
import { Equality } from "@nlozgachev/pipelined/core";

const uniqueTags = Arr.uniq(["urgent", "billing", "urgent", "support"]);
// ["urgent", "billing", "support"]

const uniqueUsers = pipe(
  [
    { id: "u1", name: "Alice" },
    { id: "u1", name: "Alice (Duplicate)" },
    { id: "u2", name: "Bob" },
  ],
  Arr.uniqBy((user) => user.id),
); // [{ id: "u1", name: "Alice" }, { id: "u2", name: "Bob" }]

type Coordinate = { readonly lat: number; readonly lng: number };
const sameLocation: Equality<Coordinate> = (a, b) => a.lat === b.lat && a.lng === b.lng;

const waypoints = pipe(
  [{ lat: 37.77, lng: -122.41 }, { lat: 34.05, lng: -118.24 }, { lat: 37.77, lng: -122.41 }],
  Arr.uniqWith(sameLocation),
); // [{ lat: 37.77, lng: -122.41 }, { lat: 34.05, lng: -118.24 }]
```

When working with time-series streams where you only want to collapse consecutive duplicate readings
while keeping later repetitions, use `Arr.dedupeAdjacent`:

```ts
const statusStream = ["idle", "idle", "running", "running", "idle"];
const transitions = pipe(statusStream, Arr.dedupeAdjacent());
// ["idle", "running", "idle"]
```

For immutable sorting, `Arr.sortBy` accepts a standard comparator function `(a, b) => number`, while
`Arr.sortWith` integrates directly with composable `Ordering<A>` instances from
`@nlozgachev/pipelined/core`:

```ts
import { Ordering } from "@nlozgachev/pipelined/core";

const sortedScores = pipe([88, 42, 95], Arr.sortBy((a, b) => a - b));
// [42, 88, 95]

type Product = { readonly name: string; readonly price: number };
const byPriceAsc = pipe(Ordering.number, Ordering.by((p: Product) => p.price));

const catalog: readonly Product[] = [
  { name: "Keyboard", price: 120 },
  { name: "Mouse", price: 60 },
];
const sortedCatalog = pipe(catalog, Arr.sortWith(byPriceAsc));
// [{ name: "Mouse", price: 60 }, { name: "Keyboard", price: 120 }]
```

---

## Slicing and Immutable Modifications

To extract prefixes or suffixes of an array, `Arr.take` and `Arr.drop` slice by element count, while
`Arr.takeWhile` and `Arr.dropWhile` slice while a condition holds. `Arr.splitAt` divides an array at
a target index into a `[before, after]` tuple in a single call:

```ts
const queue = ["job_1", "job_2", "job_3", "job_4"];

pipe(queue, Arr.take(2));    // ["job_1", "job_2"]
pipe(queue, Arr.drop(2));    // ["job_3", "job_4"]
pipe(queue, Arr.splitAt(2)); // [["job_1", "job_2"], ["job_3", "job_4"]]

const readings = [12, 18, 55, 14];
pipe(readings, Arr.takeWhile((n) => n < 50)); // [12, 18]
pipe(readings, Arr.dropWhile((n) => n < 50)); // [55, 14]
```

To add or remove elements at specific positions without mutating the array in place, `Arr.insertAt`
and `Arr.removeAt` return fresh copies. `Arr.prepend` and `Arr.append` add an element to the start
or end of an array and statically narrow the return type to `Arr.NonEmpty<A>`:

```ts
pipe(["step_1", "step_3"], Arr.insertAt(1, "step_2")); // ["step_1", "step_2", "step_3"]
pipe(["step_1", "step_2", "step_3"], Arr.removeAt(1)); // ["step_1", "step_3"]

const withHeader = pipe(["row_1", "row_2"], Arr.prepend("id,name"));
// Arr.NonEmpty<string>: ["id,name", "row_1", "row_2"]

const withFooter = pipe(["row_1", "row_2"], Arr.append("end_of_file"));
// Arr.NonEmpty<string>: ["row_1", "row_2", "end_of_file"]
```

---

## Combinations, Folds, and Scans

When combining two arrays element-by-element, `Arr.zip` pairs items into `[A, B]` tuples up to the
length of the shorter array, and `Arr.zipWith` combines each pair using a custom function.
`Arr.concat` appends one array onto another, and `Arr.intersperse` places a separator element
between every item:

```ts
const columns = ["id", "email"];
const rowValues = ["usr_1", "alice@example.com"];

pipe(columns, Arr.zip(rowValues));
// [["id", "usr_1"], ["email", "alice@example.com"]]

pipe(columns, Arr.zipWith((col: string, val: string) => `${col}=${val}`)(rowValues));
// ["id=usr_1", "email=alice@example.com"]

pipe(["home", "settings", "profile"], Arr.intersperse("/"));
// ["home", "/", "settings", "/", "profile"]

pipe(["us-east"], Arr.concat(["eu-west", "ap-south"]));
// ["us-east", "eu-west", "ap-south"]
```

To fold an array into a single summary value, use `Arr.reduce`. When you need to keep every
intermediate accumulator state — such as computing a running account balance across a ledger of
transactions — use `Arr.scan`:

```ts
const transactions = [100, -30, 50, -20];

const finalBalance = pipe(
  transactions,
  Arr.reduce(0, (balance, amount) => balance + amount),
); // 100

const runningBalances = pipe(
  transactions,
  Arr.scan(0, (balance, amount) => balance + amount),
); // [100, 70, 120, 100]
```

---

## Chunking, Windowing, and Indexing

When batching API requests or paginating datasets, `Arr.chunksOf` divides an array into fixed-size
batches. When you instead want to group consecutive elements that share a computed property — such
as adjacent log entries from the same service — use `Arr.chunkBy`:

```ts
// Fixed-size batches of 2:
pipe(["id_1", "id_2", "id_3", "id_4", "id_5"], Arr.chunksOf(2));
// [["id_1", "id_2"], ["id_3", "id_4"], ["id_5"]]

// Group consecutive elements sharing the same key:
pipe(
  ["auth", "auth", "billing", "billing", "auth"],
  Arr.chunkBy((service) => service),
); // [["auth", "auth"], ["billing", "billing"], ["auth"]]
```

For moving averages or trend detection, `Arr.windowed` produces overlapping sliding windows of a
given size, advancing by `step` (which defaults to `1`):

```ts
const dailyRevenue = [100, 150, 200, 250];

pipe(dailyRevenue, Arr.windowed(2));              // [[100, 150], [150, 200], [200, 250]]
pipe(dailyRevenue, Arr.windowed(2, { step: 2 })); // [[100, 150], [200, 250]]
```

To build fast lookup maps from an array, `Arr.indexBy` indexes elements into a `ReadonlyMap<K, A>`
using a key selector, and `Arr.frequencies` counts how many times each distinct element appears:

```ts
type Product = { readonly id: string; readonly category: string };
const catalog: readonly Product[] = [
  { id: "p1", category: "books" },
  { id: "p2", category: "electronics" },
];

const catalogById = pipe(catalog, Arr.indexBy((product) => product.id));
// ReadonlyMap { "p1" => { id: "p1", category: "books" }, "p2" => { id: "p2", category: "electronics" } }

const statusCounts = Arr.frequencies(["200", "500", "200", "404", "200"]);
// ReadonlyMap { "200" => 3, "500" => 1, "404" => 1 }
```

---

## Sequence Generation: unfold

When generating an array from an initial seed state until a termination condition is reached — such
as building pagination offsets or time intervals — `Arr.unfold` repeatedly invokes your step
function as long as it returns `Some([nextItem, nextState])`:

```ts
// Generate pagination offsets for 100 items with a page size of 25:
const pageOffsets = Arr.unfold(0, (offset) =>
  offset < 100 ? Maybe.make.some([offset, offset + 25]) : Maybe.make.none(),
); // [0, 25, 50, 75]
```

---

## Traversal across Contexts: traverse and sequence

Mapping an array with a function that returns a `Maybe`, `Result`, `Validation`, or `Task` produces
an array of containers such as `readonly Result<E, A>[]`. In practice, you almost always want the
inverted structure — a single container holding the collected array (`Result<E, readonly A[]>`).

`Arr.traverse` maps and flips the container in a single operation, while `Arr.sequence` flips an
existing array of containers.

### Optional traversal (`Maybe`)

`Arr.traverse.Maybe` maps each element to a `Maybe` and returns `Some` of all results only if every
element succeeded, short-circuiting to `None` on the first missing value:

```ts
pipe(["10", "20", "30"], Arr.traverse.Maybe(parsePrice));    // Some([10, 20, 30])
pipe(["10", "N/A", "30"], Arr.traverse.Maybe(parsePrice));   // None

Arr.sequence.Maybe([Maybe.make.some(10), Maybe.make.some(20)]); // Some([10, 20])
Arr.sequence.Maybe([Maybe.make.some(10), Maybe.make.none()]);   // None
```

### Short-circuiting error traversal (`Result`)

`Arr.traverse.Result` and `Arr.sequence.Result` collect `Ok` values and short-circuit on the first
`Err` encountered:

```ts
const validatePort = (port: number): Result<string, number> =>
  port >= 1024 && port <= 65535
    ? Result.make.ok(port)
    : Result.make.err(`Invalid port: ${port}`);

pipe([8080, 3000, 5432], Arr.traverse.Result(validatePort)); // Ok([8080, 3000, 5432])
pipe([8080, 80, 5432], Arr.traverse.Result(validatePort));   // Err("Invalid port: 80")

Arr.sequence.Result([Result.make.ok(8080), Result.make.ok(3000)]);        // Ok([8080, 3000])
Arr.sequence.Result([Result.make.ok(8080), Result.make.err("Port busy")]); // Err("Port busy")
```

### Error-accumulating traversal (`Validation`)

When validating forms or batch imports where you want to report *every* failure at once rather than
stopping at the first error, use `Arr.traverse.Validation` and `Arr.sequence.Validation`:

```ts
import { Validation } from "@nlozgachev/pipelined/core";

const checkPositive = (amount: number): Validation<string, number> =>
  amount > 0
    ? Validation.make.passed(amount)
    : Validation.make.failed(`Amount must be positive: ${amount}`);

pipe([10, -5, -20], Arr.traverse.Validation(checkPositive));
// Failed(["Amount must be positive: -5", "Amount must be positive: -20"])

Arr.sequence.Validation([
  Validation.make.passed(10),
  Validation.make.failed("Missing SKU"),
]); // Failed(["Missing SKU"])
```

### Asynchronous traversal (`Task`)

`Arr.traverse.Task` and `Arr.sequence.Task` execute asynchronous `Task` computations and collect
their resolved values into `Task<readonly B[]>`. By default, tasks run in parallel; you can pass
`{ concurrency }` to `Arr.traverse.Task` to cap the number of in-flight workers:

```ts
import { Task } from "@nlozgachev/pipelined/core";

const computeHash = (input: string): Task<string> =>
  Task.make(`hash_${input}`);

// Run at most 2 tasks concurrently:
const batchHashes = pipe(
  ["doc_1", "doc_2", "doc_3"],
  Arr.traverse.Task(computeHash, { concurrency: 2 }),
);

// Sequence an existing array of Tasks in parallel:
const allHashes = Arr.sequence.Task([computeHash("doc_1"), computeHash("doc_2")]);
```

---

## Non-Empty Arrays: `Arr.NonEmpty`

When your domain requires an array with at least one element — such as a list of validation errors
or line items in a confirmed order — `Arr.NonEmpty<A>` (aliased to `readonly [A, ...A[]]`) encodes
that guarantee at compile time.

Constructing an array with `Arr.prepend`, `Arr.append`, or `Arr.NonEmpty.singleton` produces an
`Arr.NonEmpty<A>` directly. For arbitrary runtime arrays, `Arr.is.nonEmpty` narrows the type in
conditionals, and `Arr.NonEmpty.from.array` lifts the array into `Maybe<Arr.NonEmpty<A>>`:

```ts
const singleItem = Arr.NonEmpty.singleton("ord_101"); // Arr.NonEmpty<string>
const refined = Arr.NonEmpty.from.array(["ord_101", "ord_102"]); // Some(Arr.NonEmpty<string>)
const emptyAttempt = Arr.NonEmpty.from.array<string>([]);        // None
```

While top-level `Arr.map` and `Arr.reverse` return general `readonly B[]` arrays, the `Arr.NonEmpty`
namespace provides dedicated transformations that preserve the `Arr.NonEmpty` guarantee across
pipeline steps, as well as direct `head`, `last`, and seedless `reduce` operations that never need
to wrap their result in `Maybe`:

```ts
const lineItems: Arr.NonEmpty<number> = [100, 250, 50];

// Direct extraction without Maybe:
const firstItem: number = Arr.NonEmpty.head(lineItems); // 100
const lastItem: number = Arr.NonEmpty.last(lineItems);  // 50
const remaining: readonly number[] = Arr.NonEmpty.tail(lineItems); // [250, 50]

// Seedless reduction using the first element as the initial accumulator:
const orderSubtotal: number = pipe(
  lineItems,
  Arr.NonEmpty.reduce((sum, price) => sum + price),
); // 400

// Transformations that preserve the Arr.NonEmpty<B> return type:
const withTax: Arr.NonEmpty<number> = pipe(
  lineItems,
  Arr.NonEmpty.map((price) => price * 1.1),
);

const numberedItems: Arr.NonEmpty<string> = pipe(
  lineItems,
  Arr.NonEmpty.mapWithIndex((idx, price) => `#${idx + 1}: ${price}`),
);

const separated: Arr.NonEmpty<number> = pipe(lineItems, Arr.NonEmpty.intersperse(0));
const combined: Arr.NonEmpty<number> = pipe(lineItems, Arr.NonEmpty.concat([75, 125]));
const reversed: Arr.NonEmpty<number> = Arr.NonEmpty.reverse(lineItems);
```

For more details on non-empty data modeling across collections, see the
[Non-Empty Collections Guide](../nonempty).

---

## Pipeline Composition

Here is an end-to-end checkout reconciliation pipeline that cleans raw order amounts, filters out
unparseable entries, deduplicates records, sorts from highest to lowest value, and extracts the top
three orders for priority fulfillment:

```ts
import { pipe } from "@nlozgachev/pipelined/composition";
import { Maybe, Ordering } from "@nlozgachev/pipelined/core";
import { Arr } from "@nlozgachev/pipelined/data";

type RawOrder = { readonly id: string; readonly amountText: string };
type ValidOrder = { readonly id: string; readonly amount: number };

const parseOrder = (raw: RawOrder): Maybe<ValidOrder> => {
  const amount = Number(raw.amountText);
  return Number.isFinite(amount) && amount > 0
    ? Maybe.make.some({ id: raw.id, amount })
    : Maybe.make.none();
};

const byAmountDesc = pipe(
  Ordering.number,
  Ordering.reverse,
  Ordering.by((order: ValidOrder) => order.amount),
);

const rawOrders: readonly RawOrder[] = [
  { id: "ord_1", amountText: "120.50" },
  { id: "ord_2", amountText: "N/A" },
  { id: "ord_1", amountText: "120.50" },
  { id: "ord_3", amountText: "450.00" },
  { id: "ord_4", amountText: "85.00" },
  { id: "ord_5", amountText: "310.00" },
];

const priorityOrders = pipe(
  rawOrders,
  Arr.filterMap(parseOrder),
  Arr.uniqBy((order) => order.id),
  Arr.sortWith(byAmountDesc),
  Arr.take(3),
);
// [
//   { id: "ord_3", amount: 450 },
//   { id: "ord_5", amount: 310 },
//   { id: "ord_1", amount: 120.5 }
// ]
```

---

## Problems it solves

- **Pipeline transformation without callback wrappers**: In API response formatters and event
  processors, transforming arrays with native methods requires verbose arrow wrapper functions
  inside `pipe` chains. `Arr` provides data-last combinators (`Arr.map`, `Arr.filterMap`,
  `Arr.chunksOf`, `Arr.chunkBy`, `Arr.groupBy`) that compose cleanly into linear pipelines.
- **Safe element extraction and out-of-bounds protection (`Arr.head`, `Arr.last`, `Arr.at`)**:
  Native indexing (`arr[i]`) returns `undefined` at runtime without static safety. `Arr.head`,
  `Arr.last`, and `Arr.at` return `Maybe<A>`, supporting negative offsets and guaranteeing
  out-of-bounds checks before accessing properties.
- **Batch chunking and sliding windows (`Arr.chunksOf`, `Arr.chunkBy`, `Arr.windowed`)**: When
  submitting bulk inserts to rate-limited APIs, grouping consecutive identical states, or computing
  moving averages across time-series metrics, `Arr.chunksOf`, `Arr.chunkBy`, and `Arr.windowed`
  partition collections without custom chunking algorithms.
- **Categorization and dual-partitioning (`Arr.groupBy`, `Arr.partition`, `Arr.partitionMaybe`,
  `Arr.partitionMap`, `Arr.separate`, `Arr.frequencies`)**: In UI dashboards and reporting tools,
  collections can be split by boolean criteria (`Arr.partition`), segregated by optional or fallible
  parsers (`Arr.partitionMaybe`, `Arr.partitionMap`), organized into non-empty buckets
  (`Arr.groupBy`), or counted into frequency maps (`Arr.frequencies`).
- **Simultaneous mapping and filtering (`Arr.filterMap`, `Arr.findMap`, `Arr.compact`)**: Extracting
  valid data from dirty datasets (such as parsing strings to numbers and discarding unparseable
  rows) typically requires separate `.map()` and `.filter()` passes. `Arr.filterMap` and
  `Arr.findMap` execute transformation and filtering in a single pass.
- **Sequence generation from seeds (`Arr.unfold`)**: Constructing lists from iterative algorithms or
  paginated cursor workflows without imperative `while` loops or mutable array allocations.
- **Traversing collections of fallible or asynchronous steps (`Arr.traverse`, `Arr.sequence`)**:
  When running batch operations (such as validating an array of input records or executing tasks for
  a list of IDs), standard mapping produces collections of containers like `Array<Result<E, A>>` or
  `Array<Task<A>>`. `Arr.traverse` and `Arr.sequence` invert the collection into a single container
  (`Result<E, readonly A[]>`, `Validation<E, readonly A[]>`, or `Task<readonly A[]>`), handling
  short-circuiting, error accumulation, or bounded concurrency automatically.
