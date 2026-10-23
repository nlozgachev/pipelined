import { constFalseBool } from "#test-utils";
import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../Maybe.ts";
import { Result } from "../Result.ts";
import { Validation } from "../Validation.ts";

// ---------------------------------------------------------------------------
// passed
// ---------------------------------------------------------------------------

test("make.passed: wraps a value in Valid", () => {
	const result = Validation.make.passed(42);
	expect(result).toStrictEqual({ kind: "Passed", value: 42 });
});

// ---------------------------------------------------------------------------
// isPassed
// ---------------------------------------------------------------------------

test("is.passed: returns true for Valid", () => {
	expect(Validation.is.passed(Validation.make.passed(1))).toBe(true);
});

test("is.passed: returns false for Invalid", () => {
	expect(Validation.is.passed(Validation.make.failed("err"))).toBe(false);
});

// ---------------------------------------------------------------------------
// failedAll / isFailed
// ---------------------------------------------------------------------------

test("make.failedAll: creates an Invalid with errors array", () => {
	expect(Validation.make.failedAll(["error1", "error2"])).toStrictEqual({
		kind: "Failed",
		errors: ["error1", "error2"],
	});
});

test("is.failed: returns true for Invalid", () => {
	expect(Validation.is.failed(Validation.make.failed(["e"]))).toBe(true);
});

test("is.failed: returns false for Valid", () => {
	expect(Validation.is.failed(Validation.make.passed(1))).toBe(false);
});

// ---------------------------------------------------------------------------
// failed
// ---------------------------------------------------------------------------

test("make.failed: creates an Invalid from a single error", () => {
	expect(Validation.make.failed("oops")).toStrictEqual({ kind: "Failed", errors: ["oops"] });
});

// ---------------------------------------------------------------------------
// from.Predicate
// ---------------------------------------------------------------------------

test("from.Predicate: returns Valid when predicate passes", () => {
	expect(pipe("Alice", Validation.from.Predicate((s) => s.length > 0, () => "required"))).toStrictEqual({
		kind: "Passed",
		value: "Alice",
	});
});

test("from.Predicate: returns Invalid when predicate fails", () => {
	expect(pipe("", Validation.from.Predicate((s) => s.length > 0, () => "required"))).toStrictEqual({
		kind: "Failed",
		errors: ["required"],
	});
});

test("from.Predicate: passes the value to onFalse", () => {
	expect(pipe(-1, Validation.from.Predicate((n) => n >= 0, (n) => `${n} is negative`))).toStrictEqual({
		kind: "Failed",
		errors: ["-1 is negative"],
	});
});

test("from.Predicate: does not invoke onFalse when predicate passes", () => {
	let called = false;
	const res = pipe(
		"Alice",
		Validation.from.Predicate((s) => s.length > 0, () => {
			called = true;
			return "required";
		}),
	);
	expect(called).toBe(false);
	expect(res).toStrictEqual({ kind: "Passed", value: "Alice" });
});

test("from.Predicate: composes with apply for multi-field validation", () => {
	const validateName = Validation.from.Predicate((s: string) => s.length > 0, () => "Name required");
	const validateAge = Validation.from.Predicate((n: number) => n >= 0, () => "Age invalid");
	const result = pipe(
		Validation.make.passed((name: string) => (age: number) => ({ name, age })),
		Validation.apply(validateName("")),
		Validation.apply(validateAge(-1)),
	);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["Name required", "Age invalid"] });
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("map: transforms the passed value", () => {
	const result = pipe(Validation.make.passed(5), Validation.map((n: number) => n * 2));
	expect(result).toStrictEqual({ kind: "Passed", value: 10 });
});

test("map: passes through Invalid unchanged", () => {
	const result = pipe(Validation.make.failed("error"), Validation.map((n: number) => n * 2));
	expect(result).toStrictEqual({ kind: "Failed", errors: ["error"] });
});

test("map: does not invoke transform on Failed", () => {
	let called = false;
	const result = pipe(
		Validation.make.failed("error"),
		Validation.map(() => {
			called = true;
			return 100;
		}),
	);
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["error"] });
});

