import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { These, TheseBoth } from "../These.ts";

// ---------------------------------------------------------------------------
// first / second / both
// ---------------------------------------------------------------------------

test("These.first creates a These with only a first value", () => {
	expect(These.first(42)).toEqual({ kind: "First", first: 42 });
});

test("These.second creates a These with only a second value", () => {
	expect(These.second("oops")).toEqual({ kind: "Second", second: "oops" });
});

test("These.both creates a These with both values", () => {
	const result: TheseBoth<number, string> = These.both(42, "warn");
	expect(result).toEqual({ kind: "Both", first: 42, second: "warn" });
});

// ---------------------------------------------------------------------------
// isFirst / isSecond / isBoth
// ---------------------------------------------------------------------------

test("These.isFirst returns true for First", () => {
	expect(These.isFirst(These.first(1))).toBe(true);
});

test("These.isFirst returns false for Second", () => {
	expect(These.isFirst(These.second("e"))).toBe(false);
});

test("These.isFirst returns false for Both", () => {
	expect(These.isFirst(These.both(1, "w"))).toBe(false);
});

test("These.isSecond returns true for Second", () => {
	expect(These.isSecond(These.second("e"))).toBe(true);
});

test("These.isSecond returns false for First", () => {
	expect(These.isSecond(These.first(1))).toBe(false);
});

test("These.isSecond returns false for Both", () => {
	expect(These.isSecond(These.both(1, "w"))).toBe(false);
});

test("These.isBoth returns true for Both", () => {
	expect(These.isBoth(These.both(1, "w"))).toBe(true);
});

test("These.isBoth returns false for First", () => {
	expect(These.isBoth(These.first(1))).toBe(false);
});

test("These.isBoth returns false for Second", () => {
	expect(These.isBoth(These.second("e"))).toBe(false);
});

// ---------------------------------------------------------------------------
// hasFirst / hasSecond
// ---------------------------------------------------------------------------

test("These.hasFirst returns true for First", () => {
	expect(These.hasFirst(These.first(1))).toBe(true);
});

test("These.hasFirst returns true for Both", () => {
	expect(These.hasFirst(These.both(1, "w"))).toBe(true);
});

test("These.hasFirst returns false for Second", () => {
	expect(These.hasFirst(These.second("e"))).toBe(false);
});

test("These.hasSecond returns true for Second", () => {
	expect(These.hasSecond(These.second("e"))).toBe(true);
});

test("These.hasSecond returns true for Both", () => {
	expect(These.hasSecond(These.both(1, "w"))).toBe(true);
});

test("These.hasSecond returns false for First", () => {
	expect(These.hasSecond(These.first(1))).toBe(false);
});

// ---------------------------------------------------------------------------
// mapFirst
// ---------------------------------------------------------------------------

test("These.mapFirst transforms First value", () => {
	expect(pipe(These.first(5), These.mapFirst((n: number) => n * 2))).toEqual({ kind: "First", first: 10 });
});

test("These.mapFirst transforms first value inside Both", () => {
	expect(pipe(These.both(5, "warn"), These.mapFirst((n: number) => n * 2))).toEqual({
		kind: "Both",
		first: 10,
		second: "warn",
	});
});

test("These.mapFirst passes through Second unchanged", () => {
	expect(pipe(These.second<string>("err"), These.mapFirst((n: number) => n * 2))).toEqual({
		kind: "Second",
		second: "err",
	});
});

// ---------------------------------------------------------------------------
// mapSecond
// ---------------------------------------------------------------------------

test("These.mapSecond transforms Second value", () => {
	expect(pipe(These.second("warn"), These.mapSecond((e: string) => e.toUpperCase()))).toEqual({
		kind: "Second",
		second: "WARN",
	});
});

test("These.mapSecond transforms second value inside Both", () => {
	expect(pipe(These.both(5, "warn"), These.mapSecond((e: string) => e.toUpperCase()))).toEqual({
		kind: "Both",
		first: 5,
		second: "WARN",
	});
});

test("These.mapSecond passes through First unchanged", () => {
	expect(pipe(These.first<number>(5), These.mapSecond((e: string) => e.toUpperCase()))).toEqual({
		kind: "First",
		first: 5,
	});
});

// ---------------------------------------------------------------------------
// mapBoth
// ---------------------------------------------------------------------------

test("These.mapBoth maps the first side for First", () => {
	expect(pipe(
		These.first(5),
		These.mapBoth(
			(n: number) => n * 2,
			(e: string) => e.toUpperCase(),
		),
	)).toEqual({ kind: "First", first: 10 });
});

