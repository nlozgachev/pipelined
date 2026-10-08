import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Maybe } from "../Maybe.ts";
import { Result } from "../Result.ts";
import { Validation } from "../Validation.ts";

// ---------------------------------------------------------------------------
// passed
// ---------------------------------------------------------------------------

test("make.passed: wraps a value in Valid", () => {
	const result = Validation.make.passed<string, number>(42);
	expect(result).toStrictEqual({ kind: "Passed", value: 42 });
});

// ---------------------------------------------------------------------------
// isPassed
// ---------------------------------------------------------------------------

test("is.passed: returns true for Valid", () => {
	expect(Validation.is.passed(Validation.make.passed<string, number>(1))).toBe(true);
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
	expect(Validation.is.failed(Validation.make.passed<string, number>(1))).toBe(false);
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

test("from.Predicate: composes with apply for multi-field validation", () => {
	const validateName = Validation.from.Predicate((s: string) => s.length > 0, () => "Name required");
	const validateAge = Validation.from.Predicate((n: number) => n >= 0, () => "Age invalid");
	const result = pipe(
		Validation.make.passed<string, (name: string) => (age: number) => { name: string; age: number; }>(
			(name: string) => (age: number) => ({ name, age })
		),
		Validation.apply(validateName("")),
		Validation.apply(validateAge(-1)),
	);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["Name required", "Age invalid"] });
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("map: transforms the passed value", () => {
	const result = pipe(Validation.make.passed<string, number>(5), Validation.map((n: number) => n * 2));
	expect(result).toStrictEqual({ kind: "Passed", value: 10 });
});

test("map: passes through Invalid unchanged", () => {
	const result = pipe(Validation.make.failed("error"), Validation.map((n: number) => n * 2));
	expect(result).toStrictEqual({ kind: "Failed", errors: ["error"] });
});

test("map: can change the value type", () => {
	const result = pipe(Validation.make.passed<string, number>(42), Validation.map((n: number) => `val: ${n}`));
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
	const result = pipe(Validation.make.passed<string, number>(42), Validation.mapError((e: string) => e.toUpperCase()));
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
		Validation.make.passed<string, typeof add>(add),
		Validation.apply(Validation.make.passed<string, number>(5)),
		Validation.apply(Validation.make.passed<string, number>(3)),
	);
	expect(result).toStrictEqual({ kind: "Passed", value: 8 });
});

test("apply: accumulates errors from both sides", () => {
	const add = (a: number) => (b: number) => a + b;
	const result = pipe(
		Validation.make.passed<string, typeof add>(add),
		Validation.apply(Validation.make.failed("bad a")),
		Validation.apply(Validation.make.failed("bad b")),
	);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["bad a", "bad b"] });
});

test("apply: returns errors from value when function is Valid", () => {
	const result = pipe(
		Validation.make.passed<string, (n: number) => number>((n) => n * 2),
		Validation.apply(Validation.make.failed("bad value")),
	);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["bad value"] });
});

test("apply: returns errors from function when value is Valid", () => {
	const result = pipe(Validation.make.failed("bad fn"), Validation.apply(Validation.make.passed<string, number>(5)));
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
		Validation.make.passed<string, typeof createUser>(createUser),
		Validation.apply(validateName("")),
		Validation.apply(validateEmail("bad")),
		Validation.apply(validateAge(-5)),
	);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["Name required", "Invalid email", "Age must be >= 0"] });
});

test("apply: succeeds when all validations pass", () => {
	const createUser = (name: string) => (email: string) => (age: number) => ({ name, email, age });

	const result = pipe(
		Validation.make.passed<string, typeof createUser>(createUser),
		Validation.apply(Validation.make.passed<string, string>("Alice")),
		Validation.apply(Validation.make.passed<string, string>("alice@example.com")),
		Validation.apply(Validation.make.passed<string, number>(30)),
	);
	expect(result).toStrictEqual({ kind: "Passed", value: { name: "Alice", email: "alice@example.com", age: 30 } });
});

// --- apply with combineErrors option ---

