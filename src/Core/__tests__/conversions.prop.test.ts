import fc from "fast-check";
import { expect, test } from "vitest";
import { Maybe } from "../Maybe.ts";
import { RemoteData } from "../RemoteData.ts";
import { type Ok as ResultOk, Result } from "../Result.ts";
import { Validation } from "../Validation.ts";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbSome = fc.integer().map(Maybe.make.some);
const arbNone = fc.constant(Maybe.make.none());

const arbOk = fc.integer().map(Result.make.ok);
const arbErr = fc.string().map(Result.make.err);

const arbValid = fc.integer().map((n) => Validation.make.passed<string, number>(n));
const arbInvalid = fc.string().map((s): Validation<string, number> => Validation.make.failed(s));

// ---------------------------------------------------------------------------
// Maybe <-> Result
// ---------------------------------------------------------------------------

test("to.Result: round-trip with Result.to.Maybe preserves Some value", () => {
	fc.assert(fc.property(arbSome, (m) => {
		expect(Result.to.Maybe(Maybe.to.Result(() => "missing")(m))).toStrictEqual(m);
	}));
});

test("to.Result: round-trip with Result.to.Maybe preserves None", () => {
	fc.assert(fc.property(arbNone, (m) => {
		expect(Result.to.Maybe(Maybe.to.Result(() => "missing")(m))).toStrictEqual(Maybe.make.none());
	}));
});

test("to.Maybe: round-trip with Maybe.to.Result preserves Ok value", () => {
	fc.assert(fc.property(arbOk, (r) => {
		const o = r as ResultOk<number>;
		const asResult = Maybe.to.Result(() => "missing")(Result.to.Maybe(r));
		expect(asResult).toStrictEqual(Result.make.ok(o.value));
	}));
});

test("to.Maybe: maps Err to None", () => {
	fc.assert(fc.property(arbErr, (r) => {
		expect(Result.to.Maybe(r)).toStrictEqual(Maybe.make.none());
	}));
});

test("from.Result: round-trip with Result.make.ok produces Some", () => {
	fc.assert(fc.property(fc.integer(), (n) => {
		expect(Maybe.from.Result(Result.make.ok(n))).toStrictEqual(Maybe.make.some(n));
	}));
});

// ---------------------------------------------------------------------------
// Result <-> Validation
// ---------------------------------------------------------------------------

test("from.Result: round-trip with Validation.to.Result preserves Ok", () => {
	fc.assert(fc.property(fc.integer(), (n) => {
		const v = Validation.from.Result(Result.make.ok(n));
		expect(Validation.to.Result(v)).toStrictEqual(Result.make.ok(n));
	}));
});

test("from.Result: maps Err to failed validation with single error", () => {
	fc.assert(fc.property(fc.string(), (e) => {
		const v = Validation.from.Result(Result.make.err(e));
		expect(Validation.is.failed(v)).toBe(true);
		const invalid = v as unknown as { errors: string[]; };
		expect(invalid.errors).toHaveLength(1);
		expect(invalid.errors[0]).toBe(e);
	}));
});

test("to.Result: round-trip with Validation.from.Result preserves Valid", () => {
	fc.assert(fc.property(arbValid, (v) => {
		expect(Validation.from.Result(Validation.to.Result(v))).toStrictEqual(v);
	}));
});

// ---------------------------------------------------------------------------
// Validation <-> Maybe
// ---------------------------------------------------------------------------

test("to.Maybe: maps Valid to Some", () => {
	fc.assert(fc.property(arbValid, (v) => {
		expect(Validation.to.Maybe(v)).toStrictEqual(Maybe.make.some((v as { value: number; }).value));
	}));
});

test("to.Maybe: maps Invalid to None", () => {
	fc.assert(fc.property(arbInvalid, (v) => {
		expect(Validation.to.Maybe(v)).toStrictEqual(Maybe.make.none());
	}));
});

// ---------------------------------------------------------------------------
// RemoteData <-> Maybe / Result
// ---------------------------------------------------------------------------

test("to.Maybe: maps Success to Some", () => {
	fc.assert(fc.property(fc.integer(), (n) => {
		expect(RemoteData.to.Maybe(RemoteData.make.success(n))).toStrictEqual(Maybe.make.some(n));
	}));
});

test("to.Maybe: maps non-Success to None", () => {
	fc.assert(fc.property(fc.string(), (e) => {
		expect(RemoteData.to.Maybe(RemoteData.make.failure(e))).toStrictEqual(Maybe.make.none());
		expect(RemoteData.to.Maybe(RemoteData.make.notAsked())).toStrictEqual(Maybe.make.none());
		expect(RemoteData.to.Maybe(RemoteData.make.loading())).toStrictEqual(Maybe.make.none());
	}));
});

test("to.Result: maps Success to Ok", () => {
	fc.assert(fc.property(fc.integer(), (n) => {
		expect(RemoteData.to.Result(() => "not ready")(RemoteData.make.success(n))).toStrictEqual(Result.make.ok(n));
	}));
});

test("to.Result: maps non-Success to Err via onNotReady", () => {
	fc.assert(fc.property(fc.string(), (msg) => {
		expect(RemoteData.to.Result(() => msg)(RemoteData.make.notAsked())).toStrictEqual(Result.make.err(msg));
		expect(RemoteData.to.Result(() => msg)(RemoteData.make.loading())).toStrictEqual(Result.make.err(msg));
	}));
});