test("map: can change the value type", () => {
	const result = pipe(Validation.make.passed(42), Validation.map((n: number) => `val: ${n}`));
	expect(result).toStrictEqual({ kind: "Passed", value: "val: 42" });
});

// ---------------------------------------------------------------------------
// mapError
// ---------------------------------------------------------------------------

test("mapError: transforms errors in Failed", () => {
	const result = pipe(Validation.make.failed("oops"), Validation.mapError((e) => e.toUpperCase()));
	expect(result).toStrictEqual({ kind: "Failed", errors: ["OOPS"] });
});

test("mapError: transforms all errors in failedAll", () => {
	const result = pipe(Validation.make.failedAll(["a", "b"]), Validation.mapError((e) => e.toUpperCase()));
	expect(result).toStrictEqual({ kind: "Failed", errors: ["A", "B"] });
});

test("mapError: passes Passed through unchanged", () => {
	const result = pipe(Validation.make.passed(42), Validation.mapError((e: string) => e.toUpperCase()));
	expect(result).toStrictEqual({ kind: "Passed", value: 42 });
});

test("mapError: does not invoke transform on Passed", () => {
	let called = false;
	const result = pipe(
		Validation.make.passed(42),
		Validation.mapError(() => {
			called = true;
			return "new error";
		}),
	);
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Passed", value: 42 });
});

test("mapError: can change error type", () => {
	const result = pipe(Validation.make.failed("not found"), Validation.mapError((e) => ({ message: e })));
	expect(result).toStrictEqual({ kind: "Failed", errors: [{ message: "not found" }] });
});

// ---------------------------------------------------------------------------
// apply (error accumulation)
// ---------------------------------------------------------------------------

test("apply: applies Valid function to Valid value", () => {
	const add = (a: number) => (b: number) => a + b;
	const result = pipe(
		Validation.make.passed(add),
		Validation.apply(Validation.make.passed(5)),
		Validation.apply(Validation.make.passed(3)),
	);
	expect(result).toStrictEqual({ kind: "Passed", value: 8 });
});

test("apply: accumulates errors from both sides", () => {
	const add = (a: number) => (b: number) => a + b;
	const result = pipe(
		Validation.make.passed(add),
		Validation.apply(Validation.make.failed("bad a")),
		Validation.apply(Validation.make.failed("bad b")),
	);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["bad a", "bad b"] });
});

test("apply: returns errors from value when function is Valid", () => {
	const result = pipe(
		Validation.make.passed((n: number) => n * 2),
		Validation.apply(Validation.make.failed("bad value")),
	);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["bad value"] });
});

test("apply: returns errors from function when value is Valid", () => {
	const result = pipe(Validation.make.failed("bad fn"), Validation.apply(Validation.make.passed(5)));
	expect(result).toStrictEqual({ kind: "Failed", errors: ["bad fn"] });
});

test("apply: accumulates all errors in a multi-field validation", () => {
	const createUser = (name: string) => (email: string) => (age: number) => ({ name, email, age });

	const validateName = (name: string): Validation<string, string> =>
		name.length > 0 ? Validation.make.passed(name) : Validation.make.failed("Name required");
	const validateEmail = (email: string): Validation<string, string> =>
		email.includes("@") ? Validation.make.passed(email) : Validation.make.failed("Invalid email");
	const validateAge = (age: number): Validation<string, number> =>
		age >= 0 ? Validation.make.passed(age) : Validation.make.failed("Age must be >= 0");

	const result = pipe(
		Validation.make.passed(createUser),
		Validation.apply(validateName("")),
		Validation.apply(validateEmail("bad")),
		Validation.apply(validateAge(-5)),
	);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["Name required", "Invalid email", "Age must be >= 0"] });
});

test("apply: succeeds when all validations pass", () => {
	const createUser = (name: string) => (email: string) => (age: number) => ({ name, email, age });

	const result = pipe(
		Validation.make.passed(createUser),
		Validation.apply(Validation.make.passed("Alice")),
		Validation.apply(Validation.make.passed("alice@example.com")),
		Validation.apply(Validation.make.passed(30)),
	);
	expect(result).toStrictEqual({ kind: "Passed", value: { name: "Alice", email: "alice@example.com", age: 30 } });
});

// --- apply with combineErrors option ---

