import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../../Core/Maybe.ts";
import { Result } from "../../Core/Result.ts";
import { Bool } from "../Bool.ts";

// ---------------------------------------------------------------------------
// is
// ---------------------------------------------------------------------------

test("Bool.is.boolean identifies boolean primitives", () => {
	expect(Bool.is.boolean(true)).toBe(true);
	expect(Bool.is.boolean(false)).toBe(true);
	expect(Bool.is.boolean("true")).toBe(false);
	expect(Bool.is.boolean(1)).toBe(false);
	expect(Bool.is.boolean(null)).toBe(false);
	expect(Bool.is.boolean(undefined)).toBe(false);
	expect(Bool.is.boolean({})).toBe(false);
});

test("Bool.is.true narrows literal true", () => {
	expect(Bool.is.true(true)).toBe(true);
	expect(Bool.is.true(false)).toBe(false);
	expect(Bool.is.true("true")).toBe(false);
	expect(Bool.is.true(1)).toBe(false);
});

test("Bool.is.false narrows literal false", () => {
	expect(Bool.is.false(false)).toBe(true);
	expect(Bool.is.false(true)).toBe(false);
	expect(Bool.is.false("false")).toBe(false);
	expect(Bool.is.false(0)).toBe(false);
});

test("Bool.is.truthy identifies truthy values", () => {
	expect(Bool.is.truthy(true)).toBe(true);
	expect(Bool.is.truthy("hello")).toBe(true);
	expect(Bool.is.truthy(42)).toBe(true);
	expect(Bool.is.truthy([])).toBe(true);
	expect(Bool.is.truthy({})).toBe(true);

	expect(Bool.is.truthy(false)).toBe(false);
	expect(Bool.is.truthy(0)).toBe(false);
	expect(Bool.is.truthy(-0)).toBe(false);
	expect(Bool.is.truthy(0n)).toBe(false);
	expect(Bool.is.truthy("")).toBe(false);
	expect(Bool.is.truthy(null)).toBe(false);
	expect(Bool.is.truthy(undefined)).toBe(false);
	expect(Bool.is.truthy(NaN)).toBe(false);
});

test("Bool.is.falsy identifies falsy values", () => {
	expect(Bool.is.falsy(false)).toBe(true);
	expect(Bool.is.falsy(0)).toBe(true);
	expect(Bool.is.falsy(-0)).toBe(true);
	expect(Bool.is.falsy(0n)).toBe(true);
	expect(Bool.is.falsy("")).toBe(true);
	expect(Bool.is.falsy(null)).toBe(true);
	expect(Bool.is.falsy(undefined)).toBe(true);
	expect(Bool.is.falsy(NaN)).toBe(true);

	expect(Bool.is.falsy(true)).toBe(false);
	expect(Bool.is.falsy("text")).toBe(false);
	expect(Bool.is.falsy(1)).toBe(false);
	expect(Bool.is.falsy({})).toBe(false);
});

// ---------------------------------------------------------------------------
// not
// ---------------------------------------------------------------------------

test("Bool.not inverts boolean values", () => {
	expect(Bool.not(true)).toBe(false);
	expect(Bool.not(false)).toBe(true);
	expect(pipe(true, Bool.not)).toBe(false);
	expect(pipe(false, Bool.not)).toBe(true);
});

// ---------------------------------------------------------------------------
// and
// ---------------------------------------------------------------------------

test("Bool.and performs logical AND (data-last)", () => {
	expect(pipe(true, Bool.and(true))).toBe(true);
	expect(pipe(true, Bool.and(false))).toBe(false);
	expect(pipe(false, Bool.and(true))).toBe(false);
	expect(pipe(false, Bool.and(false))).toBe(false);
});

// ---------------------------------------------------------------------------
// or
// ---------------------------------------------------------------------------

test("Bool.or performs logical OR (data-last)", () => {
	expect(pipe(true, Bool.or(true))).toBe(true);
	expect(pipe(true, Bool.or(false))).toBe(true);
	expect(pipe(false, Bool.or(true))).toBe(true);
	expect(pipe(false, Bool.or(false))).toBe(false);
});

// ---------------------------------------------------------------------------
// xor
// ---------------------------------------------------------------------------

test("Bool.xor performs exclusive OR (data-last)", () => {
	expect(pipe(true, Bool.xor(false))).toBe(true);
	expect(pipe(false, Bool.xor(true))).toBe(true);
	expect(pipe(true, Bool.xor(true))).toBe(false);
	expect(pipe(false, Bool.xor(false))).toBe(false);
});

