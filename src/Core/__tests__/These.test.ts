import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { These } from "../These.ts";

test("types: propagates types correctly for chainFirst chainSecond and mapBoth", () => {
	const t1: These<number, string> = These.make.both(42, "warning");
	const res1 = pipe(t1, These.chainFirst((n) => These.make.first(n > 0)));
	expectTypeOf(res1).toEqualTypeOf<These<boolean, string>>();

	const res2 = pipe(t1, These.chainSecond((s) => These.make.second(s.length)));
	expectTypeOf(res2).toEqualTypeOf<These<number, number>>();

	const res3 = pipe(t1, These.mapBoth((n) => n > 0, (s) => s.length));
	expectTypeOf(res3).toEqualTypeOf<These<boolean, number>>();
});

// ---------------------------------------------------------------------------
// first / second / both
// ---------------------------------------------------------------------------

test("make.first: creates a These with only a first value", () => {
	expect(These.make.first(42)).toStrictEqual({ kind: "First", first: 42 });
});

test("make.second: creates a These with only a second value", () => {
	expect(These.make.second("oops")).toStrictEqual({ kind: "Second", second: "oops" });
});

test("make.both: creates a These with both values", () => {
	const result: These.Both<number, string> = These.make.both(42, "warn");
	expect(result).toStrictEqual({ kind: "Both", first: 42, second: "warn" });
});

// ---------------------------------------------------------------------------
// isFirst / isSecond / isBoth
// ---------------------------------------------------------------------------

test("is.first: returns true for First", () => {
	expect(These.is.first(These.make.first(1))).toBe(true);
});

test("is.first: returns false for Second", () => {
	expect(These.is.first(These.make.second("e"))).toBe(false);
});

test("is.first: returns false for Both", () => {
	expect(These.is.first(These.make.both(1, "w"))).toBe(false);
});

test("is.second: returns true for Second", () => {
	expect(These.is.second(These.make.second("e"))).toBe(true);
});

test("is.second: returns false for First", () => {
	expect(These.is.second(These.make.first(1))).toBe(false);
});

test("is.second: returns false for Both", () => {
	expect(These.is.second(These.make.both(1, "w"))).toBe(false);
});

test("is.both: returns true for Both", () => {
	expect(These.is.both(These.make.both(1, "w"))).toBe(true);
});

test("is.both: returns false for First", () => {
	expect(These.is.both(These.make.first(1))).toBe(false);
});

test("is.both: returns false for Second", () => {
	expect(These.is.both(These.make.second("e"))).toBe(false);
});

// ---------------------------------------------------------------------------
// hasFirst / hasSecond
// ---------------------------------------------------------------------------

test("hasFirst: returns true for First", () => {
	expect(These.hasFirst(These.make.first(1))).toBe(true);
});

test("hasFirst: returns true for Both", () => {
	expect(These.hasFirst(These.make.both(1, "w"))).toBe(true);
});

test("hasFirst: returns false for Second", () => {
	expect(These.hasFirst(These.make.second("e"))).toBe(false);
});

test("hasSecond: returns true for Second", () => {
	expect(These.hasSecond(These.make.second("e"))).toBe(true);
});

test("hasSecond: returns true for Both", () => {
	expect(These.hasSecond(These.make.both(1, "w"))).toBe(true);
});

test("hasSecond: returns false for First", () => {
	expect(These.hasSecond(These.make.first(1))).toBe(false);
});

// ---------------------------------------------------------------------------
// mapFirst
// ---------------------------------------------------------------------------

test("mapFirst: transforms First value", () => {
	expect(pipe(These.make.first(5), These.mapFirst((n: number) => n * 2))).toStrictEqual({ kind: "First", first: 10 });
});

test("mapFirst: transforms first value inside Both", () => {
	expect(pipe(These.make.both(5, "warn"), These.mapFirst((n: number) => n * 2))).toStrictEqual({
		kind: "Both",
		first: 10,
		second: "warn",
	});
});

test("mapFirst: passes through Second unchanged", () => {
	expect(pipe(These.make.second<string>("err"), These.mapFirst((n: number) => n * 2))).toStrictEqual({
		kind: "Second",
		second: "err",
	});
});

// ---------------------------------------------------------------------------
// mapSecond
// ---------------------------------------------------------------------------

test("mapSecond: transforms Second value", () => {
	expect(pipe(These.make.second("warn"), These.mapSecond((e: string) => e.toUpperCase()))).toStrictEqual({
		kind: "Second",
		second: "WARN",
	});
});

test("mapSecond: transforms second value inside Both", () => {
	expect(pipe(These.make.both(5, "warn"), These.mapSecond((e: string) => e.toUpperCase()))).toStrictEqual({
		kind: "Both",
		first: 5,
		second: "WARN",
	});
});