test("apply: uses combineErrors when accumulating errors", () => {
	const fnVal = constFalseBool() ? Validation.make.passed((n: number) => n * 2) : Validation.make.failed("err1");
	const argVal = constFalseBool() ? Validation.make.passed(5) : Validation.make.failed("err2");

	const concat = (e1: readonly [string, ...string[]], e2: readonly [string, ...string[]]) =>
		[...e1, ...e2].map((s) => s.toUpperCase()) as unknown as readonly [string, ...string[]];

	const result = pipe(fnVal, Validation.apply(argVal, { combineErrors: concat }));
	expect(result).toStrictEqual(Validation.make.failedAll(["ERR1", "ERR2"]));
});

test("apply: handles Passed fnVal with Passed or Failed argVal", () => {
	const fnVal = Validation.make.passed((n: number) => n * 2);
	const argPassed = Validation.make.passed(5);
	const argFailed = Validation.make.failed<string>("err1");

	const concat = (e1: readonly [string, ...string[]], e2: readonly [string, ...string[]]) => [...e1, ...e2] as any;

	expect(pipe(fnVal, Validation.apply(argPassed, { combineErrors: concat }))).toStrictEqual(Validation.make.passed(10));
	expect(pipe(fnVal, Validation.apply(argFailed, { combineErrors: concat }))).toStrictEqual(
		Validation.make.failed("err1"),
	);
});

test("apply: handles Failed fnVal with Passed argVal", () => {
	const fnVal = constFalseBool() ? Validation.make.passed((n: number) => n * 2) : Validation.make.failed("err1");
	const argPassed = Validation.make.passed(5);
	const concat = (e1: readonly [string, ...string[]], e2: readonly [string, ...string[]]) => [...e1, ...e2] as any;

	expect(pipe(fnVal, Validation.apply(argPassed, { combineErrors: concat }))).toStrictEqual(
		Validation.make.failed("err1"),
	);
});

// ---------------------------------------------------------------------------
// match (data-last)
// ---------------------------------------------------------------------------

test("match: calls passed handler for Valid", () => {
	const result = pipe(
		Validation.make.passed(5),
		Validation.match({ passed: (n: number) => `got ${n}`, failed: (errors) => `failed: ${errors.join(", ")}` }),
	);
	expect(result).toBe("got 5");
});

test("match: calls invalid handler for Invalid", () => {
	const result = pipe(
		Validation.make.failed("oops"),
		Validation.match({ passed: (n: number) => `got ${n}`, failed: (errors) => `failed: ${errors.join(", ")}` }),
	);
	expect(result).toBe("failed: oops");
});

