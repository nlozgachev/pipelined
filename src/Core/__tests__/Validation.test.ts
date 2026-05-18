import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Result } from "../Result.ts";
import { Validation } from "../Validation.ts";

// ---------------------------------------------------------------------------
// valid
// ---------------------------------------------------------------------------

test("Validation.valid wraps a value in Valid", () => {
	const result = Validation.valid<string, number>(42);
	expect(result).toEqual({ kind: "Valid", value: 42 });
});

// ---------------------------------------------------------------------------
// isValid
// ---------------------------------------------------------------------------

test("Validation.isValid returns true for Valid", () => {
	expect(Validation.isValid(Validation.valid<string, number>(1))).toBe(true);
});

test("Validation.isValid returns false for Invalid", () => {
	expect(Validation.isValid(Validation.invalid("err"))).toBe(false);
});

// ---------------------------------------------------------------------------
// invalidAll / isInvalid
// ---------------------------------------------------------------------------

test("Validation.invalidAll creates an Invalid with errors array", () => {
	expect(Validation.invalidAll(["error1", "error2"])).toEqual({
		kind: "Invalid",
		errors: ["error1", "error2"],
	});
});

test("Validation.isInvalid returns true for Invalid", () => {
	expect(Validation.isInvalid(Validation.invalid(["e"]))).toBe(true);
});

test("Validation.isInvalid returns false for Valid", () => {
	expect(Validation.isInvalid(Validation.valid<string, number>(1))).toBe(false);
});

// ---------------------------------------------------------------------------
// invalid
// ---------------------------------------------------------------------------

test("Validation.invalid creates an Invalid from a single error", () => {
	expect(Validation.invalid("oops")).toEqual({
		kind: "Invalid",
		errors: ["oops"],
	});
});

// ---------------------------------------------------------------------------
// fromPredicate
// ---------------------------------------------------------------------------

test("Validation.fromPredicate returns Valid when predicate passes", () => {
	expect(
		pipe(
			"Alice",
			Validation.fromPredicate((s) => s.length > 0, () => "required"),
		),
	).toEqual({
		kind: "Valid",
		value: "Alice",
	});
});

test("Validation.fromPredicate returns Invalid when predicate fails", () => {
	expect(
		pipe(
			"",
			Validation.fromPredicate((s) => s.length > 0, () => "required"),
		),
	).toEqual({
		kind: "Invalid",
		errors: ["required"],
	});
});

test("Validation.fromPredicate passes the value to onFalse", () => {
	expect(
		pipe(
			-1,
			Validation.fromPredicate((n) => n >= 0, (n) => `${n} is negative`),
		),
	).toEqual({
		kind: "Invalid",
		errors: ["-1 is negative"],
	});
});

