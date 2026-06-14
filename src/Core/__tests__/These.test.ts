import { pipe } from "#composition";
import { These, TheseBoth } from "#core";
import { expect, test } from "vitest";

// ---------------------------------------------------------------------------
// first / second / both
// ---------------------------------------------------------------------------

test("These.make.first creates a These with only a first value", () => {
	expect(These.make.first(42)).toStrictEqual({ kind: "First", first: 42 });
});

test("These.make.second creates a These with only a second value", () => {
	expect(These.make.second("oops")).toStrictEqual({ kind: "Second", second: "oops" });
});

test("These.make.both creates a These with both values", () => {
	const result: TheseBoth<number, string> = These.make.both(42, "warn");
	expect(result).toStrictEqual({ kind: "Both", first: 42, second: "warn" });
});

// ---------------------------------------------------------------------------
// isFirst / isSecond / isBoth
// ---------------------------------------------------------------------------

test("These.is.first returns true for First", () => {
	expect(These.is.first(These.make.first(1))).toBe(true);
});

test("These.is.first returns false for Second", () => {
	expect(These.is.first(These.make.second("e"))).toBe(false);
});

test("These.is.first returns false for Both", () => {
	expect(These.is.first(These.make.both(1, "w"))).toBe(false);
});

test("These.is.second returns true for Second", () => {
	expect(These.is.second(These.make.second("e"))).toBe(true);
});

test("These.is.second returns false for First", () => {
	expect(These.is.second(These.make.first(1))).toBe(false);
});

test("These.is.second returns false for Both", () => {
	expect(These.is.second(These.make.both(1, "w"))).toBe(false);
});

test("These.is.both returns true for Both", () => {
	expect(These.is.both(These.make.both(1, "w"))).toBe(true);
});

test("These.is.both returns false for First", () => {
	expect(These.is.both(These.make.first(1))).toBe(false);
});

test("These.is.both returns false for Second", () => {
	expect(These.is.both(These.make.second("e"))).toBe(false);
});

// ---------------------------------------------------------------------------
// hasFirst / hasSecond
// ---------------------------------------------------------------------------

test("These.hasFirst returns true for First", () => {
	expect(These.hasFirst(These.make.first(1))).toBe(true);
});

test("These.hasFirst returns true for Both", () => {
	expect(These.hasFirst(These.make.both(1, "w"))).toBe(true);
});

test("These.hasFirst returns false for Second", () => {
	expect(These.hasFirst(These.make.second("e"))).toBe(false);
});

test("These.hasSecond returns true for Second", () => {
	expect(These.hasSecond(These.make.second("e"))).toBe(true);
});

test("These.hasSecond returns true for Both", () => {
	expect(These.hasSecond(These.make.both(1, "w"))).toBe(true);
});

test("These.hasSecond returns false for First", () => {
	expect(These.hasSecond(These.make.first(1))).toBe(false);
});

// ---------------------------------------------------------------------------
// mapFirst
// ---------------------------------------------------------------------------

test("These.mapFirst transforms First value", () => {
	expect(pipe(These.make.first(5), These.mapFirst((n: number) => n * 2))).toStrictEqual({ kind: "First", first: 10 });
});

test("These.mapFirst transforms first value inside Both", () => {
	expect(pipe(These.make.both(5, "warn"), These.mapFirst((n: number) => n * 2))).toStrictEqual({
		kind: "Both",
		first: 10,
		second: "warn",
	});
});

test("These.mapFirst passes through Second unchanged", () => {
	expect(pipe(These.make.second<string>("err"), These.mapFirst((n: number) => n * 2))).toStrictEqual({
		kind: "Second",
		second: "err",
	});
});

// ---------------------------------------------------------------------------
// mapSecond
// ---------------------------------------------------------------------------

test("These.mapSecond transforms Second value", () => {
	expect(pipe(These.make.second("warn"), These.mapSecond((e: string) => e.toUpperCase()))).toStrictEqual({
		kind: "Second",
		second: "WARN",
	});
});

test("These.mapSecond transforms second value inside Both", () => {
	expect(pipe(These.make.both(5, "warn"), These.mapSecond((e: string) => e.toUpperCase()))).toStrictEqual({
		kind: "Both",
		first: 5,
		second: "WARN",
	});
});

test("These.mapSecond passes through First unchanged", () => {
	expect(pipe(These.make.first<number>(5), These.mapSecond((e: string) => e.toUpperCase()))).toStrictEqual({
		kind: "First",
		first: 5,
	});
});

// ---------------------------------------------------------------------------
// mapBoth
// ---------------------------------------------------------------------------

test("These.mapBoth maps the first side for First", () => {
	expect(pipe(These.make.first(5), These.mapBoth((n: number) => n * 2, (e: string) => e.toUpperCase()))).toStrictEqual({
		kind: "First",
		first: 10,
	});
});

test("These.mapBoth maps the second side for Second", () => {
	expect(pipe(These.make.second("warn"), These.mapBoth((n: number) => n * 2, (e: string) => e.toUpperCase())))
		.toStrictEqual({ kind: "Second", second: "WARN" });
});

test("These.mapBoth maps both sides for Both", () => {
	expect(pipe(These.make.both(5, "warn"), These.mapBoth((n: number) => n * 2, (e: string) => e.toUpperCase())))
		.toStrictEqual({ kind: "Both", first: 10, second: "WARN" });
});

// ---------------------------------------------------------------------------
// chainFirst
// ---------------------------------------------------------------------------

test("These.chainFirst applies function to First value", () => {
	expect(pipe(These.make.first(5), These.chainFirst((n: number) => These.make.first(n * 2)))).toStrictEqual({
		kind: "First",
		first: 10,
	});
});

