import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Num } from "../Num.ts";
import { Option } from "#core/Option.ts";
import { Arr } from "../Arr.ts";
import { pipe } from "#composition/pipe.ts";

// ---------------------------------------------------------------------------
// range
// ---------------------------------------------------------------------------

Deno.test("Num.range produces integers from start to end (both inclusive)", () => {
	assertEquals(Num.range(0, 5), [0, 1, 2, 3, 4, 5]);
});

Deno.test("Num.range with step produces every nth integer up to and including to", () => {
	assertEquals(Num.range(0, 10, 2), [0, 2, 4, 6, 8, 10]);
	assertEquals(Num.range(0, 9, 2), [0, 2, 4, 6, 8]);
});

Deno.test("Num.range returns empty array when from > to", () => {
	assertEquals(Num.range(5, 0), []);
});

Deno.test("Num.range returns single element when from equals to", () => {
	assertEquals(Num.range(3, 3), [3]);
	assertEquals(Num.range(3, 3, 2), [3]);
});

Deno.test("Num.range returns empty array for non-positive step", () => {
	assertEquals(Num.range(0, 5, 0), []);
	assertEquals(Num.range(0, 5, -1), []);
});

Deno.test("Num.range with step 1 matches default behaviour", () => {
	assertEquals(Num.range(1, 4, 1), Num.range(1, 4));
});

// ---------------------------------------------------------------------------
// clamp
// ---------------------------------------------------------------------------

Deno.test("Num.clamp returns value unchanged when within bounds", () => {
	assertStrictEquals(pipe(42, Num.clamp(0, 100)), 42);
});

Deno.test("Num.clamp returns min when value is below range", () => {
	assertStrictEquals(pipe(-5, Num.clamp(0, 100)), 0);
});

Deno.test("Num.clamp returns max when value is above range", () => {
	assertStrictEquals(pipe(150, Num.clamp(0, 100)), 100);
});

Deno.test("Num.clamp returns min == max when they are equal", () => {
	assertStrictEquals(pipe(99, Num.clamp(50, 50)), 50);
});

// ---------------------------------------------------------------------------
// between
// ---------------------------------------------------------------------------

Deno.test("Num.between returns true when value is inside range (inclusive)", () => {
	assertStrictEquals(pipe(5, Num.between(1, 10)), true);
	assertStrictEquals(pipe(1, Num.between(1, 10)), true);
	assertStrictEquals(pipe(10, Num.between(1, 10)), true);
});

Deno.test("Num.between returns false when value is outside range", () => {
	assertStrictEquals(pipe(0, Num.between(1, 10)), false);
	assertStrictEquals(pipe(11, Num.between(1, 10)), false);
});

// ---------------------------------------------------------------------------
// parse
// ---------------------------------------------------------------------------

Deno.test("Num.parse returns Some for a valid integer string", () => {
	assertEquals(Num.parse("42"), Option.some(42));
});

Deno.test("Num.parse returns Some for a valid float string", () => {
	assertEquals(Num.parse("3.14"), Option.some(3.14));
});

Deno.test("Num.parse returns None for a non-numeric string", () => {
	assertEquals(Num.parse("abc"), Option.none());
});

Deno.test("Num.parse returns None for an empty string", () => {
	assertEquals(Num.parse(""), Option.none());
});

Deno.test("Num.parse returns None for a whitespace-only string", () => {
	assertEquals(Num.parse("   "), Option.none());
});

// ---------------------------------------------------------------------------
// add
// ---------------------------------------------------------------------------

Deno.test("Num.add adds the operand to the value", () => {
	assertStrictEquals(pipe(5, Num.add(3)), 8);
});

Deno.test("Num.add composes with Arr.map", () => {
	assertEquals(pipe([1, 2, 3], Arr.map(Num.add(10))), [11, 12, 13]);
});

// ---------------------------------------------------------------------------
// subtract
// ---------------------------------------------------------------------------

Deno.test("Num.subtract subtracts the operand from the value", () => {
	assertStrictEquals(pipe(10, Num.subtract(3)), 7);
});

Deno.test("Num.subtract composes with Arr.map", () => {
	assertEquals(pipe([5, 10, 15], Arr.map(Num.subtract(2))), [3, 8, 13]);
});

// ---------------------------------------------------------------------------
// multiply
// ---------------------------------------------------------------------------

Deno.test("Num.multiply multiplies the value by the operand", () => {
	assertStrictEquals(pipe(6, Num.multiply(7)), 42);
});

Deno.test("Num.multiply composes with Arr.map", () => {
	assertEquals(pipe([1, 2, 3], Arr.map(Num.multiply(100))), [100, 200, 300]);
});

// ---------------------------------------------------------------------------
// divide
// ---------------------------------------------------------------------------

Deno.test("Num.divide divides the value by the operand", () => {
	assertStrictEquals(pipe(20, Num.divide(4)), 5);
});

Deno.test("Num.divide composes with Arr.map", () => {
	assertEquals(pipe([10, 20, 30], Arr.map(Num.divide(10))), [1, 2, 3]);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

Deno.test("Num pipe composition - range, map, filter", () => {
	const result = pipe(
		Num.range(1, 10),
		Arr.map(Num.multiply(2)),
		Arr.filter(Num.between(6, 14)),
	);
	assertEquals(result, [6, 8, 10, 12, 14]);
});