test("These.mapBoth maps the second side for Second", () => {
	expect(pipe(
		These.second("warn"),
		These.mapBoth(
			(n: number) => n * 2,
			(e: string) => e.toUpperCase(),
		),
	)).toEqual({ kind: "Second", second: "WARN" });
});

test("These.mapBoth maps both sides for Both", () => {
	expect(pipe(
		These.both(5, "warn"),
		These.mapBoth(
			(n: number) => n * 2,
			(e: string) => e.toUpperCase(),
		),
	)).toEqual({ kind: "Both", first: 10, second: "WARN" });
});

// ---------------------------------------------------------------------------
// chainFirst
// ---------------------------------------------------------------------------

test("These.chainFirst applies function to First value", () => {
	expect(pipe(
		These.first(5),
		These.chainFirst((n: number) => These.first(n * 2)),
	)).toEqual({ kind: "First", first: 10 });
});

test("These.chainFirst propagates Second without calling function", () => {
	let called = false;
	pipe(
		These.second<string>("warn"),
		These.chainFirst((_n: number) => {
			called = true;
			return These.first(_n);
		}),
	);
	expect(called).toBe(false);
});

test("These.chainFirst on Both applies function to first value", () => {
	expect(pipe(
		These.both(5, "warn"),
		These.chainFirst((n: number) => These.first(n * 2)),
	)).toEqual({ kind: "First", first: 10 });
});

test("These.chainFirst can change the first value type", () => {
	expect(pipe(
		These.first(42),
		These.chainFirst((n: number) => These.first(`num: ${n}`)),
	)).toEqual({ kind: "First", first: "num: 42" });
});

// ---------------------------------------------------------------------------
// chainSecond
// ---------------------------------------------------------------------------

test("These.chainSecond applies function to Second value", () => {
	expect(pipe(
		These.second("warn"),
		These.chainSecond((s: string) => These.second(s.toUpperCase())),
	)).toEqual({ kind: "Second", second: "WARN" });
});

test("These.chainSecond propagates First without calling function", () => {
	let called = false;
	pipe(
		These.first<number>(5),
		These.chainSecond((_s: string) => {
			called = true;
			return These.second(_s);
		}),
	);
	expect(called).toBe(false);
});

test("These.chainSecond on Both applies function to second value", () => {
	expect(pipe(
		These.both(5, "warn"),
		These.chainSecond((s: string) => These.second(s.toUpperCase())),
	)).toEqual({ kind: "Second", second: "WARN" });
});

