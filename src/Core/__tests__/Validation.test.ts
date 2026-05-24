import { pipe } from "#composition";
import { Maybe, Result, Validation } from "#core";
import { expect, expectTypeOf, test } from "vitest";

// ---------------------------------------------------------------------------
// passed
// ---------------------------------------------------------------------------

test("Validation.passed wraps a value in Valid", () => {
	const result = Validation.passed<string, number>(42);
	expect(result).toStrictEqual({ kind: "Passed", value: 42 });
});

// ---------------------------------------------------------------------------
// isPassed
// ---------------------------------------------------------------------------

test("Validation.isPassed returns true for Valid", () => {
	expect(Validation.isPassed(Validation.passed<string, number>(1))).toBe(true);
});

test("Validation.isPassed returns false for Invalid", () => {
	expect(Validation.isPassed(Validation.failed("err"))).toBe(false);
});

// ---------------------------------------------------------------------------
// failedAll / isFailed
// ---------------------------------------------------------------------------

test("Validation.failedAll creates an Invalid with errors array", () => {
	expect(Validation.failedAll(["error1", "error2"])).toStrictEqual({ kind: "Failed", errors: ["error1", "error2"] });
});

test("Validation.isFailed returns true for Invalid", () => {
	expect(Validation.isFailed(Validation.failed(["e"]))).toBe(true);
});

test("Validation.isFailed returns false for Valid", () => {
	expect(Validation.isFailed(Validation.passed<string, number>(1))).toBe(false);
});

// ---------------------------------------------------------------------------
// failed
// ---------------------------------------------------------------------------

test("Validation.failed creates an Invalid from a single error", () => {
	expect(Validation.failed("oops")).toStrictEqual({ kind: "Failed", errors: ["oops"] });
});

// ---------------------------------------------------------------------------
// fromPredicate
// ---------------------------------------------------------------------------

test("Validation.fromPredicate returns Valid when predicate passes", () => {
	expect(pipe("Alice", Validation.fromPredicate((s) => s.length > 0, () => "required"))).toStrictEqual({
		kind: "Passed",
		value: "Alice",
	});
});

test("Validation.fromPredicate returns Invalid when predicate fails", () => {
	expect(pipe("", Validation.fromPredicate((s) => s.length > 0, () => "required"))).toStrictEqual({
		kind: "Failed",
		errors: ["required"],
	});
});

test("Validation.fromPredicate passes the value to onFalse", () => {
	expect(pipe(-1, Validation.fromPredicate((n) => n >= 0, (n) => `${n} is negative`))).toStrictEqual({
		kind: "Failed",
		errors: ["-1 is negative"],
	});
});

test("Validation.fromPredicate composes with ap for multi-field validation", () => {
	const validateName = Validation.fromPredicate((s: string) => s.length > 0, () => "Name required");
	const validateAge = Validation.fromPredicate((n: number) => n >= 0, () => "Age invalid");
	const result = pipe(
		Validation.passed<string, (name: string) => (age: number) => { name: string; age: number; }>(
			(name: string) => (age: number) => ({ name, age })
		),
		Validation.ap(validateName("")),
		Validation.ap(validateAge(-1)),
	);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["Name required", "Age invalid"] });
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("Validation.map transforms the passed value", () => {
	const result = pipe(Validation.passed<string, number>(5), Validation.map((n: number) => n * 2));
	expect(result).toStrictEqual({ kind: "Passed", value: 10 });
});

test("Validation.map passes through Invalid unchanged", () => {
	const result = pipe(Validation.failed("error"), Validation.map((n: number) => n * 2));
	expect(result).toStrictEqual({ kind: "Failed", errors: ["error"] });
});

test("Validation.map can change the value type", () => {
	const result = pipe(Validation.passed<string, number>(42), Validation.map((n: number) => `val: ${n}`));
	expect(result).toStrictEqual({ kind: "Passed", value: "val: 42" });
});

