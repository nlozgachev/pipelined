import fc from "fast-check";
import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Lens } from "../Lens.ts";

type Address = { city: string; zip: string; };
type User = { name: string; age: number; address: Address; };

const arbAddress = fc.record({ city: fc.string(), zip: fc.string() }).map((a) => ({ ...a }));

const arbUser = fc.record({ name: fc.string(), age: fc.integer(), address: arbAddress }).map((u) => ({ ...u }));

const nameLens = Lens.from.property<User>()("name");
const ageLens = Lens.from.property<User>()("age");
const addressLens = Lens.from.property<User>()("address");
const cityLens = Lens.from.property<Address>()("city");
const userCityLens = pipe(addressLens, Lens.andThen(cityLens));

// ---------------------------------------------------------------------------
// Well-behaved Lens Laws
// ---------------------------------------------------------------------------

test("law: Get-Put (setting what was just extracted leaves structure unchanged)", () => {
	fc.assert(fc.property(arbUser, (user) => {
		const extracted = Lens.get(nameLens)(user);
		expect(Lens.set(nameLens)(extracted)(user)).toStrictEqual(user);
	}));
});

test("law: Put-Get (extracting what was just set returns the new value)", () => {
	fc.assert(fc.property(arbUser, fc.string(), (user, newName) => {
		const updated = Lens.set(nameLens)(newName)(user);
		expect(Lens.get(nameLens)(updated)).toBe(newName);
	}));
});

test("law: Put-Put (setting twice is identical to setting the second value)", () => {
	fc.assert(fc.property(arbUser, fc.integer(), fc.integer(), (user, age1, age2) => {
		const setTwice = pipe(user, Lens.set(ageLens)(age1), Lens.set(ageLens)(age2));
		const setOnce = pipe(user, Lens.set(ageLens)(age2));
		expect(setTwice).toStrictEqual(setOnce);
	}));
});

// ---------------------------------------------------------------------------
// Modify Laws
// ---------------------------------------------------------------------------

test("modify: identity transform preserves structure", () => {
	fc.assert(fc.property(arbUser, (user) => {
		expect(Lens.modify(nameLens)((n) => n)(user)).toStrictEqual(user);
	}));
});

test("modify: composition law holds", () => {
	fc.assert(fc.property(arbUser, fc.integer(), fc.integer(), (user, a, b) => {
		const f = (n: number) => n + a;
		const g = (n: number) => n * b;
		const stepByStep = pipe(user, Lens.modify(ageLens)(g), Lens.modify(ageLens)(f));
		const fused = pipe(user, Lens.modify(ageLens)((n) => f(g(n))));
		expect(stepByStep).toStrictEqual(fused);
	}));
});

// ---------------------------------------------------------------------------
// Composition Laws (andThen)
// ---------------------------------------------------------------------------

test("andThen: composed get equals sequential get", () => {
	fc.assert(fc.property(arbUser, (user) => {
		expect(Lens.get(userCityLens)(user)).toBe(Lens.get(cityLens)(Lens.get(addressLens)(user)));
	}));
});

test("andThen: composed set equals sequential nested set", () => {
	fc.assert(fc.property(arbUser, fc.string(), (user, newCity) => {
		const composedSet = Lens.set(userCityLens)(newCity)(user);
		const manualSet = Lens.set(addressLens)(Lens.set(cityLens)(newCity)(Lens.get(addressLens)(user)))(user);
		expect(composedSet).toStrictEqual(manualSet);
	}));
});

// ---------------------------------------------------------------------------
// to.Optional Equivalence
// ---------------------------------------------------------------------------

test("to.Optional: get matches Some(Lens.get) and set matches Lens.set", () => {
	fc.assert(fc.property(arbUser, fc.string(), (user, newName) => {
		const opt = Lens.to.Optional(nameLens);
		expect(opt.get(user)).toStrictEqual({ kind: "Some", value: Lens.get(nameLens)(user) });
		expect(opt.set(newName)(user)).toStrictEqual(Lens.set(nameLens)(newName)(user));
	}));
});
