import fc from "fast-check";
import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Lens } from "../Lens.ts";
import { Maybe } from "../Maybe.ts";
import { Optional } from "../Optional.ts";

type Profile = { username: string; bio?: string; age: number | null; };

const arbProfileWithBio = fc.record({
	username: fc.string(),
	bio: fc.string(),
	age: fc.option(fc.integer(), { nil: null }),
}).map((p) => ({ ...p }));

const arbProfileWithoutBio = fc.record({ username: fc.string(), age: fc.option(fc.integer(), { nil: null }) }).map((
	p,
) => ({ ...p }));

const arbProfile = fc.oneof(arbProfileWithBio, arbProfileWithoutBio);

const bioOpt = Optional.from.property<Profile>()("bio");

// ---------------------------------------------------------------------------
// Well-behaved Optional Laws
// ---------------------------------------------------------------------------

test("law: Get-Set (setting what was just extracted leaves structure unchanged when present)", () => {
	fc.assert(fc.property(arbProfileWithBio, (profile) => {
		const extracted = Optional.get(bioOpt)(profile);
		const bio = Maybe.getOrElse(() => "")(extracted);
		expect(Optional.set(bioOpt)(bio)(profile)).toStrictEqual(profile);
	}));
});

test("law: Set-Get (extracting what was just set returns Some(newValue))", () => {
	fc.assert(fc.property(arbProfile, fc.string(), (profile, newBio) => {
		const updated = Optional.set(bioOpt)(newBio)(profile);
		expect(Optional.get(bioOpt)(updated)).toStrictEqual({ kind: "Some", value: newBio });
	}));
});

test("law: Set-Set (setting twice produces identical result to setting second value)", () => {
	fc.assert(fc.property(arbProfile, fc.string(), fc.string(), (profile, bio1, bio2) => {
		const setTwice = pipe(profile, Optional.set(bioOpt)(bio1), Optional.set(bioOpt)(bio2));
		const setOnce = pipe(profile, Optional.set(bioOpt)(bio2));
		expect(setTwice).toStrictEqual(setOnce);
	}));
});

// ---------------------------------------------------------------------------
// Modify Laws
// ---------------------------------------------------------------------------

test("modify: no-op when focus is absent", () => {
	fc.assert(fc.property(arbProfileWithoutBio, (profile) => {
		expect(Optional.modify(bioOpt)((s) => s.toUpperCase())(profile)).toStrictEqual(profile);
	}));
});

test("modify: transforms present value matching set(f(get))", () => {
	fc.assert(fc.property(arbProfileWithBio, fc.string(), (profile, prefix) => {
		const transform = (s: string) => prefix + s;
		const extracted = Optional.get(bioOpt)(profile);
		const bio = Maybe.getOrElse(() => "")(extracted);
		const modified = Optional.modify(bioOpt)(transform)(profile);
		expect(modified).toStrictEqual(Optional.set(bioOpt)(transform(bio))(profile));
	}));
});

// ---------------------------------------------------------------------------
// Elimination Consistency (getOrElse & match)
// ---------------------------------------------------------------------------

test("elimination: getOrElse agrees with match", () => {
	fc.assert(fc.property(arbProfile, fc.string(), (profile, fallback) => {
		const fromGetOrElse = Optional.getOrElse(bioOpt)(() => fallback)(profile);
		const fromMatch = Optional.match(bioOpt)({ none: () => fallback, some: (value) => value })(profile);
		expect(fromGetOrElse).toBe(fromMatch);
	}));
});

// ---------------------------------------------------------------------------
// from.index Laws
// ---------------------------------------------------------------------------

test("from.index: extracts and updates in-bounds index", () => {
	const arbArrayWithIndex = fc.array(fc.string(), { minLength: 1 }).chain((items) =>
		fc.record({ items: fc.constant(items), index: fc.integer({ min: 0, max: items.length - 1 }) })
	);

	fc.assert(fc.property(arbArrayWithIndex, fc.string(), ({ items, index }, value) => {
		const opt = Optional.from.index<string>(index);
		expect(Optional.get(opt)(items)).toStrictEqual({ kind: "Some", value: items[index] });
		const updated = Optional.set(opt)(value)(items);
		expect(updated[index]).toBe(value);
		expect(updated).toHaveLength(items.length);
	}));
});

test("from.index: returns None and identity set on out-of-bounds index", () => {
	const arbOutOfBounds = fc.array(fc.string()).chain((items) =>
		fc.record({
			items: fc.constant(items),
			index: fc.oneof(fc.integer({ max: -1 }), fc.integer({ min: items.length, max: items.length + 100 })),
		})
	);

	fc.assert(fc.property(arbOutOfBounds, fc.string(), ({ items, index }, value) => {
		const opt = Optional.from.index<string>(index);
		expect(Optional.get(opt)(items)).toStrictEqual({ kind: "None" });
		expect(Optional.set(opt)(value)(items)).toStrictEqual(items);
	}));
});

// ---------------------------------------------------------------------------
// Composition Laws (andThen & andThenLens)
// ---------------------------------------------------------------------------

type Config = { server?: { port: number; host?: string; }; };

const arbPresentConfig = fc.record({ port: fc.integer(), host: fc.option(fc.string(), { nil: undefined }) }).map((
	server,
): Config => ({ server }));

const serverOpt = Optional.from.property<Config>()("server");
const hostOpt = Optional.from.property<NonNullable<Config["server"]>>()("host");
const portLens = Lens.from.property<NonNullable<Config["server"]>>()("port");

test("andThen: short-circuits to None when outer is None", () => {
	fc.assert(fc.property(fc.string(), (newHost) => {
		const deepHostOpt = pipe(serverOpt, Optional.andThen(hostOpt));
		const emptyConfig: Config = {};
		expect(Optional.get(deepHostOpt)(emptyConfig)).toStrictEqual({ kind: "None" });
		expect(Optional.set(deepHostOpt)(newHost)(emptyConfig)).toStrictEqual(emptyConfig);
	}));
});

test("andThenLens: focuses through present Optional into guaranteed Lens property", () => {
	fc.assert(fc.property(arbPresentConfig, fc.integer(), (config, newPort) => {
		const serverPortOpt = pipe(serverOpt, Optional.andThenLens(portLens));
		expect(Optional.get(serverPortOpt)(config)).toStrictEqual({ kind: "Some", value: config.server!.port });
		const updated = Optional.set(serverPortOpt)(newPort)(config);
		expect(updated.server?.port).toBe(newPort);
	}));
});

test("andThenLens: short-circuits on absent Optional focus", () => {
	fc.assert(fc.property(fc.integer(), (newPort) => {
		const serverPortOpt = pipe(serverOpt, Optional.andThenLens(portLens));
		const emptyConfig: Config = {};
		expect(Optional.get(serverPortOpt)(emptyConfig)).toStrictEqual({ kind: "None" });
		expect(Optional.set(serverPortOpt)(newPort)(emptyConfig)).toStrictEqual(emptyConfig);
	}));
});
