import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Validation } from "../Validation.ts";
import { pipe } from "../../Composition/pipe.ts";

// ---------------------------------------------------------------------------
// valid
// ---------------------------------------------------------------------------

Deno.test("Validation.valid wraps a value in Valid", () => {
	const result = Validation.valid<string, number>(42);
	assertEquals(result, { kind: "Valid", value: 42 });
});

// ---------------------------------------------------------------------------
// isValid
// ---------------------------------------------------------------------------

Deno.test("Validation.isValid returns true for Valid", () => {
	assertStrictEquals(
		Validation.isValid(Validation.valid<string, number>(1)),
		true,
	);
});

Deno.test("Validation.isValid returns false for Invalid", () => {
	assertStrictEquals(
		Validation.isValid(Validation.invalid("err")),
		false,
	);
});

// ---------------------------------------------------------------------------
// invalidAll / isInvalid
// ---------------------------------------------------------------------------

Deno.test("Validation.invalidAll creates an Invalid with errors array", () => {
	assertEquals(Validation.invalidAll(["error1", "error2"]), {
		kind: "Invalid",
		errors: ["error1", "error2"],
	});
});

Deno.test("Validation.isInvalid returns true for Invalid", () => {
	assertStrictEquals(Validation.isInvalid(Validation.invalid(["e"])), true);
});

Deno.test("Validation.isInvalid returns false for Valid", () => {
	assertStrictEquals(
		Validation.isInvalid(Validation.valid<string, number>(1)),
		false,
	);
});

// ---------------------------------------------------------------------------
// invalid
// ---------------------------------------------------------------------------

