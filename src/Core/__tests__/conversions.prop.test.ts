import fc from "fast-check";
import { expect, test } from "vitest";
import { Maybe } from "../Maybe.ts";
import { RemoteData } from "../RemoteData.ts";
import { Ok as ResultOk, Result } from "../Result.ts";
import { Validation } from "../Validation.ts";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbSome = fc.integer().map(Maybe.some);
const arbNone = fc.constant(Maybe.none());

const arbOk = fc.integer().map(Result.ok);
const arbErr = fc.string().map(Result.err);

const arbValid = fc.integer().map((n) => Validation.passed<string, number>(n));
const arbInvalid = fc.string().map((s): Validation<string, number> => Validation.failed(s));

// ---------------------------------------------------------------------------
// Maybe <-> Result
// ---------------------------------------------------------------------------

test("maybe.toResult → Result.toMaybe — round-trip preserves Some value", () => {
	fc.assert(fc.property(arbSome, (m) => {
		expect(Result.toMaybe(Maybe.toResult(() => "missing")(m))).toStrictEqual(m);
	}));
});

test("maybe.toResult → Result.toMaybe — None round-trips to None", () => {
	fc.assert(fc.property(arbNone, (m) => {
		expect(Result.toMaybe(Maybe.toResult(() => "missing")(m))).toStrictEqual(Maybe.none());
	}));
});

test("result.toMaybe → Maybe.toResult — Ok round-trip preserves value", () => {
	fc.assert(fc.property(arbOk, (r) => {
		const o = r as ResultOk<number>;
		const asResult = Maybe.toResult(() => "missing")(Result.toMaybe(r));
		expect(asResult).toStrictEqual(Result.ok(o.value));
	}));
});

test("Result.toMaybe — Error maps to None (error discarded)", () => {
	fc.assert(fc.property(arbErr, (r) => {
		expect(Result.toMaybe(r)).toStrictEqual(Maybe.none());
	}));
});

test("maybe.fromResult — round-trip with Result.ok", () => {
	fc.assert(fc.property(fc.integer(), (n) => {
		expect(Maybe.fromResult(Result.ok(n))).toStrictEqual(Maybe.some(n));
	}));
});

// ---------------------------------------------------------------------------
// Result <-> Validation
// ---------------------------------------------------------------------------

test("validation.fromResult → Validation.toResult — Ok round-trip", () => {
	fc.assert(fc.property(fc.integer(), (n) => {
		const v = Validation.fromResult(Result.ok(n));
		expect(Validation.toResult(v)).toStrictEqual(Result.ok(n));
	}));
});

test("Validation.fromResult — Error becomes Invalid with single error", () => {
	fc.assert(fc.property(fc.string(), (e) => {
		const v = Validation.fromResult(Result.err(e));
		expect(Validation.isFailed(v)).toBe(true);
		const invalid = v as unknown as { errors: string[]; };
		expect(invalid.errors).toHaveLength(1);
		expect(invalid.errors[0]).toBe(e);
	}));
});

test("validation.toResult → Validation.fromResult — Valid round-trip", () => {
	fc.assert(fc.property(arbValid, (v) => {
		expect(Validation.fromResult(Validation.toResult(v))).toStrictEqual(v);
	}));
});

// ---------------------------------------------------------------------------
// Validation <-> Maybe
// ---------------------------------------------------------------------------

test("Validation.toMaybe — Valid maps to Some", () => {
	fc.assert(fc.property(arbValid, (v) => {
		expect(Validation.toMaybe(v)).toStrictEqual(Maybe.some((v as { value: number; }).value));
	}));
});

test("Validation.toMaybe — Invalid maps to None (errors discarded)", () => {
	fc.assert(fc.property(arbInvalid, (v) => {
		expect(Validation.toMaybe(v)).toStrictEqual(Maybe.none());
	}));
});

// ---------------------------------------------------------------------------
// RemoteData <-> Maybe / Result
// ---------------------------------------------------------------------------

test("remoteData.toMaybe — Success maps to Some", () => {
	fc.assert(fc.property(fc.integer(), (n) => {
		expect(RemoteData.toMaybe(RemoteData.success(n))).toStrictEqual(Maybe.some(n));
	}));
});

test("remoteData.toMaybe — non-Success maps to None", () => {
	fc.assert(fc.property(fc.string(), (e) => {
		expect(RemoteData.toMaybe(RemoteData.failure(e))).toStrictEqual(Maybe.none());
		expect(RemoteData.toMaybe(RemoteData.notAsked())).toStrictEqual(Maybe.none());
		expect(RemoteData.toMaybe(RemoteData.loading())).toStrictEqual(Maybe.none());
	}));
});

test("remoteData.toResult — Success maps to Ok", () => {
	fc.assert(fc.property(fc.integer(), (n) => {
		expect(RemoteData.toResult(() => "not ready")(RemoteData.success(n))).toStrictEqual(Result.ok(n));
	}));
});

test("remoteData.toResult — non-Success maps to Err via onNotReady", () => {
	fc.assert(fc.property(fc.string(), (msg) => {
		expect(RemoteData.toResult(() => msg)(RemoteData.notAsked())).toStrictEqual(Result.err(msg));
		expect(RemoteData.toResult(() => msg)(RemoteData.loading())).toStrictEqual(Result.err(msg));
	}));
});