test("match: is data-last (returns a function first)", () => {
	const handler = Validation.match<string, number, string>({
		passed: (n) => `val: ${n}`,
		failed: (errors) => `err: ${errors.join(";")}`,
	});
	expect(handler(Validation.make.passed(3))).toBe("val: 3");
	expect(handler(Validation.make.failed("x"))).toBe("err: x");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("getOrElse: returns value for Valid", () => {
	const result = pipe(Validation.make.passed(5), Validation.getOrElse(() => 0));
	expect(result).toBe(5);
});

test("getOrElse: returns default for Invalid", () => {
	const result = pipe(Validation.make.failed("error"), Validation.getOrElse(() => 0));
	expect(result).toBe(0);
});

test("getOrElse: widens return type to A | B when default is a different type", () => {
	const result = pipe(Validation.make.failed("error"), Validation.getOrElse(() => null));
	expect(result).toBeNull();
});

test("getOrElse: returns Valid value typed as A | B when Valid", () => {
	const result = pipe(Validation.make.passed(5), Validation.getOrElse(() => null));
	expect(result).toBe(5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("tap: executes side effect on Valid and returns original", () => {
	let sideEffect = 0;
	const result = pipe(
		Validation.make.passed(5),
		Validation.tap((n: number) => {
			sideEffect = n;
		}),
	);
	expect(sideEffect).toBe(5);
	expect(result).toStrictEqual({ kind: "Passed", value: 5 });
});

test("tap: does not execute side effect on Invalid", () => {
	let called = false;
	const result = pipe(
		Validation.make.failed("error"),
		Validation.tap((_n: number) => {
			called = true;
		}),
	);
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["error"] });
});

// ---------------------------------------------------------------------------
// tapError
// ---------------------------------------------------------------------------

test("tapError: calls f on Invalid", () => {
	let called = false;
	pipe(
		Validation.make.failed("err"),
		Validation.tapError(() => {
			called = true;
		}),
	);
	expect(called).toBe(true);
});

test("tapError: does not call f on Valid", () => {
	let called = false;
	pipe(
		Validation.make.passed(42),
		Validation.tapError(() => {
			called = true;
		}),
	);
	expect(called).toBe(false);
});

test("tapError: returns the Validation unchanged", () => {
	const data = Validation.make.failed("err");
	const result = pipe(data, Validation.tapError(() => {}));
	expect(result).toStrictEqual(data);
});

test("tapError: receives the full error list", () => {
	let received: readonly string[] | undefined;
	pipe(
		Validation.make.failedAll(["a", "b"]),
		Validation.tapError((errs) => {
			received = errs;
		}),
	);
	expect(received).toStrictEqual(["a", "b"]);
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test("recover: returns original Valid without calling fallback", () => {
	let called = false;
	const result = pipe(
		Validation.make.passed(5),
		Validation.recover((_errors) => {
			called = true;
			return Validation.make.passed(99);
		}),
	);
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Passed", value: 5 });
});

test("recover: provides fallback for Invalid", () => {
	const result = pipe(Validation.make.failed("error"), Validation.recover((_errors) => Validation.make.passed(99)));
	expect(result).toStrictEqual({ kind: "Passed", value: 99 });
});

test("recover: exposes the error list to the fallback", () => {
	let received: string[] = [];
	pipe(
		Validation.make.failedAll(["first", "second"]),
		Validation.recover((errors) => {
			received = [...errors];
			return Validation.make.passed(0);
		}),
	);
	expect(received).toStrictEqual(["first", "second"]);
});

test("recover: can return Invalid as fallback", () => {
	const result = pipe(
		Validation.make.failed("first"),
		Validation.recover((_errors) => Validation.make.failed("second")),
	);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["second"] });
});

test("recover: widens to Validation<E, A | B> when fallback returns a different type", () => {
	const result = pipe(
		Validation.make.failed("error"),
		Validation.recover((_errors) => Validation.make.passed("recovered")),
	);
	expect(result).toStrictEqual({ kind: "Passed", value: "recovered" });
});

test("recover: preserves Valid typed as Validation<E, A | B>", () => {
	const result = pipe(Validation.make.passed(5), Validation.recover((_errors) => Validation.make.passed("recovered")));
	expect(result).toStrictEqual({ kind: "Passed", value: 5 });
});

// ---------------------------------------------------------------------------
// recoverUnless
// ---------------------------------------------------------------------------

test("recoverUnless: recovers when predicate returns false for all errors", () => {
	const result = pipe(
		Validation.make.failed("recoverable"),
		Validation.recoverUnless((e) => e === "fatal", () => Validation.make.passed(42)),
	);
	expect(result).toStrictEqual({ kind: "Passed", value: 42 });
});

test("recoverUnless: does not recover when predicate returns true for any error", () => {
	const result = pipe(
		Validation.make.failed("fatal"),
		Validation.recoverUnless((e) => e === "fatal", () => Validation.make.passed(42)),
	);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["fatal"] });
});

test("recoverUnless: passes through Valid unchanged", () => {
	const result = pipe(
		Validation.make.passed(10),
		Validation.recoverUnless((e) => e === "fatal", () => Validation.make.passed(42)),
	);
	expect(result).toStrictEqual({ kind: "Passed", value: 10 });
});

test("recoverUnless: does not invoke isBlocked or fallback on Passed", () => {
	let isBlockedCalled = false;
	let fallbackCalled = false;
	const result = pipe(
		Validation.make.passed(10),
		Validation.recoverUnless(() => {
			isBlockedCalled = true;
			return false;
		}, () => {
			fallbackCalled = true;
			return Validation.make.passed(42);
		}),
	);
	expect(isBlockedCalled).toBe(false);
	expect(fallbackCalled).toBe(false);
	expect(result).toStrictEqual({ kind: "Passed", value: 10 });
});

test("recoverUnless: does not recover when any error in accumulation matches", () => {
	const result = pipe(
		Validation.make.failedAll(["minor", "fatal"]),
		Validation.recoverUnless((e) => e === "fatal", () => Validation.make.passed(42)),
	);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["minor", "fatal"] });
});