// ---------------------------------------------------------------------------
// andLazy
// ---------------------------------------------------------------------------

test("Bool.andLazy evaluates computation when self is true", () => {
	let called = false;
	const result = pipe(
		true,
		Bool.andLazy(() => {
			called = true;
			return true;
		}),
	);
	expect(result).toBe(true);
	expect(called).toBe(true);
});

test("Bool.andLazy short-circuits and does not evaluate when self is false", () => {
	let called = false;
	const result = pipe(
		false,
		Bool.andLazy(() => {
			called = true;
			return true;
		}),
	);
	expect(result).toBe(false);
	expect(called).toBe(false);
});

// ---------------------------------------------------------------------------
// orLazy
// ---------------------------------------------------------------------------

test("Bool.orLazy short-circuits and does not evaluate when self is true", () => {
	let called = false;
	const result = pipe(
		true,
		Bool.orLazy(() => {
			called = true;
			return false;
		}),
	);
	expect(result).toBe(true);
	expect(called).toBe(false);
});

test("Bool.orLazy evaluates computation when self is false", () => {
	let called = false;
	const result = pipe(
		false,
		Bool.orLazy(() => {
			called = true;
			return true;
		}),
	);
	expect(result).toBe(true);
	expect(called).toBe(true);
});

// ---------------------------------------------------------------------------
// all
// ---------------------------------------------------------------------------

test("Bool.all returns true only when all booleans are true", () => {
	expect(Bool.all([true, true, true])).toBe(true);
	expect(Bool.all([true, false, true])).toBe(false);
	expect(Bool.all([false, false])).toBe(false);
});

test("Bool.all returns true for an empty array (vacuous truth)", () => {
	expect(Bool.all([])).toBe(true);
});

// ---------------------------------------------------------------------------
// any
// ---------------------------------------------------------------------------

test("Bool.any returns true if at least one boolean is true", () => {
	expect(Bool.any([false, true, false])).toBe(true);
	expect(Bool.any([false, false, false])).toBe(false);
	expect(Bool.any([true, true])).toBe(true);
});