// ---------------------------------------------------------------------------
// mapError
// ---------------------------------------------------------------------------

test("Validation.mapError transforms errors in Failed", () => {
	const result = pipe(Validation.failed("oops"), Validation.mapError((e) => e.toUpperCase()));
	expect(result).toStrictEqual({ kind: "Failed", errors: ["OOPS"] });
});

test("Validation.mapError transforms all errors in failedAll", () => {
	const result = pipe(Validation.failedAll(["a", "b"]), Validation.mapError((e) => e.toUpperCase()));
	expect(result).toStrictEqual({ kind: "Failed", errors: ["A", "B"] });
});

test("Validation.mapError passes Passed through unchanged", () => {
	const result = pipe(Validation.passed<string, number>(42), Validation.mapError((e: string) => e.toUpperCase()));
	expect(result).toStrictEqual({ kind: "Passed", value: 42 });
});

test("Validation.mapError can change error type", () => {
	const result = pipe(Validation.failed("not found"), Validation.mapError((e) => ({ message: e })));
	expect(result).toStrictEqual({ kind: "Failed", errors: [{ message: "not found" }] });
});

// ---------------------------------------------------------------------------
// ap (error accumulation)
// ---------------------------------------------------------------------------

test("Validation.ap applies Valid function to Valid value", () => {
	const add = (a: number) => (b: number) => a + b;
	const result = pipe(
		Validation.passed<string, typeof add>(add),
		Validation.ap(Validation.passed<string, number>(5)),
		Validation.ap(Validation.passed<string, number>(3)),
	);
	expect(result).toStrictEqual({ kind: "Passed", value: 8 });
});

test("Validation.ap accumulates errors from both sides", () => {
	const add = (a: number) => (b: number) => a + b;
	const result = pipe(
		Validation.passed<string, typeof add>(add),
		Validation.ap(Validation.failed("bad a")),
		Validation.ap(Validation.failed("bad b")),
	);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["bad a", "bad b"] });
});

test("Validation.ap returns errors from value when function is Valid", () => {
	const result = pipe(
		Validation.passed<string, (n: number) => number>((n) => n * 2),
		Validation.ap(Validation.failed("bad value")),
	);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["bad value"] });
});

test("Validation.ap returns errors from function when value is Valid", () => {
	const result = pipe(Validation.failed("bad fn"), Validation.ap(Validation.passed<string, number>(5)));
	expect(result).toStrictEqual({ kind: "Failed", errors: ["bad fn"] });
});

test("Validation.ap accumulates all errors in a multi-field validation", () => {
	const createUser = (name: string) => (email: string) => (age: number) => ({ name, email, age });

	const validateName = (name: string): Validation<string, string> =>
		name.length > 0 ? Validation.passed(name) : Validation.failed("Name required");
	const validateEmail = (email: string): Validation<string, string> =>
		email.includes("@") ? Validation.passed(email) : Validation.failed("Invalid email");
	const validateAge = (age: number): Validation<string, number> =>
		age >= 0 ? Validation.passed(age) : Validation.failed("Age must be >= 0");

	const result = pipe(
		Validation.passed<string, typeof createUser>(createUser),
		Validation.ap(validateName("")),
		Validation.ap(validateEmail("bad")),
		Validation.ap(validateAge(-5)),
	);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["Name required", "Invalid email", "Age must be >= 0"] });
});