test("These.chainFirst propagates Second without calling function", () => {
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

test("These.chainFirst on Both applies function to first value", () => {
	expect(pipe(These.make.both(5, "warn"), These.chainFirst((n: number) => These.make.first(n * 2)))).toStrictEqual({
		kind: "First",
		first: 10,
	});
});

test("These.chainFirst can change the first value type", () => {
	expect(pipe(These.make.first(42), These.chainFirst((n: number) => These.make.first(`num: ${n}`)))).toStrictEqual({
		kind: "First",
		first: "num: 42",
	});
});

// ---------------------------------------------------------------------------
// chainSecond
// ---------------------------------------------------------------------------

test("These.chainSecond applies function to Second value", () => {
	expect(pipe(These.make.second("warn"), These.chainSecond((s: string) => These.make.second(s.toUpperCase()))))
		.toStrictEqual({ kind: "Second", second: "WARN" });
});

test("These.chainSecond propagates First without calling function", () => {
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

test("These.chainSecond on Both applies function to second value", () => {
	expect(pipe(These.make.both(5, "warn"), These.chainSecond((s: string) => These.make.second(s.toUpperCase()))))
		.toStrictEqual({ kind: "Second", second: "WARN" });
});

test("These.chainSecond can change the second value type", () => {
	expect(pipe(These.make.second("warn"), These.chainSecond((s: string) => These.make.second(s.length)))).toStrictEqual({
		kind: "Second",
		second: 4,
	});
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("These.fold calls onFirst for First", () => {
	expect(
		pipe(
			These.make.first(5),
			These.fold((a: number) => `first:${a}`, (b: string) => `second:${b}`, (a: number, b: string) => `both:${a}/${b}`),
		),
	).toBe("first:5");
});

test("These.fold calls onSecond for Second", () => {
	expect(
		pipe(
			These.make.second("e"),
			These.fold((a: number) => `first:${a}`, (b: string) => `second:${b}`, (a: number, b: string) => `both:${a}/${b}`),
		),
	).toBe("second:e");
});

test("These.fold calls onBoth for Both", () => {
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

test("These.match calls first handler for First", () => {
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

test("These.match calls second handler for Second", () => {
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

test("These.match calls both handler for Both", () => {
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

test("These.getFirstOrElse returns first value for First", () => {
	expect(pipe(These.make.first(5), These.getFirstOrElse(() => 0))).toBe(5);
});

test("These.getFirstOrElse returns first value for Both", () => {
	expect(pipe(These.make.both(5, "w"), These.getFirstOrElse(() => 0))).toBe(5);
});

test("These.getFirstOrElse returns default for Second", () => {
	expect(pipe(These.make.second<string>("warn"), These.getFirstOrElse(() => 0))).toBe(0);
});

test("These.getFirstOrElse widens return type to A | C when default is a different type", () => {
	const result = pipe(These.make.second("warn"), These.getFirstOrElse(() => null));
	expect(result).toBeNull();
});

test("These.getFirstOrElse returns first value typed as A | C when present", () => {
	const result = pipe(These.make.first(5), These.getFirstOrElse(() => null));
	expect(result).toBe(5);
});

test("These.getFirstOrElse does not call thunk when value is present", () => {
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

test("These.getSecondOrElse returns second value for Second", () => {
	expect(pipe(These.make.second("warn"), These.getSecondOrElse(() => "none"))).toBe("warn");
});

test("These.getSecondOrElse returns second value for Both", () => {
	expect(pipe(These.make.both(5, "warn"), These.getSecondOrElse(() => "none"))).toBe("warn");
});

test("These.getSecondOrElse returns default for First", () => {
	expect(pipe(These.make.first<number>(5), These.getSecondOrElse(() => "none"))).toBe("none");
});

test("These.getSecondOrElse widens return type to B | D when default is a different type", () => {
	const result = pipe(These.make.first(5), These.getSecondOrElse(() => null));
	expect(result).toBeNull();
});

test("These.getSecondOrElse returns second value typed as B | D when present", () => {
	const result = pipe(These.make.second("warn"), These.getSecondOrElse(() => null));
	expect(result).toBe("warn");
});

test("These.getSecondOrElse does not call thunk when value is present", () => {
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

test("These.tap executes side effect on First and returns original", () => {
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

test("These.tap executes side effect on Both and returns original", () => {
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

test("These.tap does not execute side effect on Second", () => {
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

test("These.swap converts First to Second", () => {
	expect(These.swap(These.make.first(5))).toStrictEqual({ kind: "Second", second: 5 });
});

test("These.swap converts Second to First", () => {
	expect(These.swap(These.make.second("e"))).toStrictEqual({ kind: "First", first: "e" });
});

test("These.swap swaps Both sides", () => {
	expect(These.swap(These.make.both(5, "w"))).toStrictEqual({ kind: "Both", first: "w", second: 5 });
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("these composes well in a pipe chain", () => {
	const result = pipe(
		These.make.first(5),
		These.mapFirst((n: number) => n * 2),
		These.chainFirst((n: number) => n > 5 ? These.make.first(n) : These.make.second<string>("Too small")),
		These.getFirstOrElse(() => 0),
	);
	expect(result).toBe(10);
});

test("these chainFirst on Both discards second", () => {
	const result = pipe(
		These.make.both(5, "original warning"),
		These.mapFirst((n: number) => n + 1),
		These.chainFirst((n: number) => These.make.first(n * 2)),
	);
	expect(result).toStrictEqual({ kind: "First", first: 12 });
});
