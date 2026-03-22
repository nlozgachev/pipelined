import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Option } from "../Option.ts";
import { Result } from "../Result.ts";

// ---------------------------------------------------------------------------
// of / some
// ---------------------------------------------------------------------------

test("Option.some wraps a value in Some", () => {
	const result = Option.some(42);
	expect(result).toEqual({ kind: "Some", value: 42 });
});

test("Option.some creates a Some with the given value", () => {
	const result = Option.some("hello");
	expect(result).toEqual({ kind: "Some", value: "hello" });
});

test("Option.some and Option.some produce the same result", () => {
	expect(Option.some(10)).toEqual(Option.some(10));
});

// ---------------------------------------------------------------------------
// isSome
// ---------------------------------------------------------------------------

test("Option.isSome returns true for Some", () => {
	expect(Option.isSome(Option.some(1))).toBe(true);
});

test("Option.isSome returns false for None", () => {
	expect(Option.isSome(Option.none())).toBe(false);
});

// ---------------------------------------------------------------------------
// none / isNone
// ---------------------------------------------------------------------------

test("Option.none creates a None", () => {
	expect(Option.none()).toEqual({ kind: "None" });
});

test("Option.isNone returns true for None", () => {
	expect(Option.isNone(Option.none())).toBe(true);
});

test("Option.isNone returns false for Some", () => {
	expect(Option.isNone(Option.some(1))).toBe(false);
});

// ---------------------------------------------------------------------------
// fromNullable
// ---------------------------------------------------------------------------

test("Option.fromNullable returns None for null", () => {
	expect(Option.fromNullable(null)).toEqual({ kind: "None" });
});

test("Option.fromNullable returns None for undefined", () => {
	expect(Option.fromNullable(undefined)).toEqual({ kind: "None" });
});

test("Option.fromNullable returns Some for 0", () => {
	expect(Option.fromNullable(0)).toEqual({ kind: "Some", value: 0 });
});

test("Option.fromNullable returns Some for false", () => {
	expect(Option.fromNullable(false)).toEqual({ kind: "Some", value: false });
});

test("Option.fromNullable returns Some for empty string", () => {
	expect(Option.fromNullable("")).toEqual({ kind: "Some", value: "" });
});

test("Option.fromNullable returns Some for NaN", () => {
	expect(Option.fromNullable(NaN)).toEqual({ kind: "Some", value: NaN });
});

test("Option.fromNullable returns Some for a regular value", () => {
	expect(Option.fromNullable(42)).toEqual({ kind: "Some", value: 42 });
});

test("Option.fromNullable returns Some for an object", () => {
	const obj = { a: 1 };
	const result = Option.fromNullable(obj);
	expect(result).toEqual({ kind: "Some", value: { a: 1 } });
});

// ---------------------------------------------------------------------------
// toNullable
// ---------------------------------------------------------------------------

test("Option.toNullable returns the value for Some", () => {
	expect(Option.toNullable(Option.some(42))).toBe(42);
});

test("Option.toNullable returns null for None", () => {
	expect(Option.toNullable(Option.none())).toBeNull();
});

// ---------------------------------------------------------------------------
// toUndefined
// ---------------------------------------------------------------------------

test("Option.toUndefined returns the value for Some", () => {
	expect(Option.toUndefined(Option.some(42))).toBe(42);
});

test("Option.toUndefined returns undefined for None", () => {
	expect(Option.toUndefined(Option.none())).toBeUndefined();
});

// ---------------------------------------------------------------------------
// fromUndefined
// ---------------------------------------------------------------------------

test("Option.fromUndefined returns None for undefined", () => {
	expect(Option.fromUndefined(undefined)).toEqual({ kind: "None" });
});

test(
	"Option.fromUndefined returns Some for null (null is not undefined)",
	() => {
		expect(Option.fromUndefined(null)).toEqual({ kind: "Some", value: null });
	},
);

test("Option.fromUndefined returns Some for a value", () => {
	expect(Option.fromUndefined(42)).toEqual({ kind: "Some", value: 42 });
});

// ---------------------------------------------------------------------------
// toResult
// ---------------------------------------------------------------------------

test("Option.toResult converts Some to Ok", () => {
	const result = pipe(
		Option.some(42),
		Option.toResult(() => "missing"),
	);
	expect(result).toEqual({ kind: "Ok", value: 42 });
});

