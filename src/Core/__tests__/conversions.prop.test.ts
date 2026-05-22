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
const arbErr = fc.string().map(Result.error);

const arbValid = fc.integer().map((n) => Validation.valid<string, number>(n));
const arbInvalid = fc.string().map((s): Validation<string, number> => Validation.invalid(s));

// ---------------------------------------------------------------------------
// Maybe <-> Result
// ---------------------------------------------------------------------------

test("Maybe.toResult → Result.toMaybe — round-trip preserves Some value", () => {
	fc.assert(
		fc.property(arbSome, (m) => {
			expect(Result.toMaybe(Maybe.toResult(() => "missing")(m))).toEqual(m);
		}),
	);
});

test("Maybe.toResult → Result.toMaybe — None round-trips to None", () => {
	fc.assert(
		fc.property(arbNone, (m) => {
			expect(Result.toMaybe(Maybe.toResult(() => "missing")(m))).toEqual(Maybe.none());
		}),
	);
});

test("Result.toMaybe → Maybe.toResult — Ok round-trip preserves value", () => {
	fc.assert(
		fc.property(arbOk, (r) => {
			const o = r as ResultOk<number>;
			const asResult = Maybe.toResult(() => "missing")(Result.toMaybe(r));
			expect(asResult).toEqual(Result.ok(o.value));
		}),
	);
});

test("Result.toMaybe — Error maps to None (error discarded)", () => {
	fc.assert(
		fc.property(arbErr, (r) => {
			expect(Result.toMaybe(r)).toEqual(Maybe.none());
		}),
	);
});

test("Maybe.fromResult — round-trip with Result.ok", () => {
	fc.assert(
		fc.property(fc.integer(), (n) => {
			expect(Maybe.fromResult(Result.ok(n))).toEqual(Maybe.some(n));
		}),
	);
});

// ---------------------------------------------------------------------------
// Result <-> Validation
// ---------------------------------------------------------------------------

test("Validation.fromResult → Validation.toResult — Ok round-trip", () => {
	fc.assert(
		fc.property(fc.integer(), (n) => {
			const v = Validation.fromResult(Result.ok(n));
			expect(Validation.toResult(v)).toEqual(Result.ok(n));
		}),
	);
});

test("Validation.fromResult — Error becomes Invalid with single error", () => {
	fc.assert(
		fc.property(fc.string(), (e) => {
			const v = Validation.fromResult(Result.error(e));
			expect(Validation.isInvalid(v)).toBe(true);
			const invalid = v as unknown as { errors: string[]; };
			expect(invalid.errors).toHaveLength(1);
			expect(invalid.errors[0]).toBe(e);
		}),
	);
});

test("Validation.toResult → Validation.fromResult — Valid round-trip", () => {
	fc.assert(
		fc.property(arbValid, (v) => {
			expect(Validation.fromResult(Validation.toResult(v))).toEqual(v);
		}),
	);
});

// ---------------------------------------------------------------------------
// Validation <-> Maybe
// ---------------------------------------------------------------------------

test("Validation.toMaybe — Valid maps to Some", () => {
	fc.assert(
		fc.property(arbValid, (v) => {
			expect(Validation.toMaybe(v)).toEqual(Maybe.some((v as { value: number; }).value));
		}),
	);
});

test("Validation.toMaybe — Invalid maps to None (errors discarded)", () => {
	fc.assert(
		fc.property(arbInvalid, (v) => {
			expect(Validation.toMaybe(v)).toEqual(Maybe.none());
		}),
	);
});

// ---------------------------------------------------------------------------
// RemoteData <-> Maybe / Result
// ---------------------------------------------------------------------------

test("RemoteData.toMaybe — Success maps to Some", () => {
	fc.assert(
		fc.property(fc.integer(), (n) => {
			expect(RemoteData.toMaybe(RemoteData.success(n))).toEqual(Maybe.some(n));
		}),
	);
});

test("RemoteData.toMaybe — non-Success maps to None", () => {
	fc.assert(
		fc.property(fc.string(), (e) => {
			expect(RemoteData.toMaybe(RemoteData.failure(e))).toEqual(Maybe.none());
			expect(RemoteData.toMaybe(RemoteData.notAsked())).toEqual(Maybe.none());
			expect(RemoteData.toMaybe(RemoteData.loading())).toEqual(Maybe.none());
		}),
	);
});

test("RemoteData.toResult — Success maps to Ok", () => {
	fc.assert(
		fc.property(fc.integer(), (n) => {
			expect(RemoteData.toResult(() => "not ready")(RemoteData.success(n))).toEqual(Result.ok(n));
		}),
	);
});

test("RemoteData.toResult — non-Success maps to Err via onNotReady", () => {
	fc.assert(
		fc.property(fc.string(), (msg) => {
			expect(RemoteData.toResult(() => msg)(RemoteData.notAsked())).toEqual(Result.error(msg));
			expect(RemoteData.toResult(() => msg)(RemoteData.loading())).toEqual(Result.error(msg));
		}),
	);
});