test("recoverUnless: widens to Validation<E, A | B> when fallback returns different type", () => {
	const result = pipe(
		Validation.make.failed("recoverable"),
		Validation.recoverUnless((e) => e === "fatal", () => Validation.make.passed("recovered")),
	);
	expect(result).toStrictEqual({ kind: "Passed", value: "recovered" });
});

// ---------------------------------------------------------------------------
// toResult
// ---------------------------------------------------------------------------

test("to.Result: converts Valid to Ok", () => {
	expect(Validation.to.Result(Validation.make.passed(42))).toStrictEqual({ kind: "Ok", value: 42 });
});

test("to.Result: converts Invalid to Err with error list", () => {
	expect(Validation.to.Result(Validation.make.failed("oops"))).toStrictEqual({ kind: "Err", error: ["oops"] });
});

test("to.Result: preserves all accumulated errors in Err", () => {
	expect(Validation.to.Result(Validation.make.failedAll(["a", "b", "c"]))).toStrictEqual({
		kind: "Err",
		error: ["a", "b", "c"],
	});
});

// ---------------------------------------------------------------------------
// toMaybe
// ---------------------------------------------------------------------------

test("to.Maybe: converts Valid to Some", () => {
	expect(Validation.to.Maybe(Validation.make.passed(42))).toStrictEqual({ kind: "Some", value: 42 });
});

test("to.Maybe: converts Invalid to None", () => {
	expect(Validation.to.Maybe(Validation.make.failed("oops"))).toStrictEqual({ kind: "None" });
});