test(
	"Option.toResult converts None to Err using the onNone callback",
	() => {
		const result = Option.toResult(() => "error")(Option.none());
		expect(result).toEqual({ kind: "Error", error: "error" });
	},
);

test(
	"Option.toResult lazily evaluates the error callback only on None",
	() => {
		let called = false;
		pipe(
			Option.some(10),
			Option.toResult(() => {
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

test("Option.fromResult converts Ok to Some", () => {
	const result = Option.fromResult(Result.ok(42));
	expect(result).toEqual({ kind: "Some", value: 42 });
});

test("Option.fromResult converts Err to None", () => {
	const result = Option.fromResult(Result.err("x"));
	expect(result).toEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("Option.map transforms the value inside Some", () => {
	const result = pipe(
		Option.some(5),
		Option.map((n: number) => n * 2),
	);
	expect(result).toEqual({ kind: "Some", value: 10 });
});

test("Option.map passes through None unchanged", () => {
	const result = pipe(
		Option.none(),
		Option.map((n: number) => n * 2),
	);
	expect(result).toEqual({ kind: "None" });
});

test("Option.map can change the type", () => {
	const result = pipe(
		Option.some(5),
		Option.map((n: number) => String(n)),
	);
	expect(result).toEqual({ kind: "Some", value: "5" });
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("Option.chain applies function when Some", () => {
	const parseNumber = (s: string) => {
		const n = parseInt(s, 10);
		return isNaN(n) ? Option.none() : Option.some(n);
	};
	const result = pipe(Option.some("42"), Option.chain(parseNumber));
	expect(result).toEqual({ kind: "Some", value: 42 });
});

test("Option.chain returns None when function returns None", () => {
	const parseNumber = (s: string) => {
		const n = parseInt(s, 10);
		return isNaN(n) ? Option.none() : Option.some(n);
	};
	const result = pipe(Option.some("abc"), Option.chain(parseNumber));
	expect(result).toEqual({ kind: "None" });
});

test("Option.chain propagates None without calling function", () => {
	let called = false;
	pipe(
		Option.none(),
		Option.chain((_s: string) => {
			called = true;
			return Option.some(1);
		}),
	);
	expect(called).toBe(false);
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("Option.fold calls onSome for Some", () => {
	const result = pipe(
		Option.some(5),
		Option.fold(
			() => "none",
			(n: number) => `value: ${n}`,
		),
	);
	expect(result).toBe("value: 5");
});

test("Option.fold calls onNone for None", () => {
	const result = pipe(
		Option.none(),
		Option.fold(
			() => "none",
			(n: number) => `value: ${n}`,
		),
	);
	expect(result).toBe("none");
});

// ---------------------------------------------------------------------------
// match (data-last)
// ---------------------------------------------------------------------------

test("Option.match calls some handler for Some", () => {
	const result = pipe(
		Option.some(5),
		Option.match({
			some: (n: number) => `got ${n}`,
			none: () => "nothing",
		}),
	);
	expect(result).toBe("got 5");
});

test("Option.match calls none handler for None", () => {
	const result = pipe(
		Option.none(),
		Option.match({
			some: (n: number) => `got ${n}`,
			none: () => "nothing",
		}),
	);
	expect(result).toBe("nothing");
});

test("Option.match is data-last (returns a function first)", () => {
	const handler = Option.match({
		some: (n) => `val: ${n}`,
		none: () => "empty",
	});
	expect(handler(Option.some(3))).toBe("val: 3");
	expect(handler(Option.none())).toBe("empty");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("Option.getOrElse returns value for Some", () => {
	const result = pipe(Option.some(5), Option.getOrElse(() => 0));
	expect(result).toBe(5);
});

test("Option.getOrElse returns default for None", () => {
	const result = pipe(Option.none(), Option.getOrElse(() => 0));
	expect(result).toBe(0);
});

test("Option.getOrElse widens return type to A | B when default is a different type", () => {
	const result = pipe(Option.none(), Option.getOrElse(() => null));
	expect(result).toBeNull();
});

test("Option.getOrElse returns Some value typed as A | B when Some", () => {
	const result = pipe(Option.some("hello"), Option.getOrElse(() => null));
	expect(result).toBe("hello");
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test(
	"Option.tap executes side effect on Some and returns original",
	() => {
		let sideEffect = 0;
		const result = pipe(
			Option.some(5),
			Option.tap((n: number) => {
				sideEffect = n;
			}),
		);
		expect(sideEffect).toBe(5);
		expect(result).toEqual({ kind: "Some", value: 5 });
	},
);

test("Option.tap does not execute side effect on None", () => {
	let called = false;
	const result = pipe(
		Option.none(),
		Option.tap((_n: number) => {
			called = true;
		}),
	);
	expect(called).toBe(false);
	expect(result).toEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("Option.filter keeps Some when predicate is true", () => {
	const result = pipe(
		Option.some(5),
		Option.filter((n: number) => n > 3),
	);
	expect(result).toEqual({ kind: "Some", value: 5 });
});

test("Option.filter returns None when predicate is false", () => {
	const result = pipe(
		Option.some(2),
		Option.filter((n: number) => n > 3),
	);
	expect(result).toEqual({ kind: "None" });
});

test("Option.filter returns None when input is None", () => {
	const result = pipe(
		Option.none(),
		Option.filter((n: number) => n > 3),
	);
	expect(result).toEqual({ kind: "None" });
});

test("Option.filter on None returns the same None reference", () => {
	const none = Option.none();
	const result = pipe(none as Option<number>, Option.filter((n) => n > 3));
	expect(result).toBe(none);
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test(
	"Option.recover returns original Some without calling fallback",
	() => {
		let called = false;
		const result = pipe(
			Option.some(5),
			Option.recover(() => {
				called = true;
				return Option.some(99);
			}),
		);
		expect(called).toBe(false);
		expect(result).toEqual({ kind: "Some", value: 5 });
	},
);

test("Option.recover provides fallback for None", () => {
	const result = pipe(
		Option.none(),
		Option.recover(() => Option.some(99)),
	);
	expect(result).toEqual({ kind: "Some", value: 99 });
});

test("Option.recover can return None as fallback", () => {
	const result = pipe(
		Option.none(),
		Option.recover(() => Option.none()),
	);
	expect(result).toEqual({ kind: "None" });
});

test("Option.recover widens to Option<A | B> when fallback returns a different type", () => {
	const result = pipe(
		Option.none(),
		Option.recover(() => Option.some("fallback")),
	);
	expect(result).toEqual({ kind: "Some", value: "fallback" });
});

test("Option.recover preserves Some typed as Option<A | B>", () => {
	const result = pipe(
		Option.some(42),
		Option.recover(() => Option.some("fallback")),
	);
	expect(result).toEqual({ kind: "Some", value: 42 });
});

// ---------------------------------------------------------------------------
// ap
// ---------------------------------------------------------------------------

test("Option.ap applies Some function to Some value", () => {
	const add = (a: number) => (b: number) => a + b;
	const result = pipe(
		Option.some(add),
		Option.ap(Option.some(5)),
		Option.ap(Option.some(3)),
	);
	expect(result).toEqual({ kind: "Some", value: 8 });
});

test("Option.ap returns None when function is None", () => {
	const result = pipe(
		Option.none(),
		Option.ap(Option.some(5)),
	);
	expect(result).toEqual({ kind: "None" });
});

test("Option.ap returns None when value is None", () => {
	const result = pipe(
		Option.some((n: number) => n * 2),
		Option.ap(Option.none()),
	);
	expect(result).toEqual({ kind: "None" });
});

test("Option.ap returns None when both are None", () => {
	const result = pipe(
		Option.none(),
		Option.ap(Option.none()),
	);
	expect(result).toEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("Option composes well in a pipe chain", () => {
	const result = pipe(
		Option.fromNullable("42" as string | null),
		Option.map((s) => parseInt(s, 10)),
		Option.filter((n) => n > 0),
		Option.map((n) => n * 2),
		Option.getOrElse(() => 0),
	);
	expect(result).toBe(84);
});

test("Option pipe short-circuits on None", () => {
	const result = pipe(
		Option.fromNullable(null as string | null),
		Option.map((s) => parseInt(s, 10)),
		Option.filter((n) => n > 0),
		Option.map((n) => n * 2),
		Option.getOrElse(() => 0),
	);
	expect(result).toBe(0);
});