test("These.chainSecond can change the second value type", () => {
	expect(pipe(
		These.second("warn"),
		These.chainSecond((s: string) => These.second(s.length)),
	)).toEqual({ kind: "Second", second: 4 });
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("These.fold calls onFirst for First", () => {
	expect(pipe(
		These.first(5),
		These.fold(
			(a: number) => `first:${a}`,
			(b: string) => `second:${b}`,
			(a: number, b: string) => `both:${a}/${b}`,
		),
	)).toBe("first:5");
});

test("These.fold calls onSecond for Second", () => {
	expect(pipe(
		These.second("e"),
		These.fold(
			(a: number) => `first:${a}`,
			(b: string) => `second:${b}`,
			(a: number, b: string) => `both:${a}/${b}`,
		),
	)).toBe("second:e");
});

test("These.fold calls onBoth for Both", () => {
	expect(pipe(
		These.both(5, "w"),
		These.fold(
			(a: number) => `first:${a}`,
			(b: string) => `second:${b}`,
			(a: number, b: string) => `both:${a}/${b}`,
		),
	)).toBe("both:5/w");
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

test("These.match calls first handler for First", () => {
	expect(pipe(
		These.first(5),
		These.match({
			first: (a: number) => `first:${a}`,
			second: (b: string) => `second:${b}`,
			both: (a: number, b: string) => `both:${a}/${b}`,
		}),
	)).toBe("first:5");
});

test("These.match calls second handler for Second", () => {
	expect(pipe(
		These.second("e"),
		These.match({
			first: (a: number) => `first:${a}`,
			second: (b: string) => `second:${b}`,
			both: (a: number, b: string) => `both:${a}/${b}`,
		}),
	)).toBe("second:e");
});

test("These.match calls both handler for Both", () => {
	expect(pipe(
		These.both(5, "w"),
		These.match({
			first: (a: number) => `first:${a}`,
			second: (b: string) => `second:${b}`,
			both: (a: number, b: string) => `both:${a}/${b}`,
		}),
	)).toBe("both:5/w");
});

// ---------------------------------------------------------------------------
// getFirstOrElse / getSecondOrElse
// ---------------------------------------------------------------------------

test("These.getFirstOrElse returns first value for First", () => {
	expect(pipe(These.first(5), These.getFirstOrElse(() => 0))).toBe(5);
});

test("These.getFirstOrElse returns first value for Both", () => {
	expect(pipe(These.both(5, "w"), These.getFirstOrElse(() => 0))).toBe(5);
});

test("These.getFirstOrElse returns default for Second", () => {
	expect(pipe(These.second<string>("warn"), These.getFirstOrElse(() => 0))).toBe(0);
});

test("These.getFirstOrElse widens return type to A | C when default is a different type", () => {
	const result = pipe(These.second("warn"), These.getFirstOrElse(() => null));
	expect(result).toBeNull();
});

test("These.getFirstOrElse returns first value typed as A | C when present", () => {
	const result = pipe(These.first(5), These.getFirstOrElse(() => null));
	expect(result).toBe(5);
});

test("These.getFirstOrElse does not call thunk when value is present", () => {
	let called = false;
	pipe(
		These.first(5),
		These.getFirstOrElse(() => {
			called = true;
			return 0;
		}),
	);
	expect(called).toBe(false);
});

test("These.getSecondOrElse returns second value for Second", () => {
	expect(pipe(These.second("warn"), These.getSecondOrElse(() => "none"))).toBe("warn");
});

test("These.getSecondOrElse returns second value for Both", () => {
	expect(pipe(These.both(5, "warn"), These.getSecondOrElse(() => "none"))).toBe("warn");
});

test("These.getSecondOrElse returns default for First", () => {
	expect(pipe(These.first<number>(5), These.getSecondOrElse(() => "none"))).toBe("none");
});

test("These.getSecondOrElse widens return type to B | D when default is a different type", () => {
	const result = pipe(These.first(5), These.getSecondOrElse(() => null));
	expect(result).toBeNull();
});

test("These.getSecondOrElse returns second value typed as B | D when present", () => {
	const result = pipe(These.second("warn"), These.getSecondOrElse(() => null));
	expect(result).toBe("warn");
});

test("These.getSecondOrElse does not call thunk when value is present", () => {
	let called = false;
	pipe(
		These.second("warn"),
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

test("These.tap executes side effect on First and returns original", () => {
	let seen = 0;
	const result = pipe(
		These.first(5),
		These.tap((n: number) => {
			seen = n;
		}),
	);
	expect(seen).toBe(5);
	expect(result).toEqual({ kind: "First", first: 5 });
});

test("These.tap executes side effect on Both and returns original", () => {
	let seen = 0;
	const result = pipe(
		These.both(7, "w"),
		These.tap((n: number) => {
			seen = n;
		}),
	);
	expect(seen).toBe(7);
	expect(result).toEqual({ kind: "Both", first: 7, second: "w" });
});

test("These.tap does not execute side effect on Second", () => {
	let called = false;
	pipe(
		These.second<string>("e"),
		These.tap((_n: number) => {
			called = true;
		}),
	);
	expect(called).toBe(false);
});

// ---------------------------------------------------------------------------
// swap
// ---------------------------------------------------------------------------

test("These.swap converts First to Second", () => {
	expect(These.swap(These.first(5))).toEqual({ kind: "Second", second: 5 });
});

test("These.swap converts Second to First", () => {
	expect(These.swap(These.second("e"))).toEqual({ kind: "First", first: "e" });
});

test("These.swap swaps Both sides", () => {
	expect(These.swap(These.both(5, "w"))).toEqual({
		kind: "Both",
		first: "w",
		second: 5,
	});
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("These composes well in a pipe chain", () => {
	const result = pipe(
		These.first(5),
		These.mapFirst((n: number) => n * 2),
		These.chainFirst((n: number) => n > 5 ? These.first(n) : These.second<string>("Too small")),
		These.getFirstOrElse(() => 0),
	);
	expect(result).toBe(10);
});

test("These chainFirst on Both discards second", () => {
	const result = pipe(
		These.both(5, "original warning"),
		These.mapFirst((n: number) => n + 1),
		These.chainFirst((n: number) => These.first(n * 2)),
	);
	expect(result).toEqual({ kind: "First", first: 12 });
});
