import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../Maybe.ts";
import { Result } from "../Result.ts";

// ---------------------------------------------------------------------------
// of / some
// ---------------------------------------------------------------------------

test("make.some: wraps a value in Some", () => {
	const result = Maybe.make.some(42);
	expect(result).toStrictEqual({ kind: "Some", value: 42 });
});

test("make.some: creates a Some with the given value", () => {
	const result = Maybe.make.some("hello");
	expect(result).toStrictEqual({ kind: "Some", value: "hello" });
});

test("make.some: produces consistent result across invocations", () => {
	expect(Maybe.make.some(10)).toStrictEqual(Maybe.make.some(10));
});

// ---------------------------------------------------------------------------
// isSome
// ---------------------------------------------------------------------------

test("is.some: returns true for Some", () => {
	expect(Maybe.is.some(Maybe.make.some(1))).toBe(true);
});

test("is.some: returns false for None", () => {
	expect(Maybe.is.some(Maybe.make.none())).toBe(false);
});

// ---------------------------------------------------------------------------
// none / isNone
// ---------------------------------------------------------------------------

test("make.none: creates a None", () => {
	expect(Maybe.make.none()).toStrictEqual({ kind: "None" });
});

test("is.none: returns true for None", () => {
	expect(Maybe.is.none(Maybe.make.none())).toBe(true);
});

test("is.none: returns false for Some", () => {
	expect(Maybe.is.none(Maybe.make.some(1))).toBe(false);
});

// ---------------------------------------------------------------------------
// from.nullable
// ---------------------------------------------------------------------------

test("from.nullable: returns None for null", () => {
	expect(Maybe.from.nullable(null)).toStrictEqual({ kind: "None" });
});

test("from.nullable: returns None for undefined", () => {
	expect(Maybe.from.nullable(undefined)).toStrictEqual({ kind: "None" });
});

test("from.nullable: returns Some for 0", () => {
	expect(Maybe.from.nullable(0)).toStrictEqual({ kind: "Some", value: 0 });
});

test("from.nullable: returns Some for false", () => {
	expect(Maybe.from.nullable(false)).toStrictEqual({ kind: "Some", value: false });
});

test("from.nullable: returns Some for empty string", () => {
	expect(Maybe.from.nullable("")).toStrictEqual({ kind: "Some", value: "" });
});

test("from.nullable: returns Some for NaN", () => {
	expect(Maybe.from.nullable(NaN)).toStrictEqual({ kind: "Some", value: NaN });
});

test("from.nullable: returns Some for a regular value", () => {
	expect(Maybe.from.nullable(42)).toStrictEqual({ kind: "Some", value: 42 });
});

test("from.nullable: returns Some for an object", () => {
	const obj = { a: 1 };
	const result = Maybe.from.nullable(obj);
	expect(result).toStrictEqual({ kind: "Some", value: { a: 1 } });
});

// ---------------------------------------------------------------------------
// to.nullable
// ---------------------------------------------------------------------------

test("to.nullable: returns the value for Some", () => {
	expect(Maybe.to.nullable(Maybe.make.some(42))).toBe(42);
});

test("to.nullable: returns null for None", () => {
	expect(Maybe.to.nullable(Maybe.make.none())).toBeNull();
});

// ---------------------------------------------------------------------------
// toUndefined
// ---------------------------------------------------------------------------

test("to.undefined: returns the value for Some", () => {
	expect(Maybe.to.undefined(Maybe.make.some(42))).toBe(42);
});

test("to.undefined: returns undefined for None", () => {
	expect(Maybe.to.undefined(Maybe.make.none())).toBeUndefined();
});

// ---------------------------------------------------------------------------
// toResult
// ---------------------------------------------------------------------------

test("to.Result: converts Some to Ok", () => {
	const result = pipe(Maybe.make.some(42), Maybe.to.Result(() => "missing"));
	expect(result).toStrictEqual({ kind: "Ok", value: 42 });
});

test("to.Result: converts None to Err using the onNone callback", () => {
	const result = Maybe.to.Result(() => "error")(Maybe.make.none());
	expect(result).toStrictEqual({ kind: "Err", error: "error" });
});

