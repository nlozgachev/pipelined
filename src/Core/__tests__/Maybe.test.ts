import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../Maybe.ts";
import { Result } from "../Result.ts";

// ---------------------------------------------------------------------------
// of / some
// ---------------------------------------------------------------------------

test("Maybe.some wraps a value in Some", () => {
	const result = Maybe.some(42);
	expect(result).toEqual({ kind: "Some", value: 42 });
});

test("Maybe.some creates a Some with the given value", () => {
	const result = Maybe.some("hello");
	expect(result).toEqual({ kind: "Some", value: "hello" });
});

test("Maybe.some and Maybe.some produce the same result", () => {
	expect(Maybe.some(10)).toEqual(Maybe.some(10));
});

// ---------------------------------------------------------------------------
// isSome
// ---------------------------------------------------------------------------

test("Maybe.isSome returns true for Some", () => {
	expect(Maybe.isSome(Maybe.some(1))).toBe(true);
});

test("Maybe.isSome returns false for None", () => {
	expect(Maybe.isSome(Maybe.none())).toBe(false);
});

// ---------------------------------------------------------------------------
// none / isNone
// ---------------------------------------------------------------------------

test("Maybe.none creates a None", () => {
	expect(Maybe.none()).toEqual({ kind: "None" });
});

test("Maybe.isNone returns true for None", () => {
	expect(Maybe.isNone(Maybe.none())).toBe(true);
});

test("Maybe.isNone returns false for Some", () => {
	expect(Maybe.isNone(Maybe.some(1))).toBe(false);
});

// ---------------------------------------------------------------------------
// fromNullable
// ---------------------------------------------------------------------------

test("Maybe.fromNullable returns None for null", () => {
	expect(Maybe.fromNullable(null)).toEqual({ kind: "None" });
});

test("Maybe.fromNullable returns None for undefined", () => {
	expect(Maybe.fromNullable(undefined)).toEqual({ kind: "None" });
});

test("Maybe.fromNullable returns Some for 0", () => {
	expect(Maybe.fromNullable(0)).toEqual({ kind: "Some", value: 0 });
});

test("Maybe.fromNullable returns Some for false", () => {
	expect(Maybe.fromNullable(false)).toEqual({ kind: "Some", value: false });
});

test("Maybe.fromNullable returns Some for empty string", () => {
	expect(Maybe.fromNullable("")).toEqual({ kind: "Some", value: "" });
});

test("Maybe.fromNullable returns Some for NaN", () => {
	expect(Maybe.fromNullable(NaN)).toEqual({ kind: "Some", value: NaN });
});

test("Maybe.fromNullable returns Some for a regular value", () => {
	expect(Maybe.fromNullable(42)).toEqual({ kind: "Some", value: 42 });
});

test("Maybe.fromNullable returns Some for an object", () => {
	const obj = { a: 1 };
	const result = Maybe.fromNullable(obj);
	expect(result).toEqual({ kind: "Some", value: { a: 1 } });
});

// ---------------------------------------------------------------------------
// toNullable
// ---------------------------------------------------------------------------

test("Maybe.toNullable returns the value for Some", () => {
	expect(Maybe.toNullable(Maybe.some(42))).toBe(42);
});

test("Maybe.toNullable returns null for None", () => {
	expect(Maybe.toNullable(Maybe.none())).toBeNull();
});

// ---------------------------------------------------------------------------
// toUndefined
// ---------------------------------------------------------------------------

test("Maybe.toUndefined returns the value for Some", () => {
	expect(Maybe.toUndefined(Maybe.some(42))).toBe(42);
});

test("Maybe.toUndefined returns undefined for None", () => {
	expect(Maybe.toUndefined(Maybe.none())).toBeUndefined();
});

// ---------------------------------------------------------------------------
// fromUndefined
// ---------------------------------------------------------------------------

test("Maybe.fromUndefined returns None for undefined", () => {
	expect(Maybe.fromUndefined(undefined)).toEqual({ kind: "None" });
});

test(
	"Maybe.fromUndefined returns Some for null (null is not undefined)",
	() => {
		expect(Maybe.fromUndefined(null)).toEqual({ kind: "Some", value: null });
	},
);

test("Maybe.fromUndefined returns Some for a value", () => {
	expect(Maybe.fromUndefined(42)).toEqual({ kind: "Some", value: 42 });
});

// ---------------------------------------------------------------------------
// toResult
// ---------------------------------------------------------------------------

test("Maybe.toResult converts Some to Ok", () => {
	const result = pipe(
		Maybe.some(42),
		Maybe.toResult(() => "missing"),
	);
	expect(result).toEqual({ kind: "Ok", value: 42 });
});