test("Validation.ap succeeds when all validations pass", () => {
	const createUser = (name: string) => (email: string) => (age: number) => ({ name, email, age });

	const result = pipe(
		Validation.passed<string, typeof createUser>(createUser),
		Validation.ap(Validation.passed<string, string>("Alice")),
		Validation.ap(Validation.passed<string, string>("alice@example.com")),
		Validation.ap(Validation.passed<string, number>(30)),
	);
	expect(result).toStrictEqual({ kind: "Passed", value: { name: "Alice", email: "alice@example.com", age: 30 } });
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("Validation.fold calls onValid for Valid", () => {
	const result = pipe(
		Validation.passed<string, number>(5),
		Validation.fold((errors) => `Errors: ${errors.join(", ")}`, (n: number) => `Value: ${n}`),
	);
	expect(result).toBe("Value: 5");
});

test("Validation.fold calls onInvalid for Invalid", () => {
	const result = pipe(
		Validation.failedAll(["a", "b"]),
		Validation.fold((errors) => `Errors: ${errors.join(", ")}`, (n: number) => `Value: ${n}`),
	);
	expect(result).toBe("Errors: a, b");
});

// ---------------------------------------------------------------------------
// match (data-last)
// ---------------------------------------------------------------------------

test("Validation.match calls passed handler for Valid", () => {
	const result = pipe(
		Validation.passed<string, number>(5),
		Validation.match({ passed: (n: number) => `got ${n}`, failed: (errors) => `failed: ${errors.join(", ")}` }),
	);
	expect(result).toBe("got 5");
});

test("Validation.match calls invalid handler for Invalid", () => {
	const result = pipe(
		Validation.failed("oops"),
		Validation.match({ passed: (n: number) => `got ${n}`, failed: (errors) => `failed: ${errors.join(", ")}` }),
	);
	expect(result).toBe("failed: oops");
});

test("Validation.match is data-last (returns a function first)", () => {
	const handler = Validation.match<string, number, string>({
		passed: (n) => `val: ${n}`,
		failed: (errors) => `err: ${errors.join(";")}`,
	});
	expect(handler(Validation.passed(3))).toBe("val: 3");
	expect(handler(Validation.failed("x"))).toBe("err: x");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("Validation.getOrElse returns value for Valid", () => {
	const result = pipe(Validation.passed<string, number>(5), Validation.getOrElse(() => 0));
	expect(result).toBe(5);
});

test("Validation.getOrElse returns default for Invalid", () => {
	const result = pipe(Validation.failed("error"), Validation.getOrElse(() => 0));
	expect(result).toBe(0);
});

test("Validation.getOrElse widens return type to A | B when default is a different type", () => {
	const result = pipe(Validation.failed("error"), Validation.getOrElse(() => null));
	expect(result).toBeNull();
});

test("Validation.getOrElse returns Valid value typed as A | B when Valid", () => {
	const result = pipe(Validation.passed(5), Validation.getOrElse(() => null));
	expect(result).toBe(5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("Validation.tap executes side effect on Valid and returns original", () => {
	let sideEffect = 0;
	const result = pipe(
		Validation.passed<string, number>(5),
		Validation.tap((n: number) => {
			sideEffect = n;
		}),
	);
	expect(sideEffect).toBe(5);
	expect(result).toStrictEqual({ kind: "Passed", value: 5 });
});

test("Validation.tap does not execute side effect on Invalid", () => {
	let called = false;
	const result = pipe(
		Validation.failed("error"),
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

test("Validation.tapError calls f on Invalid", () => {
	let called = false;
	pipe(
		Validation.failed("err"),
		Validation.tapError(() => {
			called = true;
		}),
	);
	expect(called).toBe(true);
});

test("Validation.tapError does not call f on Valid", () => {
	let called = false;
	pipe(
		Validation.passed(42),
		Validation.tapError(() => {
			called = true;
		}),
	);
	expect(called).toBe(false);
});

test("Validation.tapError returns the Validation unchanged", () => {
	const data = Validation.failed("err");
	const result = pipe(data, Validation.tapError(() => {}));
	expect(result).toStrictEqual(data);
});

test("Validation.tapError receives the full error list", () => {
	let received: readonly string[] | undefined;
	pipe(
		Validation.failedAll(["a", "b"]),
		Validation.tapError((errs) => {
			received = errs;
		}),
	);
	expect(received).toStrictEqual(["a", "b"]);
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test("Validation.recover returns original Valid without calling fallback", () => {
	let called = false;
	const result = pipe(
		Validation.passed<string, number>(5),
		Validation.recover((_errors) => {
			called = true;
			return Validation.passed<string, number>(99);
		}),
	);
	expect(called).toBe(false);
	expect(result).toStrictEqual({ kind: "Passed", value: 5 });
});

test("Validation.recover provides fallback for Invalid", () => {
	const result = pipe(
		Validation.failed("error"),
		Validation.recover((_errors) => Validation.passed<string, number>(99)),
	);
	expect(result).toStrictEqual({ kind: "Passed", value: 99 });
});

test("Validation.recover exposes the error list to the fallback", () => {
	let received: string[] = [];
	pipe(
		Validation.failedAll(["first", "second"] as [string, ...string[]]),
		Validation.recover((errors) => {
			received = [...errors];
			return Validation.passed<string, number>(0);
		}),
	);
	expect(received).toStrictEqual(["first", "second"]);
});

test("Validation.recover can return Invalid as fallback", () => {
	const result = pipe(Validation.failed("first"), Validation.recover((_errors) => Validation.failed("second")));
	expect(result).toStrictEqual({ kind: "Failed", errors: ["second"] });
});

test("Validation.recover widens to Validation<E, A | B> when fallback returns a different type", () => {
	const result = pipe(Validation.failed("error"), Validation.recover((_errors) => Validation.passed("recovered")));
	expect(result).toStrictEqual({ kind: "Passed", value: "recovered" });
});

test("Validation.recover preserves Valid typed as Validation<E, A | B>", () => {
	const result = pipe(Validation.passed(5), Validation.recover((_errors) => Validation.passed("recovered")));
	expect(result).toStrictEqual({ kind: "Passed", value: 5 });
});

// ---------------------------------------------------------------------------
// recoverUnless
// ---------------------------------------------------------------------------

test("Validation.recoverUnless recovers when predicate returns false for all errors", () => {
	const result = pipe(
		Validation.failed("recoverable"),
		Validation.recoverUnless((e) => e === "fatal", () => Validation.passed<string, number>(42)),
	);
	expect(result).toStrictEqual({ kind: "Passed", value: 42 });
});

test("Validation.recoverUnless does NOT recover when predicate returns true for any error", () => {
	const result = pipe(
		Validation.failed("fatal"),
		Validation.recoverUnless((e) => e === "fatal", () => Validation.passed<string, number>(42)),
	);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["fatal"] });
});

test("Validation.recoverUnless passes through Valid unchanged", () => {
	const result = pipe(
		Validation.passed<string, number>(10),
		Validation.recoverUnless((e) => e === "fatal", () => Validation.passed<string, number>(42)),
	);
	expect(result).toStrictEqual({ kind: "Passed", value: 10 });
});

test("Validation.recoverUnless does NOT recover when any error in accumulation matches", () => {
	const result = pipe(
		Validation.failedAll(["minor", "fatal"]),
		Validation.recoverUnless((e) => e === "fatal", () => Validation.passed<string, number>(42)),
	);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["minor", "fatal"] });
});

test("Validation.recoverUnless widens to Validation<E, A | B> when fallback returns a different type", () => {
	const result = pipe(
		Validation.failed("recoverable"),
		Validation.recoverUnless((e) => e === "fatal", () => Validation.passed("recovered")),
	);
	expect(result).toStrictEqual({ kind: "Passed", value: "recovered" });
});

// ---------------------------------------------------------------------------
// product
// ---------------------------------------------------------------------------

test("Validation.product returns tuple when both are Valid", () => {
	const result = Validation.product(Validation.passed<string, string>("alice"), Validation.passed<string, number>(30));
	expect(result).toStrictEqual({ kind: "Passed", value: ["alice", 30] });
});

test("Validation.product returns Invalid when first is Invalid", () => {
	const result = Validation.product(Validation.failed("err1"), Validation.passed<string, number>(30));
	expect(result).toStrictEqual({ kind: "Failed", errors: ["err1"] });
});

test("Validation.product returns Invalid when second is Invalid", () => {
	const result = Validation.product(Validation.passed<string, string>("alice"), Validation.failed("err2"));
	expect(result).toStrictEqual({ kind: "Failed", errors: ["err2"] });
});

test("Validation.product accumulates errors when both are Invalid", () => {
	const result = Validation.product(Validation.failed("err1"), Validation.failed("err2"));
	expect(result).toStrictEqual({ kind: "Failed", errors: ["err1", "err2"] });
});

test("Validation.product accumulates multiple errors from both sides", () => {
	const result = Validation.product(Validation.failedAll(["a", "b"]), Validation.failedAll(["c"]));
	expect(result).toStrictEqual({ kind: "Failed", errors: ["a", "b", "c"] });
});

test("Validation.product can combine different value types", () => {
	const result = Validation.product(
		Validation.passed<string, string>("hello"),
		Validation.passed<string, boolean>(true),
	);
	expect(result).toStrictEqual({ kind: "Passed", value: ["hello", true] });
});

// ---------------------------------------------------------------------------
// productAll
// ---------------------------------------------------------------------------

test("Validation.productAll returns all values when all are Valid", () => {
	const result = Validation.productAll([
		Validation.passed<string, number>(1),
		Validation.passed<string, number>(2),
		Validation.passed<string, number>(3),
	]);
	expect(result).toStrictEqual({ kind: "Passed", value: [1, 2, 3] });
});

test("Validation.productAll accumulates all errors", () => {
	const result = Validation.productAll([
		Validation.failed("err1"),
		Validation.passed<string, number>(2),
		Validation.failed("err2"),
	]);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["err1", "err2"] });
});

test("Validation.productAll with all Invalid accumulates all errors", () => {
	const result = Validation.productAll([Validation.failed("a"), Validation.failed("b"), Validation.failed("c")]);
	expect(result).toStrictEqual({ kind: "Failed", errors: ["a", "b", "c"] });
});

test("Validation.productAll with single element returns singleton array", () => {
	const result = Validation.productAll([Validation.passed<string, number>(42)]);
	expect(result).toStrictEqual({ kind: "Passed", value: [42] });
});

// ---------------------------------------------------------------------------
// toResult
// ---------------------------------------------------------------------------

test("Validation.toResult converts Valid to Ok", () => {
	expect(Validation.toResult(Validation.passed(42))).toStrictEqual({ kind: "Ok", value: 42 });
});

test("Validation.toResult converts Invalid to Err with error list", () => {
	expect(Validation.toResult(Validation.failed("oops"))).toStrictEqual({ kind: "Err", error: ["oops"] });
});

test("Validation.toResult preserves all accumulated errors in Err", () => {
	expect(Validation.toResult(Validation.failedAll(["a", "b", "c"]))).toStrictEqual({
		kind: "Err",
		error: ["a", "b", "c"],
	});
});

// ---------------------------------------------------------------------------
// toMaybe
// ---------------------------------------------------------------------------

test("Validation.toMaybe converts Valid to Some", () => {
	expect(Validation.toMaybe(Validation.passed(42))).toStrictEqual({ kind: "Some", value: 42 });
});

test("Validation.toMaybe converts Invalid to None", () => {
	expect(Validation.toMaybe(Validation.failed("oops"))).toStrictEqual({ kind: "None" });
});

test("Validation.toMaybe discards all errors on Invalid", () => {
	expect(Validation.toMaybe(Validation.failedAll(["a", "b"]))).toStrictEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// fromResult
// ---------------------------------------------------------------------------

test("Validation.fromResult converts Ok to Valid", () => {
	expect(Validation.fromResult(Result.ok(42))).toStrictEqual({ kind: "Passed", value: 42 });
});

test("Validation.fromResult converts Err to Invalid with single-element error list", () => {
	expect(Validation.fromResult(Result.err("bad"))).toStrictEqual({ kind: "Failed", errors: ["bad"] });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("validation composes well in a pipe chain", () => {
	const validateName = (name: string): Validation<string, string> =>
		name.length > 0 ? Validation.passed(name) : Validation.failed("Name required");
	const validateAge = (age: number): Validation<string, number> =>
		age >= 0 ? Validation.passed(age) : Validation.failed("Age must be >= 0");
	const build = (name: string) => (age: number) => ({ name, age });
	const result = pipe(
		Validation.passed<string, typeof build>(build),
		Validation.ap(validateName("Alice")),
		Validation.ap(validateAge(30)),
		Validation.map((user) => user.name),
		Validation.getOrElse(() => "unknown"),
	);
	expect(result).toBe("Alice");
});

// ---------------------------------------------------------------------------
// Type inference
// ---------------------------------------------------------------------------

test("Validation.map — return type reflects mapped function output", () => {
	const v: Validation<string, number> = Validation.passed(42);
	const mapped = Validation.map((n: number) => String(n))(v);
	expectTypeOf(mapped).toEqualTypeOf<Validation<string, string>>();
});

test("Validation.getOrElse — widens return type to A | B", () => {
	const v = Validation.passed<string, string>("hello");
	const val = pipe(v, Validation.getOrElse((): null => null));
	expectTypeOf(val).toEqualTypeOf<string | null>();
});

test("Validation.fold — return type matches branch return types", () => {
	const v: Validation<string, number> = Validation.passed(1);
	const folded = Validation.fold(
		(errors: readonly string[]): string => errors.join(","),
		(n: number): string => String(n),
	)(v);
	expectTypeOf(folded).toBeString();
});

// --- fromNullable ---

test("Validation.fromNullable returns Valid for non-null values", () => {
	const result = Validation.fromNullable(() => "is null")(42);
	expect(result).toStrictEqual(Validation.passed(42));
});

test("Validation.fromNullable returns Invalid for null", () => {
	const result = Validation.fromNullable(() => "is null")(null);
	expect(result).toStrictEqual(Validation.failed("is null"));
});

test("Validation.fromNullable returns Invalid for undefined", () => {
	const result = Validation.fromNullable(() => "is null")(undefined);
	expect(result).toStrictEqual(Validation.failed("is null"));
});

// --- fromMaybe ---

test("Validation.fromMaybe returns Valid for Some", () => {
	const result = Validation.fromMaybe(() => "is none")(Maybe.some(42));
	expect(result).toStrictEqual(Validation.passed(42));
});

test("Validation.fromMaybe returns Invalid for None", () => {
	const result = Validation.fromMaybe(() => "is none")(Maybe.none());
	expect(result).toStrictEqual(Validation.failed("is none"));
});

// --- struct ---

test("Validation.struct combines a record of Passed values into a single Passed record", () => {
	const res = Validation.struct({ a: Validation.passed(1), b: Validation.passed("hello") });
	expect(res).toStrictEqual(Validation.passed({ a: 1, b: "hello" }));
});

test("Validation.struct accumulates errors from all Failed branches", () => {
	const res = Validation.struct({
		a: Validation.passed(1),
		b: Validation.failed("first fail"),
		c: Validation.failed("second fail"),
	});
	expect(res).toStrictEqual(Validation.failedAll(["first fail", "second fail"]));
});

test("Validation.struct composes in a pipe pipeline", () => {
	const res = pipe(
		Validation.passed<string, { name: string; }>({ name: "Alice" }),
		Validation.map((u) => u.name),
		Validation.match({
			passed: (name) =>
				Validation.struct({
					name: Validation.passed(name),
					valid: Validation.fromPredicate((n: string) => n.length > 0, () => "invalid")(name),
				}),
			failed: (errs) => Validation.failedAll(errs),
		}),
	);
	expect(res).toStrictEqual(Validation.passed({ name: "Alice", valid: "Alice" }));
});