test("to.Maybe: discards all errors on Invalid", () => {
	expect(Validation.to.Maybe(Validation.make.failedAll(["a", "b"]))).toStrictEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// fromResult
// ---------------------------------------------------------------------------

test("from.Result: converts Ok to Valid", () => {
	expect(Validation.from.Result(Result.make.ok(42))).toStrictEqual({ kind: "Passed", value: 42 });
});

test("from.Result: converts Err to Invalid with single-element error list", () => {
	expect(Validation.from.Result(Result.make.err("bad"))).toStrictEqual({ kind: "Failed", errors: ["bad"] });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("pipe: composes well in a pipeline", () => {
	const validateName = (name: string): Validation<string, string> =>
		name.length > 0 ? Validation.make.passed(name) : Validation.make.failed("Name required");
	const validateAge = (age: number): Validation<string, number> =>
		age >= 0 ? Validation.make.passed(age) : Validation.make.failed("Age must be >= 0");
	const build = (name: string) => (age: number) => ({ name, age });
	const result = pipe(
		Validation.make.passed(build),
		Validation.apply(validateName("Alice")),
		Validation.apply(validateAge(30)),
		Validation.map((user) => user.name),
		Validation.getOrElse(() => "unknown"),
	);
	expect(result).toBe("Alice");
});

// ---------------------------------------------------------------------------
// Type inference
// ---------------------------------------------------------------------------

test("map: return type reflects mapped function output", () => {
	const pure = Validation.make.passed(42);
	const pureMapped = Validation.map((n: number) => String(n))(pure);
	expect(pureMapped).toStrictEqual(Validation.make.passed("42"));
});

test("getOrElse: widens return type to union", () => {
	const v = Validation.make.passed("hello");
	const val = pipe(v, Validation.getOrElse((): null => null));
	expect(val).toBe("hello");
});

test("tap: preserves error channel type in pipelines", () => {
	const pure = Validation.make.passed(42);
	const resPure = pipe(
		pure,
		Validation.tap((n: number) => {
			expect(n).toBe(42);
		}),
	);
	expect(resPure).toStrictEqual(pure);
});

test("tapError: preserves value channel type in pipelines", () => {
	const v = constFalseBool() ? Validation.make.passed(42) : Validation.make.failed("err");
	const res = pipe(
		v,
		Validation.tapError((errs) => {
			expect(errs).toBeDefined();
		}),
	);
	expect(res).toBeDefined();
});

test("apply: infers error union properly in pipelines without options", () => {
	const pureFn = Validation.make.passed((n: number) => String(n));
	const pureArg = Validation.make.passed(123);
	const pureRes = pipe(pureFn, Validation.apply(pureArg));
	expect(pureRes).toStrictEqual(Validation.make.passed("123"));
});

test("apply: infers combined error type when combineErrors option is provided", () => {
	const fn = Validation.make.passed((n: number) => n * 2);
	const arg = Validation.make.passed(5);
	const res = pipe(
		fn,
		Validation.apply(arg, {
			combineErrors: (
				e1: readonly string[],
				e2: readonly number[],
			): readonly [string] => [`${e1.join(",")}-${e2.join(",")}`],
		}),
	);
	expect(res).toStrictEqual(Validation.make.passed(10));
});

// --- from.nullable ---

test("from.nullable: returns Valid for non-null values", () => {
	const result = Validation.from.nullable(() => "is null")(42);
	expect(result).toStrictEqual(Validation.make.passed(42));
});

test("from.nullable: does not invoke onNull on non-null values", () => {
	let called = false;
	const result = Validation.from.nullable(() => {
		called = true;
		return "is null";
	})(42);
	expect(called).toBe(false);
	expect(result).toStrictEqual(Validation.make.passed(42));
});

test("from.nullable: returns Invalid for null", () => {
	const result = Validation.from.nullable(() => "is null")(null);
	expect(result).toStrictEqual(Validation.make.failed("is null"));
});

test("from.nullable: returns Invalid for undefined", () => {
	const result = Validation.from.nullable(() => "is null")(undefined);
	expect(result).toStrictEqual(Validation.make.failed("is null"));
});

// --- fromMaybe ---

test("from.Maybe: returns Valid for Some", () => {
	const result = Validation.from.Maybe(() => "is none")(Maybe.make.some(42));
	expect(result).toStrictEqual(Validation.make.passed(42));
});

test("from.Maybe: does not invoke onNone on Some values", () => {
	let called = false;
	const result = Validation.from.Maybe(() => {
		called = true;
		return "is none";
	})(Maybe.make.some(42));
	expect(called).toBe(false);
	expect(result).toStrictEqual(Validation.make.passed(42));
});

test("from.Maybe: returns Invalid for None", () => {
	const result = Validation.from.Maybe(() => "is none")(Maybe.make.none());
	expect(result).toStrictEqual(Validation.make.failed("is none"));
});

// --- struct ---

test("struct: combines a record of Passed values into a single Passed record", () => {
	const res = Validation.struct({ a: Validation.make.passed(1), b: Validation.make.passed("hello") });
	expect(res).toStrictEqual(Validation.make.passed({ a: 1, b: "hello" }));
});

test("struct: accumulates errors from all Failed branches", () => {
	const res = Validation.struct({
		a: Validation.make.passed(1),
		b: Validation.make.failed("first fail"),
		c: Validation.make.failed("second fail"),
	});
	expect(res).toStrictEqual(Validation.make.failedAll(["first fail", "second fail"]));
});

test("struct: composes in a pipeline", () => {
	const res = pipe(
		Validation.make.passed({ name: "Alice" }),
		Validation.map((u) => u.name),
		Validation.match({
			passed: (name) =>
				Validation.struct({
					name: Validation.make.passed(name),
					valid: Validation.from.Predicate((n: string) => n.length > 0, () => "invalid")(name),
				}),
			failed: (errs) => Validation.make.failedAll(errs),
		}),
	);
	expect(res).toStrictEqual(Validation.make.passed({ name: "Alice", valid: "Alice" }));
});

test("struct: ignores inherited prototype properties", () => {
	const proto = { b: Validation.make.passed(2) };
	const fields = Object.create(proto);
	fields.a = Validation.make.passed(1);
	const res = Validation.struct(fields);
	expect(res).toStrictEqual(Validation.make.passed({ a: 1 }));
});

test("struct: returns passed({}) when given an empty object", () => {
	const res = Validation.struct({});
	expect(res).toStrictEqual(Validation.make.passed({}));
});

// --- to.Result with combineErrors ---

test("to.Result: converts Passed to Ok with combineErrors", () => {
	const res = Validation.to.Result((errs: readonly string[]) => errs.join(", "))(Validation.make.passed(42));
	expect(res).toStrictEqual(Result.make.ok(42));
});

test("to.Result: does not invoke combineErrors on Passed", () => {
	let called = false;
	const res = Validation.to.Result((errs: readonly string[]) => {
		called = true;
		return errs.join(", ");
	})(Validation.make.passed(42));
	expect(called).toBe(false);
	expect(res).toStrictEqual(Result.make.ok(42));
});

test("to.Result: converts Failed to Err with combined errors", () => {
	const res = Validation.to.Result((errs: readonly string[]) => errs.join("; "))(
		Validation.make.failedAll(["err1", "err2"]),
	);
	expect(res).toStrictEqual(Result.make.err("err1; err2"));
});

test("tryCatch: returns Passed when thunk succeeds", () => {
	const res = Validation.tryCatch(() => 42, { onError: String });
	expect(res).toStrictEqual(Validation.make.passed(42));
});

test("tryCatch: returns Failed when thunk throws", () => {
	const res = Validation.tryCatch(() => {
		throw new Error("BOOM");
	}, { onError: (e) => (e as Error).message });
	expect(res).toStrictEqual(Validation.make.failed("BOOM"));
});

// ---------------------------------------------------------------------------
// Validation.keyed
// ---------------------------------------------------------------------------

test("keyed.make: runs validators on object fields", () => {
	const validateUser = Validation.keyed.make({
		name: (s: string) => s.length > 0 ? Validation.make.passed(s) : Validation.make.failed("Name required"),
		age: (n: number) => n >= 18 ? Validation.make.passed(n) : Validation.make.failed("Must be 18+"),
	});

	const success = validateUser({ name: "Alice", age: 30 });
	expect(success.name).toStrictEqual(Validation.make.passed("Alice"));
	expect(success.age).toStrictEqual(Validation.make.passed(30));

	const failure = validateUser({ name: "", age: 16 });
	expect(failure.name).toStrictEqual(Validation.make.failed("Name required"));
	expect(failure.age).toStrictEqual(Validation.make.failed("Must be 18+"));
});

test("keyed.is.passed: narrows and returns true when all fields passed", () => {
	const validateUser = Validation.keyed.make({
		name: (s: string) => s.length > 0 ? Validation.make.passed(s) : Validation.make.failed("Name required"),
		age: (n: number) => n >= 18 ? Validation.make.passed(n) : Validation.make.failed("Must be 18+"),
	});

	const success = validateUser({ name: "Alice", age: 30 });
	expect(Validation.keyed.is.passed(success)).toBe(true);
	expect((success as Record<string, Validation<unknown, unknown>>).name.kind).toBe("Passed");
	expect((success as Record<string, Validation<unknown, unknown>>).age.kind).toBe("Passed");

	const failure = validateUser({ name: "Alice", age: 16 });
	expect(Validation.keyed.is.passed(failure)).toBe(false);
});

test("keyed.is.failed: returns true when at least one field failed", () => {
	const validateUser = Validation.keyed.make({
		name: (s: string) => s.length > 0 ? Validation.make.passed(s) : Validation.make.failed("Name required"),
		age: (n: number) => n >= 18 ? Validation.make.passed(n) : Validation.make.failed("Must be 18+"),
	});

	const success = validateUser({ name: "Alice", age: 30 });
	expect(Validation.keyed.is.failed(success)).toBe(false);

	const failure = validateUser({ name: "", age: 30 });
	expect(Validation.keyed.is.failed(failure)).toBe(true);
});

test("keyed.getPassed: returns Some when all passed and None when any failed", () => {
	const validateUser = Validation.keyed.make({
		name: (s: string) => s.length > 0 ? Validation.make.passed(s) : Validation.make.failed("Name required"),
		age: (n: number) => n >= 18 ? Validation.make.passed(n) : Validation.make.failed("Must be 18+"),
	});

	const success = validateUser({ name: "Alice", age: 30 });
	expect(Validation.keyed.getPassed(success)).toStrictEqual(Maybe.make.some({ name: "Alice", age: 30 }));

	const failure = validateUser({ name: "", age: 30 });
	expect(Validation.keyed.getPassed(failure)).toStrictEqual(Maybe.make.none());
});

test("keyed.getErrors: returns Some with field errors on failure and None on success", () => {
	const validateUser = Validation.keyed.make({
		name: (s: string) => s.length > 0 ? Validation.make.passed(s) : Validation.make.failed("Name required"),
		age: (n: number) => n >= 18 ? Validation.make.passed(n) : Validation.make.failed("Must be 18+"),
	});

	const success = validateUser({ name: "Alice", age: 30 });
	expect(Validation.keyed.getErrors(success)).toStrictEqual(Maybe.make.none());

	const partialFailure = validateUser({ name: "", age: 30 });
	expect(Validation.keyed.getErrors(partialFailure)).toStrictEqual(Maybe.make.some({ name: ["Name required"] }));

	const fullFailure = validateUser({ name: "", age: 16 });
	expect(Validation.keyed.getErrors(fullFailure)).toStrictEqual(
		Maybe.make.some({ name: ["Name required"], age: ["Must be 18+"] }),
	);
});

test("keyed: integrates seamlessly with struct", () => {
	const validateUser = Validation.keyed.make({
		name: (s: string) => s.length > 0 ? Validation.make.passed(s) : Validation.make.failed("Name required"),
		age: (n: number) => n >= 18 ? Validation.make.passed(n) : Validation.make.failed("Must be 18+"),
	});

	const success = pipe({ name: "Alice", age: 30 }, validateUser, Validation.struct);
	expect(success).toStrictEqual(Validation.make.passed({ name: "Alice", age: 30 }));

	const failure = pipe({ name: "", age: 16 }, validateUser, Validation.struct);
	expect(failure).toStrictEqual(Validation.make.failedAll(["Name required", "Must be 18+"]));
});

test("keyed: handles empty objects", () => {
	const emptyValidator = Validation.keyed.make({});
	const res = emptyValidator({});
	expect(Validation.keyed.is.passed(res)).toBe(true);
	expect(Validation.keyed.is.failed(res)).toBe(false);
	expect(Validation.keyed.getPassed(res)).toStrictEqual(Maybe.make.some({}));
	expect(Validation.keyed.getErrors(res)).toStrictEqual(Maybe.make.none());
});

test("keyed: ignores inherited prototype properties across all helpers", () => {
	const protoValidators = { b: (n: number) => Validation.make.passed(n * 2) };
	const validators = Object.create(protoValidators);
	validators.a = (s: string) => Validation.make.passed(s.toUpperCase());
	const validate = Validation.keyed.make(validators);
	const res = validate({ a: "hello" } as any);
	expect(res).toStrictEqual({ a: Validation.make.passed("HELLO") });

	const protoKeyed = { b: Validation.make.failed("fail") };
	const keyedObj = Object.create(protoKeyed);
	keyedObj.a = Validation.make.passed("ok");

	expect(Validation.keyed.is.passed(keyedObj)).toBe(true);
	expect(Validation.keyed.is.failed(keyedObj)).toBe(false);
	expect(Validation.keyed.getPassed(keyedObj)).toStrictEqual(Maybe.make.some({ a: "ok" }));
	expect(Validation.keyed.getErrors(keyedObj)).toStrictEqual(Maybe.make.none());
});

test("struct: safely handles __proto__ property without prototype pollution", () => {
	const protoFields: Record<string, Validation<unknown, unknown>> = {};
	Object.defineProperty(protoFields, "__proto__", {
		value: Validation.make.passed({ polluted: true }),
		enumerable: true,
		configurable: true,
		writable: true,
	});
	protoFields.a = Validation.make.passed(1);

	const res = Validation.struct(protoFields);
	expect(Validation.is.passed(res)).toBe(true);
	const value = Validation.getOrElse(() => ({}) as Record<string, unknown>)(res);
	expect(Object.hasOwn(value, "__proto__")).toBe(true);
	expect(({} as Record<string, unknown>).polluted).toBeUndefined();
});