test(
	"Maybe.toResult converts None to Err using the onNone callback",
	() => {
		const result = Maybe.toResult(() => "error")(Maybe.none());
		expect(result).toEqual({ kind: "Error", error: "error" });
	},
);

test(
	"Maybe.toResult lazily evaluates the error callback only on None",
	() => {
		let called = false;
		pipe(
			Maybe.some(10),
			Maybe.toResult(() => {
				called = true;
				return "error";
			}),
		);
		expect(called).toBe(false);
	},
);

// ---------------------------------------------------------------------------
// fromResult
// ---------------------------------------------------------------------------

test("Maybe.fromResult converts Ok to Some", () => {
	const result = Maybe.fromResult(Result.ok(42));
	expect(result).toEqual({ kind: "Some", value: 42 });
});

test("Maybe.fromResult converts Err to None", () => {
	const result = Maybe.fromResult(Result.err("x"));
	expect(result).toEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("Maybe.map transforms the value inside Some", () => {
	const result = pipe(
		Maybe.some(5),
		Maybe.map((n: number) => n * 2),
	);
	expect(result).toEqual({ kind: "Some", value: 10 });
});

test("Maybe.map passes through None unchanged", () => {
	const result = pipe(
		Maybe.none(),
		Maybe.map((n: number) => n * 2),
	);
	expect(result).toEqual({ kind: "None" });
});

test("Maybe.map can change the type", () => {
	const result = pipe(
		Maybe.some(5),
		Maybe.map((n: number) => String(n)),
	);
	expect(result).toEqual({ kind: "Some", value: "5" });
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("Maybe.chain applies function when Some", () => {
	const parseNumber = (s: string) => {
		const n = parseInt(s, 10);
		return isNaN(n) ? Maybe.none() : Maybe.some(n);
	};
	const result = pipe(Maybe.some("42"), Maybe.chain(parseNumber));
	expect(result).toEqual({ kind: "Some", value: 42 });
});

test("Maybe.chain returns None when function returns None", () => {
	const parseNumber = (s: string) => {
		const n = parseInt(s, 10);
		return isNaN(n) ? Maybe.none() : Maybe.some(n);
	};
	const result = pipe(Maybe.some("abc"), Maybe.chain(parseNumber));
	expect(result).toEqual({ kind: "None" });
});

test("Maybe.chain propagates None without calling function", () => {
	let called = false;
	pipe(
		Maybe.none(),
		Maybe.chain((_s: string) => {
			called = true;
			return Maybe.some(1);
		}),
	);
	expect(called).toBe(false);
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("Maybe.fold calls onSome for Some", () => {
	const result = pipe(
		Maybe.some(5),
		Maybe.fold(
			() => "none",
			(n: number) => `value: ${n}`,
		),
	);
	expect(result).toBe("value: 5");
});

test("Maybe.fold calls onNone for None", () => {
	const result = pipe(
		Maybe.none(),
		Maybe.fold(
			() => "none",
			(n: number) => `value: ${n}`,
		),
	);
	expect(result).toBe("none");
});

// ---------------------------------------------------------------------------
// match (data-last)
// ---------------------------------------------------------------------------

test("Maybe.match calls some handler for Some", () => {
	const result = pipe(
		Maybe.some(5),
		Maybe.match({
			some: (n: number) => `got ${n}`,
			none: () => "nothing",
		}),
	);
	expect(result).toBe("got 5");
});

test("Maybe.match calls none handler for None", () => {
	const result = pipe(
		Maybe.none(),
		Maybe.match({
			some: (n: number) => `got ${n}`,
			none: () => "nothing",
		}),
	);
	expect(result).toBe("nothing");
});

test("Maybe.match is data-last (returns a function first)", () => {
	const handler = Maybe.match({
		some: (n) => `val: ${n}`,
		none: () => "empty",
	});
	expect(handler(Maybe.some(3))).toBe("val: 3");
	expect(handler(Maybe.none())).toBe("empty");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("Maybe.getOrElse returns value for Some", () => {
	const result = pipe(Maybe.some(5), Maybe.getOrElse(() => 0));
	expect(result).toBe(5);
});

test("Maybe.getOrElse returns default for None", () => {
	const result = pipe(Maybe.none(), Maybe.getOrElse(() => 0));
	expect(result).toBe(0);
});

test("Maybe.getOrElse widens return type to A | B when default is a different type", () => {
	const result = pipe(Maybe.none(), Maybe.getOrElse(() => null));
	expect(result).toBeNull();
});

test("Maybe.getOrElse returns Some value typed as A | B when Some", () => {
	const result = pipe(Maybe.some("hello"), Maybe.getOrElse(() => null));
	expect(result).toBe("hello");
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test(
	"Maybe.tap executes side effect on Some and returns original",
	() => {
		let sideEffect = 0;
		const result = pipe(
			Maybe.some(5),
			Maybe.tap((n: number) => {
				sideEffect = n;
			}),
		);
		expect(sideEffect).toBe(5);
		expect(result).toEqual({ kind: "Some", value: 5 });
	},
);

test("Maybe.tap does not execute side effect on None", () => {
	let called = false;
	const result = pipe(
		Maybe.none(),
		Maybe.tap((_n: number) => {
			called = true;
		}),
	);
	expect(called).toBe(false);
	expect(result).toEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("Maybe.filter keeps Some when predicate is true", () => {
	const result = pipe(
		Maybe.some(5),
		Maybe.filter((n: number) => n > 3),
	);
	expect(result).toEqual({ kind: "Some", value: 5 });
});

test("Maybe.filter returns None when predicate is false", () => {
	const result = pipe(
		Maybe.some(2),
		Maybe.filter((n: number) => n > 3),
	);
	expect(result).toEqual({ kind: "None" });
});

test("Maybe.filter returns None when input is None", () => {
	const result = pipe(
		Maybe.none(),
		Maybe.filter((n: number) => n > 3),
	);
	expect(result).toEqual({ kind: "None" });
});

test("Maybe.filter on None returns the same None reference", () => {
	const none = Maybe.none();
	const result = pipe(none as Maybe<number>, Maybe.filter((n) => n > 3));
	expect(result).toBe(none);
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test(
	"Maybe.recover returns original Some without calling fallback",
	() => {
		let called = false;
		const result = pipe(
			Maybe.some(5),
			Maybe.recover(() => {
				called = true;
				return Maybe.some(99);
			}),
		);
		expect(called).toBe(false);
		expect(result).toEqual({ kind: "Some", value: 5 });
	},
);

test("Maybe.recover provides fallback for None", () => {
	const result = pipe(
		Maybe.none(),
		Maybe.recover(() => Maybe.some(99)),
	);
	expect(result).toEqual({ kind: "Some", value: 99 });
});

test("Maybe.recover can return None as fallback", () => {
	const result = pipe(
		Maybe.none(),
		Maybe.recover(() => Maybe.none()),
	);
	expect(result).toEqual({ kind: "None" });
});

test("Maybe.recover widens to Maybe<A | B> when fallback returns a different type", () => {
	const result = pipe(
		Maybe.none(),
		Maybe.recover(() => Maybe.some("fallback")),
	);
	expect(result).toEqual({ kind: "Some", value: "fallback" });
});

test("Maybe.recover preserves Some typed as Maybe<A | B>", () => {
	const result = pipe(
		Maybe.some(42),
		Maybe.recover(() => Maybe.some("fallback")),
	);
	expect(result).toEqual({ kind: "Some", value: 42 });
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

test("Maybe.ap applies Some function to Some value", () => {
	const add = (a: number) => (b: number) => a + b;
	const result = pipe(
		Maybe.some(add),
		Maybe.ap(Maybe.some(5)),
		Maybe.ap(Maybe.some(3)),
	);
	expect(result).toEqual({ kind: "Some", value: 8 });
});

test("Maybe.ap returns None when function is None", () => {
	const result = pipe(
		Maybe.none(),
		Maybe.ap(Maybe.some(5)),
	);
	expect(result).toEqual({ kind: "None" });
});

test("Maybe.ap returns None when value is None", () => {
	const result = pipe(
		Maybe.some((n: number) => n * 2),
		Maybe.ap(Maybe.none()),
	);
	expect(result).toEqual({ kind: "None" });
});

test("Maybe.ap returns None when both are None", () => {
	const result = pipe(
		Maybe.none(),
		Maybe.ap(Maybe.none()),
	);
	expect(result).toEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("Maybe composes well in a pipe chain", () => {
	const result = pipe(
		Maybe.fromNullable("42" as string | null),
		Maybe.map((s) => parseInt(s, 10)),
		Maybe.filter((n) => n > 0),
		Maybe.map((n) => n * 2),
		Maybe.getOrElse(() => 0),
	);
	expect(result).toBe(84);
});

test("Maybe pipe short-circuits on None", () => {
	const result = pipe(
		Maybe.fromNullable(null as string | null),
		Maybe.map((s) => parseInt(s, 10)),
		Maybe.filter((n) => n > 0),
		Maybe.map((n) => n * 2),
		Maybe.getOrElse(() => 0),
	);
	expect(result).toBe(0);
});