test("Validation.fromPredicate composes with ap for multi-field validation", () => {
	const validateName = Validation.fromPredicate(
		(s: string) => s.length > 0,
		() => "Name required",
	);
	const validateAge = Validation.fromPredicate(
		(n: number) => n >= 0,
		() => "Age invalid",
	);
	const result = pipe(
		Validation.valid<string, (name: string) => (age: number) => { name: string; age: number; }>(
			(name: string) => (age: number) => ({ name, age }),
		),
		Validation.ap(validateName("")),
		Validation.ap(validateAge(-1)),
	);
	expect(result).toEqual({
		kind: "Invalid",
		errors: ["Name required", "Age invalid"],
	});
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("Validation.map transforms the valid value", () => {
	const result = pipe(
		Validation.valid<string, number>(5),
		Validation.map((n: number) => n * 2),
	);
	expect(result).toEqual({ kind: "Valid", value: 10 });
});

test("Validation.map passes through Invalid unchanged", () => {
	const result = pipe(
		Validation.invalid("error"),
		Validation.map((n: number) => n * 2),
	);
	expect(result).toEqual({ kind: "Invalid", errors: ["error"] });
});

test("Validation.map can change the value type", () => {
	const result = pipe(
		Validation.valid<string, number>(42),
		Validation.map((n: number) => `val: ${n}`),
	);
	expect(result).toEqual({ kind: "Valid", value: "val: 42" });
});

// ---------------------------------------------------------------------------
// ap (error accumulation)
// ---------------------------------------------------------------------------

test("Validation.ap applies Valid function to Valid value", () => {
	const add = (a: number) => (b: number) => a + b;
	const result = pipe(
		Validation.valid<string, typeof add>(add),
		Validation.ap(Validation.valid<string, number>(5)),
		Validation.ap(Validation.valid<string, number>(3)),
	);
	expect(result).toEqual({ kind: "Valid", value: 8 });
});

test("Validation.ap accumulates errors from both sides", () => {
	const add = (a: number) => (b: number) => a + b;
	const result = pipe(
		Validation.valid<string, typeof add>(add),
		Validation.ap(Validation.invalid("bad a")),
		Validation.ap(Validation.invalid("bad b")),
	);
	expect(result).toEqual({ kind: "Invalid", errors: ["bad a", "bad b"] });
});

test(
	"Validation.ap returns errors from value when function is Valid",
	() => {
		const result = pipe(
			Validation.valid<string, (n: number) => number>((n) => n * 2),
			Validation.ap(Validation.invalid("bad value")),
		);
		expect(result).toEqual({ kind: "Invalid", errors: ["bad value"] });
	},
);

test(
	"Validation.ap returns errors from function when value is Valid",
	() => {
		const result = pipe(
			Validation.invalid("bad fn"),
			Validation.ap(Validation.valid<string, number>(5)),
		);
		expect(result).toEqual({ kind: "Invalid", errors: ["bad fn"] });
	},
);

test(
	"Validation.ap accumulates all errors in a multi-field validation",
	() => {
		const createUser = (name: string) => (email: string) => (age: number) => ({
			name,
			email,
			age,
		});

		const validateName = (name: string): Validation<string, string> =>
			name.length > 0 ? Validation.valid(name) : Validation.invalid("Name required");
		const validateEmail = (email: string): Validation<string, string> =>
			email.includes("@") ? Validation.valid(email) : Validation.invalid("Invalid email");
		const validateAge = (age: number): Validation<string, number> =>
			age >= 0 ? Validation.valid(age) : Validation.invalid("Age must be >= 0");

		const result = pipe(
			Validation.valid<string, typeof createUser>(createUser),
			Validation.ap(validateName("")),
			Validation.ap(validateEmail("bad")),
			Validation.ap(validateAge(-5)),
		);
		expect(result).toEqual({
			kind: "Invalid",
			errors: ["Name required", "Invalid email", "Age must be >= 0"],
		});
	},
);

test("Validation.ap succeeds when all validations pass", () => {
	const createUser = (name: string) => (email: string) => (age: number) => ({
		name,
		email,
		age,
	});

	const result = pipe(
		Validation.valid<string, typeof createUser>(createUser),
		Validation.ap(Validation.valid<string, string>("Alice")),
		Validation.ap(Validation.valid<string, string>("alice@example.com")),
		Validation.ap(Validation.valid<string, number>(30)),
	);
	expect(result).toEqual({
		kind: "Valid",
		value: { name: "Alice", email: "alice@example.com", age: 30 },
	});
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("Validation.fold calls onValid for Valid", () => {
	const result = pipe(
		Validation.valid<string, number>(5),
		Validation.fold(
			(errors) => `Errors: ${errors.join(", ")}`,
			(n: number) => `Value: ${n}`,
		),
	);
	expect(result).toBe("Value: 5");
});

test("Validation.fold calls onInvalid for Invalid", () => {
	const result = pipe(
		Validation.invalidAll(["a", "b"]),
		Validation.fold(
			(errors) => `Errors: ${errors.join(", ")}`,
			(n: number) => `Value: ${n}`,
		),
	);
	expect(result).toBe("Errors: a, b");
});

// ---------------------------------------------------------------------------
// match (data-last)
// ---------------------------------------------------------------------------

test("Validation.match calls valid handler for Valid", () => {
	const result = pipe(
		Validation.valid<string, number>(5),
		Validation.match({
			valid: (n: number) => `got ${n}`,
			invalid: (errors) => `failed: ${errors.join(", ")}`,
		}),
	);
	expect(result).toBe("got 5");
});

test("Validation.match calls invalid handler for Invalid", () => {
	const result = pipe(
		Validation.invalid("oops"),
		Validation.match({
			valid: (n: number) => `got ${n}`,
			invalid: (errors) => `failed: ${errors.join(", ")}`,
		}),
	);
	expect(result).toBe("failed: oops");
});

test("Validation.match is data-last (returns a function first)", () => {
	const handler = Validation.match<string, number, string>({
		valid: (n) => `val: ${n}`,
		invalid: (errors) => `err: ${errors.join(";")}`,
	});
	expect(handler(Validation.valid(3))).toBe("val: 3");
	expect(handler(Validation.invalid("x"))).toBe("err: x");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("Validation.getOrElse returns value for Valid", () => {
	const result = pipe(
		Validation.valid<string, number>(5),
		Validation.getOrElse(() => 0),
	);
	expect(result).toBe(5);
});

test("Validation.getOrElse returns default for Invalid", () => {
	const result = pipe(
		Validation.invalid("error"),
		Validation.getOrElse(() => 0),
	);
	expect(result).toBe(0);
});

test("Validation.getOrElse widens return type to A | B when default is a different type", () => {
	const result = pipe(
		Validation.invalid("error"),
		Validation.getOrElse(() => null),
	);
	expect(result).toBeNull();
});

test("Validation.getOrElse returns Valid value typed as A | B when Valid", () => {
	const result = pipe(
		Validation.valid(5),
		Validation.getOrElse(() => null),
	);
	expect(result).toBe(5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test(
	"Validation.tap executes side effect on Valid and returns original",
	() => {
		let sideEffect = 0;
		const result = pipe(
			Validation.valid<string, number>(5),
			Validation.tap((n: number) => {
				sideEffect = n;
			}),
		);
		expect(sideEffect).toBe(5);
		expect(result).toEqual({ kind: "Valid", value: 5 });
	},
);

test("Validation.tap does not execute side effect on Invalid", () => {
	let called = false;
	const result = pipe(
		Validation.invalid("error"),
		Validation.tap((_n: number) => {
			called = true;
		}),
	);
	expect(called).toBe(false);
	expect(result).toEqual({ kind: "Invalid", errors: ["error"] });
});

// ---------------------------------------------------------------------------
// tapError
// ---------------------------------------------------------------------------

test("Validation.tapError calls f on Invalid", () => {
	let called = false;
	pipe(
		Validation.invalid("err"),
		Validation.tapError(() => {
			called = true;
		}),
	);
	expect(called).toBe(true);
});

test("Validation.tapError does not call f on Valid", () => {
	let called = false;
	pipe(
		Validation.valid(42),
		Validation.tapError(() => {
			called = true;
		}),
	);
	expect(called).toBe(false);
});

test("Validation.tapError returns the Validation unchanged", () => {
	const data = Validation.invalid("err");
	const result = pipe(data, Validation.tapError(() => {}));
	expect(result).toEqual(data);
});

test("Validation.tapError receives the full error list", () => {
	let received: readonly string[] | undefined;
	pipe(
		Validation.invalidAll(["a", "b"]),
		Validation.tapError((errs) => {
			received = errs;
		}),
	);
	expect(received).toEqual(["a", "b"]);
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

test(
	"Validation.recover returns original Valid without calling fallback",
	() => {
		let called = false;
		const result = pipe(
			Validation.valid<string, number>(5),
			Validation.recover((_errors) => {
				called = true;
				return Validation.valid<string, number>(99);
			}),
		);
		expect(called).toBe(false);
		expect(result).toEqual({ kind: "Valid", value: 5 });
	},
);

test("Validation.recover provides fallback for Invalid", () => {
	const result = pipe(
		Validation.invalid("error"),
		Validation.recover((_errors) => Validation.valid<string, number>(99)),
	);
	expect(result).toEqual({ kind: "Valid", value: 99 });
});

test("Validation.recover exposes the error list to the fallback", () => {
	let received: string[] = [];
	pipe(
		Validation.invalidAll(["first", "second"] as [string, ...string[]]),
		Validation.recover((errors) => {
			received = [...errors];
			return Validation.valid<string, number>(0);
		}),
	);
	expect(received).toEqual(["first", "second"]);
});

test("Validation.recover can return Invalid as fallback", () => {
	const result = pipe(
		Validation.invalid("first"),
		Validation.recover((_errors) => Validation.invalid("second")),
	);
	expect(result).toEqual({ kind: "Invalid", errors: ["second"] });
});

test(
	"Validation.recover widens to Validation<E, A | B> when fallback returns a different type",
	() => {
		const result = pipe(
			Validation.invalid("error"),
			Validation.recover((_errors) => Validation.valid("recovered")),
		);
		expect(result).toEqual({ kind: "Valid", value: "recovered" });
	},
);

test("Validation.recover preserves Valid typed as Validation<E, A | B>", () => {
	const result = pipe(
		Validation.valid(5),
		Validation.recover((_errors) => Validation.valid("recovered")),
	);
	expect(result).toEqual({ kind: "Valid", value: 5 });
});

// ---------------------------------------------------------------------------
// recoverUnless
// ---------------------------------------------------------------------------

test(
	"Validation.recoverUnless recovers when predicate returns false for all errors",
	() => {
		const result = pipe(
			Validation.invalid("recoverable"),
			Validation.recoverUnless((e) => e === "fatal", () => Validation.valid<string, number>(42)),
		);
		expect(result).toEqual({ kind: "Valid", value: 42 });
	},
);

test(
	"Validation.recoverUnless does NOT recover when predicate returns true for any error",
	() => {
		const result = pipe(
			Validation.invalid("fatal"),
			Validation.recoverUnless((e) => e === "fatal", () => Validation.valid<string, number>(42)),
		);
		expect(result).toEqual({ kind: "Invalid", errors: ["fatal"] });
	},
);

test("Validation.recoverUnless passes through Valid unchanged", () => {
	const result = pipe(
		Validation.valid<string, number>(10),
		Validation.recoverUnless((e) => e === "fatal", () => Validation.valid<string, number>(42)),
	);
	expect(result).toEqual({ kind: "Valid", value: 10 });
});

test(
	"Validation.recoverUnless does NOT recover when any error in accumulation matches",
	() => {
		const result = pipe(
			Validation.invalidAll(["minor", "fatal"]),
			Validation.recoverUnless((e) => e === "fatal", () => Validation.valid<string, number>(42)),
		);
		expect(result).toEqual({ kind: "Invalid", errors: ["minor", "fatal"] });
	},
);

test(
	"Validation.recoverUnless widens to Validation<E, A | B> when fallback returns a different type",
	() => {
		const result = pipe(
			Validation.invalid("recoverable"),
			Validation.recoverUnless((e) => e === "fatal", () => Validation.valid("recovered")),
		);
		expect(result).toEqual({ kind: "Valid", value: "recovered" });
	},
);

// ---------------------------------------------------------------------------
// product
// ---------------------------------------------------------------------------

test("Validation.product returns tuple when both are Valid", () => {
	const result = Validation.product(
		Validation.valid<string, string>("alice"),
		Validation.valid<string, number>(30),
	);
	expect(result).toEqual({ kind: "Valid", value: ["alice", 30] });
});

test("Validation.product returns Invalid when first is Invalid", () => {
	const result = Validation.product(
		Validation.invalid("err1"),
		Validation.valid<string, number>(30),
	);
	expect(result).toEqual({ kind: "Invalid", errors: ["err1"] });
});

test("Validation.product returns Invalid when second is Invalid", () => {
	const result = Validation.product(
		Validation.valid<string, string>("alice"),
		Validation.invalid("err2"),
	);
	expect(result).toEqual({ kind: "Invalid", errors: ["err2"] });
});

test("Validation.product accumulates errors when both are Invalid", () => {
	const result = Validation.product(
		Validation.invalid("err1"),
		Validation.invalid("err2"),
	);
	expect(result).toEqual({ kind: "Invalid", errors: ["err1", "err2"] });
});

test("Validation.product accumulates multiple errors from both sides", () => {
	const result = Validation.product(
		Validation.invalidAll(["a", "b"]),
		Validation.invalidAll(["c"]),
	);
	expect(result).toEqual({ kind: "Invalid", errors: ["a", "b", "c"] });
});

test("Validation.product can combine different value types", () => {
	const result = Validation.product(
		Validation.valid<string, string>("hello"),
		Validation.valid<string, boolean>(true),
	);
	expect(result).toEqual({ kind: "Valid", value: ["hello", true] });
});

// ---------------------------------------------------------------------------
// productAll
// ---------------------------------------------------------------------------

test("Validation.productAll returns all values when all are Valid", () => {
	const result = Validation.productAll([
		Validation.valid<string, number>(1),
		Validation.valid<string, number>(2),
		Validation.valid<string, number>(3),
	]);
	expect(result).toEqual({ kind: "Valid", value: [1, 2, 3] });
});

test("Validation.productAll accumulates all errors", () => {
	const result = Validation.productAll([
		Validation.invalid("err1"),
		Validation.valid<string, number>(2),
		Validation.invalid("err2"),
	]);
	expect(result).toEqual({ kind: "Invalid", errors: ["err1", "err2"] });
});

test("Validation.productAll with all Invalid accumulates all errors", () => {
	const result = Validation.productAll([
		Validation.invalid("a"),
		Validation.invalid("b"),
		Validation.invalid("c"),
	]);
	expect(result).toEqual({ kind: "Invalid", errors: ["a", "b", "c"] });
});

test("Validation.productAll with single element returns singleton array", () => {
	const result = Validation.productAll([Validation.valid<string, number>(42)]);
	expect(result).toEqual({ kind: "Valid", value: [42] });
});

// ---------------------------------------------------------------------------
// toResult
// ---------------------------------------------------------------------------

test("Validation.toResult converts Valid to Ok", () => {
	expect(Validation.toResult(Validation.valid(42))).toEqual({
		kind: "Ok",
		value: 42,
	});
});

test("Validation.toResult converts Invalid to Err with error list", () => {
	expect(Validation.toResult(Validation.invalid("oops"))).toEqual({
		kind: "Error",
		error: ["oops"],
	});
});

test("Validation.toResult preserves all accumulated errors in Err", () => {
	expect(Validation.toResult(Validation.invalidAll(["a", "b", "c"]))).toEqual({
		kind: "Error",
		error: ["a", "b", "c"],
	});
});

// ---------------------------------------------------------------------------
// toMaybe
// ---------------------------------------------------------------------------

test("Validation.toMaybe converts Valid to Some", () => {
	expect(Validation.toMaybe(Validation.valid(42))).toEqual({ kind: "Some", value: 42 });
});

test("Validation.toMaybe converts Invalid to None", () => {
	expect(Validation.toMaybe(Validation.invalid("oops"))).toEqual({ kind: "None" });
});

test("Validation.toMaybe discards all errors on Invalid", () => {
	expect(Validation.toMaybe(Validation.invalidAll(["a", "b"]))).toEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// fromResult
// ---------------------------------------------------------------------------

test("Validation.fromResult converts Ok to Valid", () => {
	expect(Validation.fromResult(Result.ok(42))).toEqual({ kind: "Valid", value: 42 });
});

test("Validation.fromResult converts Err to Invalid with single-element error list", () => {
	expect(Validation.fromResult(Result.error("bad"))).toEqual({ kind: "Invalid", errors: ["bad"] });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("Validation composes well in a pipe chain", () => {
	const validateName = (name: string): Validation<string, string> =>
		name.length > 0 ? Validation.valid(name) : Validation.invalid("Name required");
	const validateAge = (age: number): Validation<string, number> =>
		age >= 0 ? Validation.valid(age) : Validation.invalid("Age must be >= 0");
	const build = (name: string) => (age: number) => ({ name, age });
	const result = pipe(
		Validation.valid<string, typeof build>(build),
		Validation.ap(validateName("Alice")),
		Validation.ap(validateAge(30)),
		Validation.map((user) => user.name),
		Validation.getOrElse(() => "unknown"),
	);
	expect(result).toBe("Alice");
});
