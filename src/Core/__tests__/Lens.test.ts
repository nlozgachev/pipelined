import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Lens } from "../Lens.ts";
import { Optional } from "../Optional.ts";

type Address = { city: string; zip: string; };
type User = { name: string; age: number; address: Address; };

const alice: User = { name: "Alice", age: 30, address: { city: "Berlin", zip: "10115" } };

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------

test("Lens.make constructs a lens from getter and setter", () => {
	const nameLens = Lens.make(
		(u: User) => u.name,
		(name) => (u) => ({ ...u, name }),
	);
	expect(nameLens.get(alice)).toBe("Alice");
	expect(nameLens.set("Bob")(alice)).toEqual({ ...alice, name: "Bob" });
});

// ---------------------------------------------------------------------------
// prop
// ---------------------------------------------------------------------------

test("Lens.prop focuses on a top-level property", () => {
	const nameLens = Lens.prop<User>()("name");
	expect(nameLens.get(alice)).toBe("Alice");
});

test("Lens.prop set returns a new object with the property replaced", () => {
	const nameLens = Lens.prop<User>()("name");
	const updated = nameLens.set("Bob")(alice);
	expect(updated).toEqual({ ...alice, name: "Bob" });
});

test("Lens.prop set does not mutate the original", () => {
	const nameLens = Lens.prop<User>()("name");
	nameLens.set("Bob")(alice);
	expect(alice.name).toBe("Alice");
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

test("Lens.get extracts the focused value", () => {
	const ageLens = Lens.prop<User>()("age");
	expect(pipe(alice, Lens.get(ageLens))).toBe(30);
});

// ---------------------------------------------------------------------------
// set
// ---------------------------------------------------------------------------

test("Lens.set replaces the focused value", () => {
	const ageLens = Lens.prop<User>()("age");
	expect(pipe(alice, Lens.set(ageLens)(31))).toEqual({ ...alice, age: 31 });
});

// ---------------------------------------------------------------------------
// modify
// ---------------------------------------------------------------------------

test("Lens.modify applies a function to the focused value", () => {
	const ageLens = Lens.prop<User>()("age");
	expect(pipe(alice, Lens.modify(ageLens)((n) => n + 1))).toEqual({ ...alice, age: 31 });
});

test("Lens.modify does not change the structure when function is identity", () => {
	const nameLens = Lens.prop<User>()("name");
	expect(pipe(alice, Lens.modify(nameLens)((n) => n))).toEqual(alice);
});

// ---------------------------------------------------------------------------
// andThen
// ---------------------------------------------------------------------------

test("Lens.andThen composes two lenses", () => {
	const addressLens = Lens.prop<User>()("address");
	const cityLens = Lens.prop<Address>()("city");
	const userCityLens = pipe(addressLens, Lens.andThen(cityLens));

	expect(pipe(alice, Lens.get(userCityLens))).toBe("Berlin");
});

test("Lens.andThen set updates the nested field", () => {
	const addressLens = Lens.prop<User>()("address");
	const cityLens = Lens.prop<Address>()("city");
	const userCityLens = pipe(addressLens, Lens.andThen(cityLens));

	const updated = pipe(alice, Lens.set(userCityLens)("Hamburg"));
	expect(updated.address.city).toBe("Hamburg");
	expect(updated.address.zip).toEqual(alice.address.zip);
	expect(updated.name).toEqual(alice.name);
});

test("Lens.andThen modify updates the nested field", () => {
	const addressLens = Lens.prop<User>()("address");
	const cityLens = Lens.prop<Address>()("city");
	const userCityLens = pipe(addressLens, Lens.andThen(cityLens));

	const updated = pipe(alice, Lens.modify(userCityLens)((c) => c.toUpperCase()));
	expect(updated.address.city).toBe("BERLIN");
});

// ---------------------------------------------------------------------------
// andThenOptional
// ---------------------------------------------------------------------------

type Profile = { username: string; bio?: string; };
type UserWithProfile = { name: string; profile: Profile; };

const userWithBio: UserWithProfile = { name: "Alice", profile: { username: "alice", bio: "hi" } };
const userNoBio: UserWithProfile = { name: "Alice", profile: { username: "alice" } };

test("Lens.andThenOptional get returns Some when inner focus present", () => {
	const profileLens = Lens.prop<UserWithProfile>()("profile");
	const bioOpt = Optional.prop<Profile>()("bio");
	const userBioOpt = pipe(profileLens, Lens.andThenOptional(bioOpt));

	expect(pipe(userWithBio, Optional.get(userBioOpt))).toEqual({ kind: "Some", value: "hi" });
});

test("Lens.andThenOptional get returns None when inner focus absent", () => {
	const profileLens = Lens.prop<UserWithProfile>()("profile");
	const bioOpt = Optional.prop<Profile>()("bio");
	const userBioOpt = pipe(profileLens, Lens.andThenOptional(bioOpt));

	expect(pipe(userNoBio, Optional.get(userBioOpt))).toEqual({ kind: "None" });
});

test("Lens.andThenOptional set updates inner value", () => {
	const profileLens = Lens.prop<UserWithProfile>()("profile");
	const bioOpt = Optional.prop<Profile>()("bio");
	const userBioOpt = pipe(profileLens, Lens.andThenOptional(bioOpt));

	const updated = pipe(userWithBio, Optional.set(userBioOpt)("updated"));
	expect(updated.profile.bio).toBe("updated");
});

// ---------------------------------------------------------------------------
// toOptional
// ---------------------------------------------------------------------------

test("Lens.toOptional get always returns Some", () => {
	const nameLens = Lens.prop<User>()("name");
	const nameOpt = Lens.toOptional(nameLens);

	expect(nameOpt.get(alice)).toEqual({ kind: "Some", value: "Alice" });
});

test("Lens.toOptional set behaves identically to the original lens", () => {
	const nameLens = Lens.prop<User>()("name");
	const nameOpt = Lens.toOptional(nameLens);

	expect(nameOpt.set("Bob")(alice)).toEqual(nameLens.set("Bob")(alice));
});

test("Lens.toOptional composes with Optional.andThen", () => {
	const addressLens = Lens.prop<User>()("address");
	const landmarkOpt = Optional.prop<Address & { landmark?: string; }>()("landmark");

	const userLandmarkOpt = pipe(
		Lens.toOptional(addressLens),
		Optional.andThen(landmarkOpt as Optional<Address, string>),
	);

	expect(userLandmarkOpt.get(alice)).toEqual({ kind: "None" });
});