test("apply: uses combineErrors when accumulating errors", () => {
	const fnVal = Validation.make.failed<string>("err1") as Validation<string, (n: number) => number>;
	const argVal = Validation.make.failed<string>("err2") as Validation<string, number>;

	const concat = (e1: readonly [string, ...string[]], e2: readonly [string, ...string[]]) =>
		[...e1, ...e2].map((s) => s.toUpperCase()) as unknown as readonly [string, ...string[]];

	const result = pipe(fnVal, Validation.apply(argVal, { combineErrors: concat }));
	expect(result).toStrictEqual(Validation.make.failedAll(["ERR1", "ERR2"]));
});

test("apply: handles Passed fnVal with Passed or Failed argVal", () => {
	const fnVal = Validation.make.passed<string, (n: number) => number>((n) => n * 2);
	const argPassed = Validation.make.passed<string, number>(5);
	const argFailed = Validation.make.failed<string>("err1");

	const concat = (e1: readonly [string, ...string[]], e2: readonly [string, ...string[]]) => [...e1, ...e2] as any;

	expect(pipe(fnVal, Validation.apply(argPassed, { combineErrors: concat }))).toStrictEqual(Validation.make.passed(10));
	expect(pipe(fnVal, Validation.apply(argFailed, { combineErrors: concat }))).toStrictEqual(
		Validation.make.failed("err1"),
	);
});

