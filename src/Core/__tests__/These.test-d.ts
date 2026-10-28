import { constTruthyBool } from "#test-utils";
import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import type { Maybe } from "../Maybe.ts";
import { Pair } from "../Pair.ts";
import { These } from "../These.ts";

test("make: constructs exact variant types", () => {
	const first = These.make.first(42);
	expectTypeOf(first).toEqualTypeOf<These.First<number>>();
	expectTypeOf(first.kind).toEqualTypeOf<"First">();
	expectTypeOf(first.first).toEqualTypeOf<number>();

	const second = These.make.second("warn");
	expectTypeOf(second).toEqualTypeOf<These.Second<string>>();
	expectTypeOf(second.kind).toEqualTypeOf<"Second">();
	expectTypeOf(second.second).toEqualTypeOf<string>();

	const both = These.make.both(42, "warn");
	expectTypeOf(both).toEqualTypeOf<These.Both<number, string>>();
	expectTypeOf(both.kind).toEqualTypeOf<"Both">();
	expectTypeOf(both.first).toEqualTypeOf<number>();
	expectTypeOf(both.second).toEqualTypeOf<string>();
});

test("is guards: narrows These to individual variant subtypes", () => {
	const naturalUnion: These<number, string> = constTruthyBool()
		? These.make.first(42)
		: constTruthyBool()
		? These.make.second("warn")
		: These.make.both(42, "warn");

	if (These.is.first(naturalUnion)) {
		expectTypeOf(naturalUnion).toEqualTypeOf<These.First<number>>();
		expectTypeOf(naturalUnion.first).toEqualTypeOf<number>();
		// @ts-expect-error - second does not exist on First
		expectTypeOf(naturalUnion.second).toBeUndefined();
	} else if (These.is.second(naturalUnion)) {
		expectTypeOf(naturalUnion).toEqualTypeOf<These.Second<string>>();
		expectTypeOf(naturalUnion.second).toEqualTypeOf<string>();
		// @ts-expect-error - first does not exist on Second
		expectTypeOf(naturalUnion.first).toBeUndefined();
	} else if (These.is.both(naturalUnion)) {
		expectTypeOf(naturalUnion).toEqualTypeOf<These.Both<number, string>>();
		expectTypeOf(naturalUnion.first).toEqualTypeOf<number>();
		expectTypeOf(naturalUnion.second).toEqualTypeOf<string>();
	}
});

test("hasFirst & hasSecond: checks presence of first or second channel", () => {
	const naturalUnion: These<number, string> = constTruthyBool()
		? These.make.first(42)
		: constTruthyBool()
		? These.make.second("warn")
		: These.make.both(42, "warn");

	if (These.hasFirst(naturalUnion)) {
		expectTypeOf(naturalUnion).toEqualTypeOf<These.First<number> | These.Both<number, string>>();
		expectTypeOf(naturalUnion.first).toEqualTypeOf<number>();
	}

	if (These.hasSecond(naturalUnion)) {
		expectTypeOf(naturalUnion).toEqualTypeOf<These.Second<string> | These.Both<number, string>>();
		expectTypeOf(naturalUnion.second).toEqualTypeOf<string>();
	}
});

test("mapFirst: transforms first channel and preserves second channel", () => {
	const naturalUnion: These<number, string> = constTruthyBool() ? These.make.first(42) : These.make.second("warn");

	const mapped = pipe(naturalUnion, These.mapFirst((n) => n.toString()));
	expectTypeOf(mapped).toEqualTypeOf<These<string, string>>();
});

test("mapSecond: transforms second channel and preserves first channel", () => {
	const naturalUnion: These<number, string> = constTruthyBool() ? These.make.first(42) : These.make.second("warn");

	const mapped = pipe(naturalUnion, These.mapSecond((s) => s.length));
	expectTypeOf(mapped).toEqualTypeOf<These<number, number>>();
});

test("mapBoth: transforms both channels simultaneously", () => {
	const naturalUnion: These<number, string> = constTruthyBool() ? These.make.first(42) : These.make.second("warn");

	const mapped = pipe(naturalUnion, These.mapBoth((n) => n > 0, (s) => s.length));
	expectTypeOf(mapped).toEqualTypeOf<These<boolean, number>>();
});