test("Bool.any returns false for an empty array", () => {
	expect(Bool.any([])).toBe(false);
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("Bool.fold evaluates onTrue when true and does not evaluate onFalse", () => {
	let falseCalled = false;
	let trueCalled = false;
	const result = pipe(
		true,
		Bool.fold(() => {
			falseCalled = true;
			return "false-branch";
		}, () => {
			trueCalled = true;
			return "true-branch";
		}),
	);
	expect(result).toBe("true-branch");
	expect(trueCalled).toBe(true);
	expect(falseCalled).toBe(false);
});

test("Bool.fold evaluates onFalse when false and does not evaluate onTrue", () => {
	let falseCalled = false;
	let trueCalled = false;
	const result = pipe(
		false,
		Bool.fold(() => {
			falseCalled = true;
			return "false-branch";
		}, () => {
			trueCalled = true;
			return "true-branch";
		}),
	);
	expect(result).toBe("false-branch");
	expect(falseCalled).toBe(true);
	expect(trueCalled).toBe(false);
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

test("Bool.match evaluates true branch on true", () => {
	let falseCalled = false;
	const result = pipe(
		true,
		Bool.match({
			true: () => "yes",
			false: () => {
				falseCalled = true;
				return "no";
			},
		}),
	);
	expect(result).toBe("yes");
	expect(falseCalled).toBe(false);
});

test("Bool.match evaluates false branch on false", () => {
	let trueCalled = false;
	const result = pipe(
		false,
		Bool.match({
			true: () => {
				trueCalled = true;
				return "yes";
			},
			false: () => "no",
		}),
	);
	expect(result).toBe("no");
	expect(trueCalled).toBe(false);
});

// ---------------------------------------------------------------------------
// from
// ---------------------------------------------------------------------------

test("Bool.from.string parses true and false strings (case-insensitive & trimmed)", () => {
	expect(Bool.from.string("true")).toStrictEqual(Maybe.make.some(true));
	expect(Bool.from.string("TRUE")).toStrictEqual(Maybe.make.some(true));
	expect(Bool.from.string("  True  ")).toStrictEqual(Maybe.make.some(true));

	expect(Bool.from.string("false")).toStrictEqual(Maybe.make.some(false));
	expect(Bool.from.string("FALSE")).toStrictEqual(Maybe.make.some(false));
	expect(Bool.from.string("  False ")).toStrictEqual(Maybe.make.some(false));

	expect(Bool.from.string("yes")).toStrictEqual(Maybe.make.none());
	expect(Bool.from.string("0")).toStrictEqual(Maybe.make.none());
	expect(Bool.from.string("1")).toStrictEqual(Maybe.make.none());
	expect(Bool.from.string("")).toStrictEqual(Maybe.make.none());
	expect(Bool.from.string("anything")).toStrictEqual(Maybe.make.none());
});

test("Bool.from.number parses strict 1 and 0", () => {
	expect(Bool.from.number(1)).toStrictEqual(Maybe.make.some(true));
	expect(Bool.from.number(0)).toStrictEqual(Maybe.make.some(false));

	expect(Bool.from.number(2)).toStrictEqual(Maybe.make.none());
	expect(Bool.from.number(-1)).toStrictEqual(Maybe.make.none());
	expect(Bool.from.number(0.5)).toStrictEqual(Maybe.make.none());
	expect(Bool.from.number(NaN)).toStrictEqual(Maybe.make.none());
	expect(Bool.from.number(Infinity)).toStrictEqual(Maybe.make.none());
});

test("Bool.from.truthy coerces values to boolean", () => {
	expect(Bool.from.truthy("hello")).toBe(true);
	expect(Bool.from.truthy(42)).toBe(true);
	expect(Bool.from.truthy({})).toBe(true);
	expect(Bool.from.truthy(0)).toBe(false);
	expect(Bool.from.truthy(null)).toBe(false);
	expect(Bool.from.truthy(undefined)).toBe(false);
});

// ---------------------------------------------------------------------------
// to
// ---------------------------------------------------------------------------

test("Bool.to.Maybe converts true to Some and evaluates value lazily", () => {
	let called = false;
	const result = pipe(
		true,
		Bool.to.Maybe(() => {
			called = true;
			return 42;
		}),
	);
	expect(result).toStrictEqual(Maybe.make.some(42));
	expect(called).toBe(true);
});

test("Bool.to.Maybe converts false to None without calling onTrue", () => {
	let called = false;
	const result = pipe(
		false,
		Bool.to.Maybe(() => {
			called = true;
			return 42;
		}),
	);
	expect(result).toStrictEqual(Maybe.make.none());
	expect(called).toBe(false);
});

test("Bool.to.Result converts true to Ok and does not evaluate onErr", () => {
	let errCalled = false;
	const result = pipe(
		true,
		Bool.to.Result(() => {
			errCalled = true;
			return "error";
		}, () => "success"),
	);
	expect(result).toStrictEqual(Result.make.ok("success"));
	expect(errCalled).toBe(false);
});

test("Bool.to.Result converts false to Err and does not evaluate onOk", () => {
	let okCalled = false;
	const result = pipe(
		false,
		Bool.to.Result(() => "error", () => {
			okCalled = true;
			return "success";
		}),
	);
	expect(result).toStrictEqual(Result.make.err("error"));
	expect(okCalled).toBe(false);
});

test("Bool.to.number converts boolean to 1 or 0", () => {
	expect(Bool.to.number(true)).toBe(1);
	expect(Bool.to.number(false)).toBe(0);
});

test("Bool.to.string converts boolean to string literal", () => {
	expect(Bool.to.string(true)).toBe("true");
	expect(Bool.to.string(false)).toBe("false");
});

// ---------------------------------------------------------------------------
// Pipe composition
// ---------------------------------------------------------------------------

test("Bool composes cleanly in pipeline workflows", () => {
	type User = { isActive: boolean; isVerified: boolean; isBanned: boolean; token: string; };

	const user: User = { isActive: true, isVerified: true, isBanned: false, token: "tok_123" };

	const canAccess = pipe(user.isActive, Bool.and(user.isVerified), Bool.and(Bool.not(user.isBanned)));
	expect(canAccess).toBe(true);

	const authToken = pipe(canAccess, Bool.to.Result(() => "User is not eligible for token", () => user.token));
	expect(authToken).toStrictEqual(Result.make.ok("tok_123"));

	expectTypeOf(canAccess).toEqualTypeOf<boolean>();
	expectTypeOf(authToken).toEqualTypeOf<Result<string, string>>();
});
