import { pipe } from "#composition";
import { Lazy } from "#core";
import { expect, test } from "vitest";

// ---------------------------------------------------------------------------
// from + evaluate
// ---------------------------------------------------------------------------

test("Lazy.evaluate returns the computed value", () => {
	const lazy = Lazy.from(() => 42);
	expect(Lazy.evaluate(lazy)).toBe(42);
});

test("Lazy.from memoizes: factory runs exactly once across multiple evaluations", () => {
	let count = 0;
	const lazy = Lazy.from(() => {
		count++;
		return "result";
	});
	Lazy.evaluate(lazy);
	Lazy.evaluate(lazy);
	Lazy.evaluate(lazy);
	expect(count).toBe(1);
});

test("Lazy.evaluate returns the same reference on repeated calls", () => {
	const obj = { x: 1 };
	const lazy = Lazy.from(() => obj);
	expect(Lazy.evaluate(lazy)).toBe(Lazy.evaluate(lazy));
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

test("Lazy.map transforms the value", () => {
	const lazy = pipe(Lazy.from(() => 10), Lazy.map((n) => n * 2));
	expect(Lazy.evaluate(lazy)).toBe(20);
});

test("Lazy.map does not evaluate until evaluate is called", () => {
	let ran = false;
	const lazy = pipe(
		Lazy.from(() => {
			ran = true;
			return 1;
		}),
		Lazy.map((n) => n + 1),
	);
	expect(ran).toBe(false);
	Lazy.evaluate(lazy);
	expect(ran).toBe(true);
});

test("Lazy.map factory runs once even with multiple evaluations", () => {
	let sourceCount = 0;
	let mapCount = 0;
	const lazy = pipe(
		Lazy.from(() => {
			sourceCount++;
			return 5;
		}),
		Lazy.map((n) => {
			mapCount++;
			return n * 2;
		}),
	);
	Lazy.evaluate(lazy);
	Lazy.evaluate(lazy);
	expect(sourceCount).toBe(1);
	expect(mapCount).toBe(1);
});

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

test("Lazy.chain composes two lazy computations", () => {
	const lazy = pipe(Lazy.from(() => "hello"), Lazy.chain((s) => Lazy.from(() => s.length)));
	expect(Lazy.evaluate(lazy)).toBe(5);
});

test("Lazy.chain stays lazy until evaluate is called", () => {
	let ran = false;
	const lazy = pipe(
		Lazy.from(() => 1),
		Lazy.chain((n) =>
			Lazy.from(() => {
				ran = true;
				return n + 1;
			})
		),
	);
	expect(ran).toBe(false);
	Lazy.evaluate(lazy);
	expect(ran).toBe(true);
});

test("Lazy.chain inner factory runs once across multiple evaluations", () => {
	let count = 0;
	const lazy = pipe(
		Lazy.from(() => 1),
		Lazy.chain((n) =>
			Lazy.from(() => {
				count++;
				return n + 1;
			})
		),
	);
	Lazy.evaluate(lazy);
	Lazy.evaluate(lazy);
	expect(count).toBe(1);
});

// ---------------------------------------------------------------------------
// tap
// ---------------------------------------------------------------------------

test("Lazy.tap runs the side effect when evaluated", () => {
	let seen: number | undefined;
	const lazy = pipe(
		Lazy.from(() => 99),
		Lazy.tap((n) => {
			seen = n;
		}),
	);
	expect(seen).toBeUndefined();
	Lazy.evaluate(lazy);
	expect(seen).toBe(99);
});

test("Lazy.tap returns the original value unchanged", () => {
	const lazy = pipe(Lazy.from(() => "abc"), Lazy.tap(() => {}));
	expect(Lazy.evaluate(lazy)).toBe("abc");
});

test("Lazy.tap side effect fires exactly once across multiple evaluations", () => {
	let count = 0;
	const lazy = pipe(
		Lazy.from(() => 1),
		Lazy.tap(() => {
			count++;
		}),
	);
	Lazy.evaluate(lazy);
	Lazy.evaluate(lazy);
	expect(count).toBe(1);
});

// ---------------------------------------------------------------------------
// pipe composition
// ---------------------------------------------------------------------------

test("lazy composes map, chain, and tap in a pipe", () => {
	const log: string[] = [];
	const lazy = pipe(
		Lazy.from(() => 5),
		Lazy.map((n) => n * 2),
		Lazy.tap((n) => log.push(`tapped: ${n}`)),
		Lazy.chain((n) => Lazy.from(() => `result: ${n}`)),
	);
	expect(log).toStrictEqual([]);
	expect(Lazy.evaluate(lazy)).toBe("result: 10");
	expect(log).toStrictEqual(["tapped: 10"]);
});