test("mapSecond: passes through First unchanged", () => {
	expect(pipe(These.make.first<number>(5), These.mapSecond((e: string) => e.toUpperCase()))).toStrictEqual({
		kind: "First",
		first: 5,
	});
});

// ---------------------------------------------------------------------------
// mapBoth
// ---------------------------------------------------------------------------

test("mapBoth: maps first side for First", () => {
	expect(pipe(These.make.first(5), These.mapBoth((n: number) => n * 2, (e: string) => e.toUpperCase()))).toStrictEqual({
		kind: "First",
		first: 10,
	});
});

test("mapBoth: maps second side for Second", () => {
	expect(pipe(These.make.second("warn"), These.mapBoth((n: number) => n * 2, (e: string) => e.toUpperCase())))
		.toStrictEqual({ kind: "Second", second: "WARN" });
});

test("mapBoth: maps both sides for Both", () => {
	expect(pipe(These.make.both(5, "warn"), These.mapBoth((n: number) => n * 2, (e: string) => e.toUpperCase())))
		.toStrictEqual({ kind: "Both", first: 10, second: "WARN" });
});

// ---------------------------------------------------------------------------
// chainFirst
// ---------------------------------------------------------------------------

test("chainFirst: applies function to First value", () => {
	expect(pipe(These.make.first(5), These.chainFirst((n: number) => These.make.first(n * 2)))).toStrictEqual({
		kind: "First",
		first: 10,
	});
});

test("chainFirst: propagates Second without calling function", () => {
	let called = false;
	pipe(
		These.make.second<string>("warn"),
		These.chainFirst((_n: number) => {
			called = true;
			return These.make.first(_n);
		}),
	);
	expect(called).toBe(false);
});

test("chainFirst: applies function to first value on Both", () => {
	expect(pipe(These.make.both(5, "warn"), These.chainFirst((n: number) => These.make.first(n * 2)))).toStrictEqual({
		kind: "First",
		first: 10,
	});
});

test("chainFirst: changes first value type", () => {
	expect(pipe(These.make.first(42), These.chainFirst((n: number) => These.make.first(`num: ${n}`)))).toStrictEqual({
		kind: "First",
		first: "num: 42",
	});
});

// ---------------------------------------------------------------------------
// chainSecond
// ---------------------------------------------------------------------------

test("chainSecond: applies function to Second value", () => {
	expect(pipe(These.make.second("warn"), These.chainSecond((s: string) => These.make.second(s.toUpperCase()))))
		.toStrictEqual({ kind: "Second", second: "WARN" });
});

test("chainSecond: propagates First without calling function", () => {
	let called = false;
	pipe(
		These.make.first<number>(5),
		These.chainSecond((_s: string) => {
			called = true;
			return These.make.second(_s);
		}),
	);
	expect(called).toBe(false);
});

test("chainSecond: applies function to second value on Both", () => {
	expect(pipe(These.make.both(5, "warn"), These.chainSecond((s: string) => These.make.second(s.toUpperCase()))))
		.toStrictEqual({ kind: "Second", second: "WARN" });
});