test("to.Result: lazily evaluates the error callback only on None", () => {
	let called = false;
	pipe(
		Maybe.make.some(10),
		Maybe.to.Result(() => {
			called = true;
			return "error";
		}),
	);
	expect(called).toBe(false);
});

// ---------------------------------------------------------------------------
// toValidation
// ---------------------------------------------------------------------------

test("to.Validation: converts Some to Passed", () => {
	const result = pipe(Maybe.make.some(42), Maybe.to.Validation(() => "missing"));
	expect(result).toStrictEqual({ kind: "Passed", value: 42 });
});

test("to.Validation: converts None to Failed using onNone callback", () => {
	const result = Maybe.to.Validation(() => "error")(Maybe.make.none());
	expect(result).toStrictEqual({ kind: "Failed", errors: ["error"] });
});

test("to.Validation: lazily evaluates the error callback only on None", () => {
	let called = false;
	pipe(
		Maybe.make.some(10),
		Maybe.to.Validation(() => {
			called = true;
			return "error";
		}),
	);
	expect(called).toBe(false);
});

// ---------------------------------------------------------------------------
// fromResult
// ---------------------------------------------------------------------------

test("from.Result: converts Ok to Some", () => {
	const result = Maybe.from.Result(Result.make.ok(42));
	expect(result).toStrictEqual({ kind: "Some", value: 42 });
});

