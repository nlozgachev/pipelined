import { NonEmptyList } from "#types/NonEmptyList.ts";

export type WithKind<K extends string> = { readonly kind: K; };

export type WithValue<T> = { readonly value: T; };

export type WithError<T> = { readonly error: T; };

export type WithErrors<T> = { readonly errors: NonEmptyList<T>; };

export type WithFirst<T> = { readonly first: T; };

export type WithSecond<T> = { readonly second: T; };

export type WithLog<T> = { readonly log: ReadonlyArray<T>; };

// ---------------------------------------------------------------------------
// Op option types — moved from Op namespace and shared across strategies
// ---------------------------------------------------------------------------

/** Retry policy for `Op.interpret`. */
export type RetryOptions<E> = {
	readonly attempts: number;
	readonly backoff?: number | ((attempt: number) => number);
	readonly when?: (error: E) => boolean;
};

/** Timeout policy for `Op.interpret`. Wraps the entire retry sequence. */
export type TimeoutOptions<E> = {
	readonly ms: number;
	readonly onTimeout: () => E;
};

// Cross-cutting option wrappers

export type WithRetry<E>   = { readonly retry: RetryOptions<E>; };
export type WithTimeout<E> = { readonly timeout?: TimeoutOptions<E>; };

// Throttled / debounced options

export type WithMs       = { readonly ms: number; };
/** For `throttled`: also fire on the trailing edge after the cooldown. */
export type WithTrailing = { readonly trailing: true; };
/** For `debounced`: also fire on the leading edge (first call). */
export type WithLeading  = { readonly leading: true; };
/** For `debounced`: maximum ms before the trailing call fires regardless of continued activity. */
export type WithMaxWait  = { readonly maxWait: number; };

// Concurrent options

export type WithN = { readonly n: number; };
/**
 * `O` is a string literal (or union of literals) representing the overflow value.
 * The generic lets overload signatures discriminate on the specific value:
 *   `WithOverflow<"drop">` → `{ overflow: "drop" }`
 *   `WithOverflow<"replace-last">` → `{ overflow: "replace-last" }`
 * Used by both `concurrent` (`"drop" | "queue"`) and `queue` (`"drop" | "replace-last"`).
 * `extends string` prevents `WithOverflow<42>` from being valid.
 */
export type WithOverflow<O extends string> = { readonly overflow: O; };

// Queue options

export type WithMaxSize    = { readonly maxSize: number; };
export type WithConcurrency = { readonly concurrency?: number; };
export type WithDedupe<I>  = { readonly dedupe: (a: I, b: I) => boolean; };

// Buffered options

export type WithSize = { readonly size?: number; };

// Exclusive options

export type WithCooldown = { readonly cooldown?: number; };

// Restartable options

export type WithMinInterval = { readonly minInterval?: number; };

// Keyed options (formalising existing inline fields)

export type WithKey<I, K>               = { readonly key: (input: I) => K; };
export type WithPerKey<S extends string> = { readonly perKey: S; };