test("chainSecond: changes second value type", () => {
	expect(pipe(These.make.second("warn"), These.chainSecond((s: string) => These.make.second(s.length)))).toStrictEqual({
		kind: "Second",
		second: 4,
	});
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("fold: calls onFirst for First", () => {
	expect(
		pipe(
			These.make.first(5),
			These.fold((a: number) => `first:${a}`, (b: string) => `second:${b}`, (a: number, b: string) => `both:${a}/${b}`),
		),
	).toBe("first:5");
});

test("fold: calls onSecond for Second", () => {
	expect(
		pipe(
			These.make.second("e"),
			These.fold((a: number) => `first:${a}`, (b: string) => `second:${b}`, (a: number, b: string) => `both:${a}/${b}`),
		),
	).toBe("second:e");
});

test("fold: calls onBoth for Both", () => {
	expect(
		pipe(
			These.make.both(5, "w"),
			These.fold((a: number) => `first:${a}`, (b: string) => `second:${b}`, (a: number, b: string) => `both:${a}/${b}`),
		),
	).toBe("both:5/w");
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

test("match: calls first handler for First", () => {
	expect(
		pipe(
			These.make.first(5),
			These.match({
				first: (a: number) => `first:${a}`,
				second: (b: string) => `second:${b}`,
				both: (a: number, b: string) => `both:${a}/${b}`,
			}),
		),
	).toBe("first:5");
});

test("match: calls second handler for Second", () => {
	expect(
		pipe(
			These.make.second("e"),
			These.match({
				first: (a: number) => `first:${a}`,
				second: (b: string) => `second:${b}`,
				both: (a: number, b: string) => `both:${a}/${b}`,
			}),
		),
	).toBe("second:e");
});

test("match: calls both handler for Both", () => {
	expect(
		pipe(
			These.make.both(5, "w"),
			These.match({
				first: (a: number) => `first:${a}`,
				second: (b: string) => `second:${b}`,
				both: (a: number, b: string) => `both:${a}/${b}`,
			}),
		),
	).toBe("both:5/w");
});

// ---------------------------------------------------------------------------
// getFirstOrElse / getSecondOrElse
// ---------------------------------------------------------------------------

test("getFirstOrElse: returns first value for First", () => {
	expect(pipe(These.make.first(5), These.getFirstOrElse(() => 0))).toBe(5);
});

test("getFirstOrElse: returns first value for Both", () => {
	expect(pipe(These.make.both(5, "w"), These.getFirstOrElse(() => 0))).toBe(5);
});

test("getFirstOrElse: returns default for Second", () => {
	expect(pipe(These.make.second<string>("warn"), These.getFirstOrElse(() => 0))).toBe(0);
});

test("getFirstOrElse: widens return type when default is different type", () => {
	const result = pipe(These.make.second("warn"), These.getFirstOrElse(() => null));
	expect(result).toBeNull();
});

test("getFirstOrElse: returns first value when present", () => {
	const result = pipe(These.make.first(5), These.getFirstOrElse(() => null));
	expect(result).toBe(5);
});

test("getFirstOrElse: does not call thunk when value is present", () => {
	let called = false;
	pipe(
		These.make.first(5),
		These.getFirstOrElse(() => {
			called = true;
			return 0;
		}),
	);
	expect(called).toBe(false);
});

test("getSecondOrElse: returns second value for Second", () => {
	expect(pipe(These.make.second("warn"), These.getSecondOrElse(() => "none"))).toBe("warn");
});

test("getSecondOrElse: returns second value for Both", () => {
	expect(pipe(These.make.both(5, "warn"), These.getSecondOrElse(() => "none"))).toBe("warn");
});

test("getSecondOrElse: returns default for First", () => {
	expect(pipe(These.make.first<number>(5), These.getSecondOrElse(() => "none"))).toBe("none");
});

test("getSecondOrElse: widens return type when default is different type", () => {
	const result = pipe(These.make.first(5), These.getSecondOrElse(() => null));
	expect(result).toBeNull();
});

test("getSecondOrElse: returns second value when present", () => {
	const result = pipe(These.make.second("warn"), These.getSecondOrElse(() => null));
	expect(result).toBe("warn");
});

test("getSecondOrElse: does not call thunk when value is present", () => {
	let called = false;
	pipe(
		These.make.second("warn"),
		These.getSecondOrElse(() => {
			called = true;
			return "none";
		}),
	);
	expect(called).toBe(false);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("tap: executes side effect on First and returns original", () => {
	let seen = 0;
	const result = pipe(
		These.make.first(5),
		These.tap((n: number) => {
			seen = n;
		}),
	);
	expect(seen).toBe(5);
	expect(result).toStrictEqual({ kind: "First", first: 5 });
});

test("tap: executes side effect on Both and returns original", () => {
	let seen = 0;
	const result = pipe(
		These.make.both(7, "w"),
		These.tap((n: number) => {
			seen = n;
		}),
	);
	expect(seen).toBe(7);
	expect(result).toStrictEqual({ kind: "Both", first: 7, second: "w" });
});

test("tap: does not execute side effect on Second", () => {
	let called = false;
	pipe(
		These.make.second<string>("e"),
		These.tap((_n: number) => {
			called = true;
		}),
	);
	expect(called).toBe(false);
});

// ---------------------------------------------------------------------------
// swap
// ---------------------------------------------------------------------------

test("swap: converts First to Second", () => {
	expect(These.swap(These.make.first(5))).toStrictEqual({ kind: "Second", second: 5 });
});

test("swap: converts Second to First", () => {
	expect(These.swap(These.make.second("e"))).toStrictEqual({ kind: "First", first: "e" });
});

test("swap: swaps Both sides", () => {
	expect(These.swap(These.make.both(5, "w"))).toStrictEqual({ kind: "Both", first: "w", second: 5 });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("pipe: composes in pipeline", () => {
	const result = pipe(
		These.make.first(5),
		These.mapFirst((n: number) => n * 2),
		These.chainFirst((n: number) => n > 5 ? These.make.first(n) : These.make.second<string>("Too small")),
		These.getFirstOrElse(() => 0),
	);
	expect(result).toBe(10);
});

test("chainFirst: discards second when invoked on Both", () => {
	const result = pipe(
		These.make.both(5, "original warning"),
		These.mapFirst((n: number) => n + 1),
		These.chainFirst((n: number) => These.make.first(n * 2)),
	);
	expect(result).toStrictEqual({ kind: "First", first: 12 });
});