Deno.test("Validation.invalid creates an Invalid from a single error", () => {
	assertEquals(Validation.invalid("oops"), {
		kind: "Invalid",
		errors: ["oops"],
	});
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

Deno.test("Validation.map transforms the valid value", () => {
	const result = pipe(
		Validation.valid<string, number>(5),
		Validation.map((n: number) => n * 2),
	);
	assertEquals(result, { kind: "Valid", value: 10 });
});

Deno.test("Validation.map passes through Invalid unchanged", () => {
	const result = pipe(
		Validation.invalid("error"),
		Validation.map((n: number) => n * 2),
	);
	assertEquals(result, { kind: "Invalid", errors: ["error"] });
});

Deno.test("Validation.map can change the value type", () => {
	const result = pipe(
		Validation.valid<string, number>(42),
		Validation.map((n: number) => `val: ${n}`),
	);
	assertEquals(result, { kind: "Valid", value: "val: 42" });
});

// ---------------------------------------------------------------------------
// ap (error accumulation)
// ---------------------------------------------------------------------------

Deno.test("Validation.ap applies Valid function to Valid value", () => {
	const add = (a: number) => (b: number) => a + b;
	const result = pipe(
		Validation.valid<string, typeof add>(add),
		Validation.ap(Validation.valid<string, number>(5)),
		Validation.ap(Validation.valid<string, number>(3)),
	);
	assertEquals(result, { kind: "Valid", value: 8 });
});

Deno.test("Validation.ap accumulates errors from both sides", () => {
	const add = (a: number) => (b: number) => a + b;
	const result = pipe(
		Validation.valid<string, typeof add>(add),
		Validation.ap(Validation.invalid("bad a")),
		Validation.ap(Validation.invalid("bad b")),
	);
	assertEquals(result, { kind: "Invalid", errors: ["bad a", "bad b"] });
});

Deno.test(
	"Validation.ap returns errors from value when function is Valid",
	() => {
		const result = pipe(
			Validation.valid<string, (n: number) => number>((n) => n * 2),
			Validation.ap(Validation.invalid("bad value")),
		);
		assertEquals(result, { kind: "Invalid", errors: ["bad value"] });
	},
);

Deno.test(
	"Validation.ap returns errors from function when value is Valid",
	() => {
		const result = pipe(
			Validation.invalid("bad fn"),
			Validation.ap(Validation.valid<string, number>(5)),
		);
		assertEquals(result, { kind: "Invalid", errors: ["bad fn"] });
	},
);

Deno.test(
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
		assertEquals(result, {
			kind: "Invalid",
			errors: ["Name required", "Invalid email", "Age must be >= 0"],
		});
	},
);

Deno.test("Validation.ap succeeds when all validations pass", () => {
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
	assertEquals(result, {
		kind: "Valid",
		value: { name: "Alice", email: "alice@example.com", age: 30 },
	});
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

Deno.test("Validation.fold calls onValid for Valid", () => {
	const result = pipe(
		Validation.valid<string, number>(5),
		Validation.fold(
			(errors) => `Errors: ${errors.join(", ")}`,
			(n: number) => `Value: ${n}`,
		),
	);
	assertStrictEquals(result, "Value: 5");
});

Deno.test("Validation.fold calls onInvalid for Invalid", () => {
	const result = pipe(
		Validation.invalidAll(["a", "b"]),
		Validation.fold(
			(errors) => `Errors: ${errors.join(", ")}`,
			(n: number) => `Value: ${n}`,
		),
	);
	assertStrictEquals(result, "Errors: a, b");
});

// ---------------------------------------------------------------------------
// match (data-last)
// ---------------------------------------------------------------------------

Deno.test("Validation.match calls valid handler for Valid", () => {
	const result = pipe(
		Validation.valid<string, number>(5),
		Validation.match({
			valid: (n: number) => `got ${n}`,
			invalid: (errors) => `failed: ${errors.join(", ")}`,
		}),
	);
	assertStrictEquals(result, "got 5");
});

Deno.test("Validation.match calls invalid handler for Invalid", () => {
	const result = pipe(
		Validation.invalid("oops"),
		Validation.match({
			valid: (n: number) => `got ${n}`,
			invalid: (errors) => `failed: ${errors.join(", ")}`,
		}),
	);
	assertStrictEquals(result, "failed: oops");
});

Deno.test("Validation.match is data-last (returns a function first)", () => {
	const handler = Validation.match<string, number, string>({
		valid: (n) => `val: ${n}`,
		invalid: (errors) => `err: ${errors.join(";")}`,
	});
	assertStrictEquals(handler(Validation.valid(3)), "val: 3");
	assertStrictEquals(handler(Validation.invalid("x")), "err: x");
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

Deno.test("Validation.getOrElse returns value for Valid", () => {
	const result = pipe(
		Validation.valid<string, number>(5),
		Validation.getOrElse(() => 0),
	);
	assertStrictEquals(result, 5);
});

Deno.test("Validation.getOrElse returns default for Invalid", () => {
	const result = pipe(
		Validation.invalid("error"),
		Validation.getOrElse(() => 0),
	);
	assertStrictEquals(result, 0);
});

Deno.test("Validation.getOrElse widens return type to A | B when default is a different type", () => {
	const result = pipe(
		Validation.invalid("error"),
		Validation.getOrElse(() => null),
	);
	assertStrictEquals(result, null);
});

Deno.test("Validation.getOrElse returns Valid value typed as A | B when Valid", () => {
	const result = pipe(
		Validation.valid(5),
		Validation.getOrElse(() => null),
	);
	assertStrictEquals(result, 5);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

Deno.test(
	"Validation.tap executes side effect on Valid and returns original",
	() => {
		let sideEffect = 0;
		const result = pipe(
			Validation.valid<string, number>(5),
			Validation.tap((n: number) => {
				sideEffect = n;
			}),
		);
		assertStrictEquals(sideEffect, 5);
		assertEquals(result, { kind: "Valid", value: 5 });
	},
);

Deno.test("Validation.tap does not execute side effect on Invalid", () => {
	let called = false;
	const result = pipe(
		Validation.invalid("error"),
		Validation.tap((_n: number) => {
			called = true;
		}),
	);
	assertStrictEquals(called, false);
	assertEquals(result, { kind: "Invalid", errors: ["error"] });
});

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

Deno.test(
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
		assertStrictEquals(called, false);
		assertEquals(result, { kind: "Valid", value: 5 });
	},
);

Deno.test("Validation.recover provides fallback for Invalid", () => {
	const result = pipe(
		Validation.invalid("error"),
		Validation.recover((_errors) => Validation.valid<string, number>(99)),
	);
	assertEquals(result, { kind: "Valid", value: 99 });
});

Deno.test("Validation.recover exposes the error list to the fallback", () => {
	let received: string[] = [];
	pipe(
		Validation.invalidAll(["first", "second"] as [string, ...string[]]),
		Validation.recover((errors) => {
			received = [...errors];
			return Validation.valid<string, number>(0);
		}),
	);
	assertEquals(received, ["first", "second"]);
});

Deno.test("Validation.recover can return Invalid as fallback", () => {
	const result = pipe(
		Validation.invalid("first"),
		Validation.recover((_errors) => Validation.invalid("second")),
	);
	assertEquals(result, { kind: "Invalid", errors: ["second"] });
});

Deno.test(
	"Validation.recover widens to Validation<E, A | B> when fallback returns a different type",
	() => {
		const result = pipe(
			Validation.invalid("error"),
			Validation.recover((_errors) => Validation.valid("recovered")),
		);
		assertEquals(result, { kind: "Valid", value: "recovered" });
	},
);

Deno.test("Validation.recover preserves Valid typed as Validation<E, A | B>", () => {
	const result = pipe(
		Validation.valid(5),
		Validation.recover((_errors) => Validation.valid("recovered")),
	);
	assertEquals(result, { kind: "Valid", value: 5 });
});

// ---------------------------------------------------------------------------
// recoverUnless
// ---------------------------------------------------------------------------

Deno.test(
	"Validation.recoverUnless recovers when errors do not include blocked errors",
	() => {
		const result = pipe(
			Validation.invalid("recoverable"),
			Validation.recoverUnless(["fatal"], () => Validation.valid<string, number>(42)),
		);
		assertEquals(result, { kind: "Valid", value: 42 });
	},
);

Deno.test(
	"Validation.recoverUnless does NOT recover when errors include a blocked error",
	() => {
		const result = pipe(
			Validation.invalid("fatal"),
			Validation.recoverUnless(["fatal"], () => Validation.valid<string, number>(42)),
		);
		assertEquals(result, { kind: "Invalid", errors: ["fatal"] });
	},
);

Deno.test("Validation.recoverUnless passes through Valid unchanged", () => {
	const result = pipe(
		Validation.valid<string, number>(10),
		Validation.recoverUnless(["fatal"], () => Validation.valid<string, number>(42)),
	);
	assertEquals(result, { kind: "Valid", value: 10 });
});

Deno.test(
	"Validation.recoverUnless does NOT recover when any error matches blocked list",
	() => {
		const result = pipe(
			Validation.invalidAll(["minor", "fatal"]),
			Validation.recoverUnless(["fatal"], () => Validation.valid<string, number>(42)),
		);
		assertEquals(result, { kind: "Invalid", errors: ["minor", "fatal"] });
	},
);

Deno.test(
	"Validation.recoverUnless widens to Validation<E, A | B> when fallback returns a different type",
	() => {
		const result = pipe(
			Validation.invalid("recoverable"),
			Validation.recoverUnless(["fatal"], () => Validation.valid("recovered")),
		);
		assertEquals(result, { kind: "Valid", value: "recovered" });
	},
);

// ---------------------------------------------------------------------------
// product
// ---------------------------------------------------------------------------

Deno.test("Validation.product returns tuple when both are Valid", () => {
	const result = Validation.product(
		Validation.valid<string, string>("alice"),
		Validation.valid<string, number>(30),
	);
	assertEquals(result, { kind: "Valid", value: ["alice", 30] });
});

Deno.test("Validation.product returns Invalid when first is Invalid", () => {
	const result = Validation.product(
		Validation.invalid("err1"),
		Validation.valid<string, number>(30),
	);
	assertEquals(result, { kind: "Invalid", errors: ["err1"] });
});

Deno.test("Validation.product returns Invalid when second is Invalid", () => {
	const result = Validation.product(
		Validation.valid<string, string>("alice"),
		Validation.invalid("err2"),
	);
	assertEquals(result, { kind: "Invalid", errors: ["err2"] });
});

Deno.test("Validation.product accumulates errors when both are Invalid", () => {
	const result = Validation.product(
		Validation.invalid("err1"),
		Validation.invalid("err2"),
	);
	assertEquals(result, { kind: "Invalid", errors: ["err1", "err2"] });
});

Deno.test("Validation.product accumulates multiple errors from both sides", () => {
	const result = Validation.product(
		Validation.invalidAll(["a", "b"]),
		Validation.invalidAll(["c"]),
	);
	assertEquals(result, { kind: "Invalid", errors: ["a", "b", "c"] });
});

Deno.test("Validation.product can combine different value types", () => {
	const result = Validation.product(
		Validation.valid<string, string>("hello"),
		Validation.valid<string, boolean>(true),
	);
	assertEquals(result, { kind: "Valid", value: ["hello", true] });
});

// ---------------------------------------------------------------------------
// productAll
// ---------------------------------------------------------------------------

Deno.test("Validation.productAll returns all values when all are Valid", () => {
	const result = Validation.productAll([
		Validation.valid<string, number>(1),
		Validation.valid<string, number>(2),
		Validation.valid<string, number>(3),
	]);
	assertEquals(result, { kind: "Valid", value: [1, 2, 3] });
});

Deno.test("Validation.productAll accumulates all errors", () => {
	const result = Validation.productAll([
		Validation.invalid("err1"),
		Validation.valid<string, number>(2),
		Validation.invalid("err2"),
	]);
	assertEquals(result, { kind: "Invalid", errors: ["err1", "err2"] });
});

Deno.test("Validation.productAll with all Invalid accumulates all errors", () => {
	const result = Validation.productAll([
		Validation.invalid("a"),
		Validation.invalid("b"),
		Validation.invalid("c"),
	]);
	assertEquals(result, { kind: "Invalid", errors: ["a", "b", "c"] });
});

Deno.test("Validation.productAll with single element returns singleton array", () => {
	const result = Validation.productAll([Validation.valid<string, number>(42)]);
	assertEquals(result, { kind: "Valid", value: [42] });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

Deno.test("Validation composes well in a pipe chain", () => {
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
	assertStrictEquals(result, "Alice");
});