test("from.Result: converts Err to None", () => {
	const result = Maybe.from.Result(Result.make.err("x"));
	expect(result).toStrictEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// tryCatch
// ---------------------------------------------------------------------------

test("tryCatch: returns Some when operation succeeds", () => {
	const result = Maybe.tryCatch(() => JSON.parse('{"a":1}'));
	expect(result).toStrictEqual({ kind: "Some", value: { a: 1 } });
});

test("tryCatch: returns None when operation throws", () => {
	const result = Maybe.tryCatch(() => JSON.parse("invalid json"));
	expect(result).toStrictEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("map: transforms the value inside Some", () => {
	const result = pipe(Maybe.make.some(5), Maybe.map((n: number) => n * 2));
	expect(result).toStrictEqual({ kind: "Some", value: 10 });
});

test("map: passes through None unchanged", () => {
	const result = pipe(Maybe.make.none(), Maybe.map((n: number) => n * 2));
	expect(result).toStrictEqual({ kind: "None" });
});

test("map: can change the type", () => {
	const result = pipe(Maybe.make.some(5), Maybe.map((n: number) => String(n)));
	expect(result).toStrictEqual({ kind: "Some", value: "5" });
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("chain: applies function when Some", () => {
	const parseNumber = (s: string) => {
		const n = parseInt(s, 10);
		return isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
	};
	const result = pipe(Maybe.make.some("42"), Maybe.chain(parseNumber));
	expect(result).toStrictEqual({ kind: "Some", value: 42 });
});

test("chain: returns None when function returns None", () => {
	const parseNumber = (s: string) => {
		const n = parseInt(s, 10);
		return isNaN(n) ? Maybe.make.none() : Maybe.make.some(n);
	};
	const result = pipe(Maybe.make.some("abc"), Maybe.chain(parseNumber));
	expect(result).toStrictEqual({ kind: "None" });
});

test("chain: propagates None without calling function", () => {
	let called = false;
	pipe(
		Maybe.make.none(),
		Maybe.chain((_s: string) => {
			called = true;
			return Maybe.make.some(1);
		}),
	);
	expect(called).toBe(false);
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("fold: calls onSome for Some", () => {
	const result = pipe(Maybe.make.some(5), Maybe.fold(() => "none", (n: number) => `value: ${n}`));
	expect(result).toBe("value: 5");
});

test("fold: calls onNone for None", () => {
	const result = pipe(Maybe.make.none(), Maybe.fold(() => "none", (n: number) => `value: ${n}`));
	expect(result).toBe("none");
});

// ---------------------------------------------------------------------------
// match (data-last)
// ---------------------------------------------------------------------------

test("match: calls some handler for Some", () => {
	const result = pipe(Maybe.make.some(5), Maybe.match({ some: (n: number) => `got ${n}`, none: () => "nothing" }));
	expect(result).toBe("got 5");
});

test("match: calls none handler for None", () => {
	const result = pipe(Maybe.make.none(), Maybe.match({ some: (n: number) => `got ${n}`, none: () => "nothing" }));
	expect(result).toBe("nothing");
});

test("match: is data-last (returns a function first)", () => {
	const handler = Maybe.match({ some: (n) => `val: ${n}`, none: () => "empty" });
	expect(handler(Maybe.make.some(3))).toBe("val: 3");
	expect(handler(Maybe.make.none())).toBe("empty");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("getOrElse: returns value for Some", () => {
	const result = pipe(Maybe.make.some(5), Maybe.getOrElse(() => 0));
	expect(result).toBe(5);
});

test("getOrElse: returns default for None", () => {
	const result = pipe(Maybe.make.none(), Maybe.getOrElse(() => 0));
	expect(result).toBe(0);
});

test("getOrElse: widens return type to A | B when default is a different type", () => {
	const result = pipe(Maybe.make.none(), Maybe.getOrElse(() => null));
	expect(result).toBeNull();
});

test("getOrElse: returns Some value typed as A | B when Some", () => {
	const result = pipe(Maybe.make.some("hello"), Maybe.getOrElse(() => null));
	expect(result).toBe("hello");
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("tap: executes side effect on Some and returns original", () => {
	let sideEffect = 0;
	const result = pipe(
		Maybe.make.some(5),
		Maybe.tap((n: number) => {
			sideEffect = n;
		}),
	);
	expect(sideEffect).toBe(5);
	expect(result).toStrictEqual({ kind: "Some", value: 5 });
});

test("tap: does not execute side effect on None", () => {
	let called = false;
	const result = pipe(
		Maybe.make.none(),
		Maybe.tap((_n: number) => {
			called = true;
		}),
	);
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// tapNone
// ---------------------------------------------------------------------------

test("tapNone: executes side effect on None and returns original", () => {
	let called = false;
	const result = pipe(
		Maybe.make.none(),
		Maybe.tapNone(() => {
			called = true;
		}),
	);
	expect(called).toBe(true);
	expect(result).toStrictEqual({ kind: "None" });
});

test("tapNone: does not execute side effect on Some", () => {
	let called = false;
	const result = pipe(
		Maybe.make.some(42),
		Maybe.tapNone(() => {
			called = true;
		}),
	);
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Some", value: 42 });
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

test("filter: keeps Some when predicate is true", () => {
	const result = pipe(Maybe.make.some(5), Maybe.filter((n: number) => n > 3));
	expect(result).toStrictEqual({ kind: "Some", value: 5 });
});

test("filter: returns None when predicate is false", () => {
	const result = pipe(Maybe.make.some(2), Maybe.filter((n: number) => n > 3));
	expect(result).toStrictEqual({ kind: "None" });
});

test("filter: narrows type when passed a type guard refinement", () => {
	const isString = (val: unknown): val is string => typeof val === "string";
	const input: Maybe<unknown> = Maybe.make.some("hello");
	const narrowed = pipe(input, Maybe.filter(isString));

	expectTypeOf(narrowed).toEqualTypeOf<Maybe<string>>();
	expect(narrowed).toStrictEqual(Maybe.make.some("hello"));
});

test("filter: returns None when input is None", () => {
	const result = pipe(Maybe.make.none(), Maybe.filter((n: number) => n > 3));
	expect(result).toStrictEqual({ kind: "None" });
});

test("filter: returns same None reference", () => {
	const none = Maybe.make.none();
	const result = pipe(none as Maybe<number>, Maybe.filter((n) => n > 3));
	expect(result).toBe(none);
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test("bindTo: returns None when given None", () => {
	const result = pipe(Maybe.make.none(), Maybe.bindTo("key"));
	expect(result).toStrictEqual(Maybe.make.none());
});

test("recover: returns original Some without calling fallback", () => {
	let called = false;
	const result = pipe(
		Maybe.make.some(5),
		Maybe.recover(() => {
			called = true;
			return Maybe.make.some(99);
		}),
	);
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Some", value: 5 });
});

test("recover: provides fallback for None", () => {
	const result = pipe(Maybe.make.none(), Maybe.recover(() => Maybe.make.some(99)));
	expect(result).toStrictEqual({ kind: "Some", value: 99 });
});

test("recover: can return None as fallback", () => {
	const result = pipe(Maybe.make.none(), Maybe.recover(() => Maybe.make.none()));
	expect(result).toStrictEqual({ kind: "None" });
});

test("recover: widens type when fallback returns different type", () => {
	const result = pipe(Maybe.make.none(), Maybe.recover(() => Maybe.make.some("fallback")));
	expect(result).toStrictEqual({ kind: "Some", value: "fallback" });
});

test("recover: preserves Some value and type", () => {
	const result = pipe(Maybe.make.some(42), Maybe.recover(() => Maybe.make.some("fallback")));
	expect(result).toStrictEqual({ kind: "Some", value: 42 });
});

// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------

test("apply: applies Some function to Some value", () => {
	const add = (a: number) => (b: number) => a + b;
	const result = pipe(Maybe.make.some(add), Maybe.apply(Maybe.make.some(5)), Maybe.apply(Maybe.make.some(3)));
	expect(result).toStrictEqual({ kind: "Some", value: 8 });
});

test("apply: returns None when function is None", () => {
	const result = pipe(Maybe.make.none(), Maybe.apply(Maybe.make.some(5)));
	expect(result).toStrictEqual({ kind: "None" });
});

test("apply: returns None when value is None", () => {
	const result = pipe(Maybe.make.some((n: number) => n * 2), Maybe.apply(Maybe.make.none()));
	expect(result).toStrictEqual({ kind: "None" });
});

test("apply: returns None when both are None", () => {
	const result = pipe(Maybe.make.none(), Maybe.apply(Maybe.make.none()));
	expect(result).toStrictEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("pipe: composes well in pipeline", () => {
	const result = pipe(
		Maybe.from.nullable("42" as string | null),
		Maybe.map((s) => parseInt(s, 10)),
		Maybe.filter((n) => n > 0),
		Maybe.map((n) => n * 2),
		Maybe.getOrElse(() => 0),
	);
	expect(result).toBe(84);
});

test("pipe: short-circuits on None", () => {
	const result = pipe(
		Maybe.from.nullable(null as string | null),
		Maybe.map((s) => parseInt(s, 10)),
		Maybe.filter((n) => n > 0),
		Maybe.map((n) => n * 2),
		Maybe.getOrElse(() => 0),
	);
	expect(result).toBe(0);
});

// ---------------------------------------------------------------------------
// from.Predicate
// ---------------------------------------------------------------------------

test("from.Predicate: returns Some when predicate passes", () => {
	expect(Maybe.from.Predicate((n: number) => n > 0)(5)).toStrictEqual(Maybe.make.some(5));
});

test("from.Predicate: returns None when predicate fails", () => {
	expect(Maybe.from.Predicate((n: number) => n > 0)(-1)).toStrictEqual(Maybe.make.none());
});

test("from.Predicate: returns None for boundary value", () => {
	expect(Maybe.from.Predicate((n: number) => n > 0)(0)).toStrictEqual(Maybe.make.none());
});

test("from.Predicate: works with string predicates", () => {
	expect(Maybe.from.Predicate((s: string) => s.length > 0)("")).toStrictEqual(Maybe.make.none());
	expect(Maybe.from.Predicate((s: string) => s.length > 0)("hi")).toStrictEqual(Maybe.make.some("hi"));
});

test("from.Predicate: composes in pipe", () => {
	expect(pipe(18, Maybe.from.Predicate((n: number) => n >= 18))).toStrictEqual(Maybe.make.some(18));
	expect(pipe(17, Maybe.from.Predicate((n: number) => n >= 18))).toStrictEqual(Maybe.make.none());
});

// ---------------------------------------------------------------------------
// Type inference
// ---------------------------------------------------------------------------

test("map: return type reflects mapped function output", () => {
	const r: Maybe<number> = Maybe.make.some(42);
	const mapped = Maybe.map((n: number) => String(n))(r);
	expectTypeOf(mapped).toEqualTypeOf<Maybe<string>>();
});

test("chain: collapses nested Maybe", () => {
	const r: Maybe<number> = Maybe.make.some(42);
	const chained = Maybe.chain((n: number) => Maybe.make.some(String(n)))(r);
	expectTypeOf(chained).toEqualTypeOf<Maybe<string>>();
});

test("getOrElse: widens return type to union", () => {
	const val = pipe(Maybe.make.some("hello"), Maybe.getOrElse((): null => null));
	expectTypeOf(val).toEqualTypeOf<string | null>();
});

test("fold: return type matches branch return types", () => {
	const r: Maybe<number> = Maybe.make.some(42);
	const folded = Maybe.fold((): string => "none", (n: number): string => String(n))(r);
	expectTypeOf(folded).toBeString();
});

// --- bindTo ---

test("bindTo: wraps value in accumulator object", () => {
	const result = pipe(Maybe.make.some(2), Maybe.bindTo("a"));
	expect(result).toStrictEqual(Maybe.make.some({ a: 2 }));
});

// --- bind ---

test("bind: accumulates values key-by-key in pipeline", () => {
	const result = pipe(
		Maybe.make.some(2),
		Maybe.bindTo("a"),
		Maybe.bind("b", ({ a }) => Maybe.make.some(a * 3)),
		Maybe.bind("c", ({ a, b }) => Maybe.make.some(a + b)),
	);
	expect(result).toStrictEqual(Maybe.make.some({ a: 2, b: 6, c: 8 }));
});

test("bind: short-circuits on None", () => {
	let called = false;
	const result = pipe(
		Maybe.make.some(2),
		Maybe.bindTo("a"),
		Maybe.bind("b", () => Maybe.make.none()),
		Maybe.bind("c", ({ b }) => {
			called = true;
			return Maybe.make.some(b);
		}),
	);
	expect(called).toBe(false);
	expect(result).toStrictEqual(Maybe.make.none());
});

// --- struct ---

test("struct: combines record of Some values into single Some record", () => {
	const res = Maybe.struct({ a: Maybe.make.some(1), b: Maybe.make.some("hello") });
	expect(res).toStrictEqual(Maybe.make.some({ a: 1, b: "hello" }));
});

test("struct: short-circuits on first None encountered", () => {
	const res = Maybe.struct({ a: Maybe.make.some(1), b: Maybe.make.none(), c: Maybe.make.some(3) });
	expect(res).toStrictEqual(Maybe.make.none());
});

test("struct: composes in pipeline", () => {
	const res = pipe(
		Maybe.make.some({ name: "Alice" }),
		Maybe.map((u) => u.name),
		Maybe.chain((name) =>
			Maybe.struct({ name: Maybe.make.some(name), valid: Maybe.from.Predicate((n: string) => n.length > 0)(name) })
		),
	);
	expect(res).toStrictEqual(Maybe.make.some({ name: "Alice", valid: "Alice" }));
});

test("struct: ignores inherited prototype properties", () => {
	const proto = { b: Maybe.make.some(2) };
	const fields = Object.create(proto);
	fields.a = Maybe.make.some(1);
	const res = Maybe.struct(fields);
	expect(res).toStrictEqual(Maybe.make.some({ a: 1 }));
});

test("struct: returns some({}) when given empty object", () => {
	const res = Maybe.struct({});
	expect(res).toStrictEqual(Maybe.make.some({}));
});

// --- transposeResult ---

test("transposeResult: swaps Some(Ok) to Ok(Some)", () => {
	const res = Maybe.transposeResult(Maybe.make.some(Result.make.ok(42)));
	expect(res).toStrictEqual(Result.make.ok(Maybe.make.some(42)));
});

test("transposeResult: swaps Some(Err) to Err", () => {
	const res = Maybe.transposeResult(Maybe.make.some(Result.make.err("error")));
	expect(res).toStrictEqual(Result.make.err("error"));
});

test("transposeResult: swaps None to Ok(None)", () => {
	const res = Maybe.transposeResult(Maybe.make.none());
	expect(res).toStrictEqual(Result.make.ok(Maybe.make.none()));
});