test("apply: handles Failed fnVal with Passed argVal", () => {
	const fnVal = Validation.make.failed<string>("err1") as Validation<string, (n: number) => number>;
	const argPassed = Validation.make.passed<string, number>(5);
	const concat = (e1: readonly [string, ...string[]], e2: readonly [string, ...string[]]) => [...e1, ...e2] as any;

	expect(pipe(fnVal, Validation.apply(argPassed, { combineErrors: concat }))).toStrictEqual(
		Validation.make.failed("err1"),
	);
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("fold: calls onValid for Valid", () => {
	const result = pipe(
		Validation.make.passed<string, number>(5),
		Validation.fold((errors) => `Errors: ${errors.join(", ")}`, (n: number) => `Value: ${n}`),
	);
	expect(result).toBe("Value: 5");
});

test("fold: calls onInvalid for Invalid", () => {
	const result = pipe(
		Validation.make.failedAll(["a", "b"]),
		Validation.fold((errors) => `Errors: ${errors.join(", ")}`, (n: number) => `Value: ${n}`),
	);
	expect(result).toBe("Errors: a, b");
});

// ---------------------------------------------------------------------------
// match (data-last)
// ---------------------------------------------------------------------------

test("match: calls passed handler for Valid", () => {
	const result = pipe(
		Validation.make.passed<string, number>(5),
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
	const result = pipe(Validation.make.passed<string, number>(5), Validation.getOrElse(() => 0));
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
		Validation.make.passed<string, number>(5),
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
		Validation.make.passed<string, number>(5),
		Validation.recover((_errors) => {
			called = true;
			return Validation.make.passed<string, number>(99);
		}),
	);
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Passed", value: 5 });
});

test("recover: provides fallback for Invalid", () => {
	const result = pipe(
		Validation.make.failed("error"),
		Validation.recover((_errors) => Validation.make.passed<string, number>(99)),
	);
	expect(result).toStrictEqual({ kind: "Passed", value: 99 });
});

test("recover: exposes the error list to the fallback", () => {
	let received: string[] = [];
	pipe(
		Validation.make.failedAll(["first", "second"] as [string, ...string[]]),
		Validation.recover((errors) => {
			received = [...errors];
			return Validation.make.passed<string, number>(0);
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
		Validation.recoverUnless((e) => e === "fatal", () => Validation.make.passed<string, number>(42)),
	);
	expect(result).toStrictEqual({ kind: "Passed", value: 42 });
});

test("recoverUnless: does not recover when predicate returns true for any error", () => {
	const result = pipe(
		Validation.make.failed("fatal"),
		Validation.recoverUnless((e) => e === "fatal", () => Validation.make.passed<string, number>(42)),
	);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["fatal"] });
});

test("recoverUnless: passes through Valid unchanged", () => {
	const result = pipe(
		Validation.make.passed<string, number>(10),
		Validation.recoverUnless((e) => e === "fatal", () => Validation.make.passed<string, number>(42)),
	);
	expect(result).toStrictEqual({ kind: "Passed", value: 10 });
});

test("recoverUnless: does not recover when any error in accumulation matches", () => {
	const result = pipe(
		Validation.make.failedAll(["minor", "fatal"]),
		Validation.recoverUnless((e) => e === "fatal", () => Validation.make.passed<string, number>(42)),
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
// product
// ---------------------------------------------------------------------------

test("product: returns tuple when both are Valid", () => {
	const result = Validation.product(
		Validation.make.passed<string, string>("alice"),
		Validation.make.passed<string, number>(30),
	);
	expect(result).toStrictEqual({ kind: "Passed", value: ["alice", 30] });
});

test("product: returns Invalid when first is Invalid", () => {
	const result = Validation.product(Validation.make.failed("err1"), Validation.make.passed<string, number>(30));
	expect(result).toStrictEqual({ kind: "Failed", errors: ["err1"] });
});

test("product: returns Invalid when second is Invalid", () => {
	const result = Validation.product(Validation.make.passed<string, string>("alice"), Validation.make.failed("err2"));
	expect(result).toStrictEqual({ kind: "Failed", errors: ["err2"] });
});

test("product: accumulates errors when both are Invalid", () => {
	const result = Validation.product(Validation.make.failed("err1"), Validation.make.failed("err2"));
	expect(result).toStrictEqual({ kind: "Failed", errors: ["err1", "err2"] });
});

test("product: accumulates multiple errors from both sides", () => {
	const result = Validation.product(Validation.make.failedAll(["a", "b"]), Validation.make.failedAll(["c"]));
	expect(result).toStrictEqual({ kind: "Failed", errors: ["a", "b", "c"] });
});

test("product: can combine different value types", () => {
	const result = Validation.product(
		Validation.make.passed<string, string>("hello"),
		Validation.make.passed<string, boolean>(true),
	);
	expect(result).toStrictEqual({ kind: "Passed", value: ["hello", true] });
});

// ---------------------------------------------------------------------------
// productAll
// ---------------------------------------------------------------------------

test("productAll: returns all values when all are Valid", () => {
	const result = Validation.productAll([
		Validation.make.passed<string, number>(1),
		Validation.make.passed<string, number>(2),
		Validation.make.passed<string, number>(3),
	]);
	expect(result).toStrictEqual({ kind: "Passed", value: [1, 2, 3] });
});

test("productAll: accumulates all errors", () => {
	const result = Validation.productAll([
		Validation.make.failed("err1"),
		Validation.make.passed<string, number>(2),
		Validation.make.failed("err2"),
	]);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["err1", "err2"] });
});

test("productAll: accumulates all errors when all are Invalid", () => {
	const result = Validation.productAll([
		Validation.make.failed("a"),
		Validation.make.failed("b"),
		Validation.make.failed("c"),
	]);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["a", "b", "c"] });
});

test("productAll: returns singleton array with single element", () => {
	const result = Validation.productAll([Validation.make.passed<string, number>(42)]);
	expect(result).toStrictEqual({ kind: "Passed", value: [42] });
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
		Validation.make.passed<string, typeof build>(build),
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
	const v: Validation<string, number> = Validation.make.passed(42);
	const mapped = Validation.map((n: number) => String(n))(v);
	expectTypeOf(mapped).toEqualTypeOf<Validation<string, string>>();
});

test("getOrElse: widens return type to union", () => {
	const v = Validation.make.passed<string, string>("hello");
	const val = pipe(v, Validation.getOrElse((): null => null));
	expectTypeOf(val).toEqualTypeOf<string | null>();
});

test("fold: return type matches branch return types", () => {
	const v: Validation<string, number> = Validation.make.passed(1);
	const folded = Validation.fold(
		(errors: readonly string[]): string => errors.join(","),
		(n: number): string => String(n),
	)(v);
	expectTypeOf(folded).toBeString();
});

// --- from.nullable ---

test("from.nullable: returns Valid for non-null values", () => {
	const result = Validation.from.nullable(() => "is null")(42);
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
		Validation.make.passed<string, { name: string; }>({ name: "Alice" }),
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

	if (Validation.keyed.is.passed(success)) {
		expectTypeOf(success.name).toEqualTypeOf<Validation.Passed<string>>();
		expectTypeOf(success.age).toEqualTypeOf<Validation.Passed<number>>();
	}

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