test("chainFirst: chains first computation and unifies second channels", () => {
	const naturalUnion: These<number, string> = constTruthyBool() ? These.make.first(42) : These.make.second("warn");

	const chained = pipe(
		naturalUnion,
		These.chainFirst((n) => constTruthyBool() ? These.make.first(n > 0) : These.make.second(new Error("validation"))),
	);
	expectTypeOf(chained).toEqualTypeOf<These<boolean, string | Error>>();
});

test("chainSecond: chains second computation and unifies first channels", () => {
	const naturalUnion: These<number, string> = constTruthyBool() ? These.make.first(42) : These.make.second("warn");

	const chained = pipe(
		naturalUnion,
		These.chainSecond((s) => constTruthyBool() ? These.make.second(s.length) : These.make.first(true)),
	);
	expectTypeOf(chained).toEqualTypeOf<These<number | boolean, number>>();
});

test("match: handles all three variants with unified return type", () => {
	const naturalUnion: These<number, string> = constTruthyBool() ? These.make.first(42) : These.make.second("warn");

	const matched = pipe(
		naturalUnion,
		These.match({ first: (n) => `num: ${n}`, second: (s) => `str: ${s}`, both: (n, s) => `both: ${n}-${s}` }),
	);
	expectTypeOf(matched).toEqualTypeOf<string>();

	// @ts-expect-error - missing both handler
	pipe(naturalUnion, These.match({ first: (n) => n, second: (s) => s.length }));
});

test("getFirstOrElse & getSecondOrElse: retrieves value or fallback without collapse", () => {
	const naturalUnion: These<number, string> = constTruthyBool() ? These.make.first(42) : These.make.second("warn");

	const firstWiden = pipe(naturalUnion, These.getFirstOrElse(() => "fallback"));
	expectTypeOf(firstWiden).toEqualTypeOf<number | string>();

	const secondWiden = pipe(naturalUnion, These.getSecondOrElse(() => 999));
	expectTypeOf(secondWiden).toEqualTypeOf<string | number>();
});

test("tapFirst, tapSecond, tapBoth: executes side effects without altering channels", () => {
	const naturalUnion: These<number, string> = constTruthyBool() ? These.make.first(42) : These.make.second("warn");

	const tappedFirst = pipe(
		naturalUnion,
		These.tapFirst((n) => {
			expectTypeOf(n).toEqualTypeOf<number>();
		}),
	);
	expectTypeOf(tappedFirst).toEqualTypeOf<These<number, string>>();

	const tappedSecond = pipe(
		naturalUnion,
		These.tapSecond((s) => {
			expectTypeOf(s).toEqualTypeOf<string>();
		}),
	);
	expectTypeOf(tappedSecond).toEqualTypeOf<These<number, string>>();

	const tappedBoth = pipe(
		naturalUnion,
		These.tapBoth((n, s) => {
			expectTypeOf(n).toEqualTypeOf<number>();
			expectTypeOf(s).toEqualTypeOf<string>();
		}),
	);
	expectTypeOf(tappedBoth).toEqualTypeOf<These<number, string>>();
});

test("converters: to.Pair and from.Pair", () => {
	const naturalUnion: These<number, string> = constTruthyBool() ? These.make.first(42) : These.make.second("warn");

	const asMaybePair = These.to.Pair(naturalUnion);
	expectTypeOf(asMaybePair).toEqualTypeOf<Maybe<Pair<number, string>>>();

	const pair = Pair.make(42, "warn");
	const asBoth = These.from.Pair(pair);
	expectTypeOf(asBoth).toEqualTypeOf<These.Both<number, string>>();
});

test("swap: interchanges first and second channels", () => {
	const naturalUnion: These<number, string> = constTruthyBool() ? These.make.first(42) : These.make.second("warn");

	const swapped = These.swap(naturalUnion);
	expectTypeOf(swapped).toEqualTypeOf<These<string, number>>();
});
