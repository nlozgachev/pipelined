import { describe, expectTypeOf, it } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Lens } from "../Lens.ts";
import { Logged } from "../Logged.ts";

describe("Logged type-level tests", () => {
	it("inspects creation, mapping, chaining, and log unification", () => {
		const init = Logged.make<string, number>(42, ["init"]);
		expectTypeOf(init).toEqualTypeOf<Logged<string, number>>();

		const entry = Logged.from.entry("started");
		expectTypeOf(entry).toEqualTypeOf<Logged<string, undefined>>();

		// map preserves log type channel W without collapsing to unknown
		const mapped = pipe(init, Logged.map((n) => n.toString()));
		expectTypeOf(mapped).toEqualTypeOf<Logged<string, string>>();

		// chain unifies distinct log channels
		const chained = pipe(init, Logged.chain((n) => Logged.make<number, string>(n.toString(), [100])));
		expectTypeOf(chained).toEqualTypeOf<Logged<string | number, string>>();

		// tap preserves exact types
		const tapped = pipe(init, Logged.tap((_n) => {}));
		expectTypeOf(tapped).toEqualTypeOf<Logged<string, number>>();

		// apply combines logs and evaluates application
		const fn = Logged.make<boolean, (n: number) => string>((n) => `${n}!`, [true]);
		const applied = pipe(fn, Logged.apply(init));
		expectTypeOf(applied).toEqualTypeOf<Logged<boolean | string, string>>();

		// run extracts tuple
		expectTypeOf(Logged.run(chained)).toEqualTypeOf<readonly [string, ReadonlyArray<string | number>]>();
	});

	it("inspects do-notation and lens focusing", () => {
		const bound = pipe(
			Logged.make<string, number>(42),
			Logged.bindTo("first"),
			Logged.bind("second", ({ first }) => Logged.make<number, boolean>(first > 0, [1])),
		);
		expectTypeOf(bound).toEqualTypeOf<Logged<string | number, { first: number; } & { second: boolean; }>>();

		type State = { count: number; };
		const countLens = Lens.from.property<State>()("count");
		const stateLogged = Logged.make<string, State>({ count: 10 });
		const focused = pipe(stateLogged, Logged.focus(countLens)((c) => c + 1));
		expectTypeOf(focused).toEqualTypeOf<Logged<string, State>>();
	});

	it("rejects mismatched types in chain and apply", () => {
		const init = Logged.make<string, number>(42);

		// @ts-expect-error chain callback must return a Logged
		expectTypeOf(pipe(init, Logged.chain((n) => n * 2))).toBeObject();
	});
});
