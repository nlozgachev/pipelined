import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Lens } from "../Lens.ts";
import { Optional } from "../Optional.ts";
import { pipe } from "../../Composition/pipe.ts";

type Address = { city: string; zip: string };
type User = { name: string; age: number; address: Address };

const alice: User = { name: "Alice", age: 30, address: { city: "Berlin", zip: "10115" } };

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------

Deno.test("Lens.make constructs a lens from getter and setter", () => {
	const nameLens = Lens.make(
		(u: User) => u.name,
		(name) => (u) => ({ ...u, name }),
	);
	assertEquals(nameLens.get(alice), "Alice");
	assertEquals(nameLens.set("Bob")(alice), { ...alice, name: "Bob" });
});

// ---------------------------------------------------------------------------
// prop
// ---------------------------------------------------------------------------

Deno.test("Lens.prop focuses on a top-level property", () => {
	const nameLens = Lens.prop<User>()("name");
	assertEquals(nameLens.get(alice), "Alice");
});

Deno.test("Lens.prop set returns a new object with the property replaced", () => {
	const nameLens = Lens.prop<User>()("name");
	const updated = nameLens.set("Bob")(alice);
	assertEquals(updated, { ...alice, name: "Bob" });
});

Deno.test("Lens.prop set does not mutate the original", () => {
	const nameLens = Lens.prop<User>()("name");
	nameLens.set("Bob")(alice);
	assertEquals(alice.name, "Alice");
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

Deno.test("Lens.get extracts the focused value", () => {
	const ageLens = Lens.prop<User>()("age");
	assertEquals(pipe(alice, Lens.get(ageLens)), 30);
});

// ---------------------------------------------------------------------------
// set
// ---------------------------------------------------------------------------

Deno.test("Lens.set replaces the focused value", () => {
	const ageLens = Lens.prop<User>()("age");
	assertEquals(pipe(alice, Lens.set(ageLens)(31)), { ...alice, age: 31 });
});

// ---------------------------------------------------------------------------
// modify
// ---------------------------------------------------------------------------

Deno.test("Lens.modify applies a function to the focused value", () => {
	const ageLens = Lens.prop<User>()("age");
	assertEquals(pipe(alice, Lens.modify(ageLens)((n) => n + 1)), { ...alice, age: 31 });
});

Deno.test("Lens.modify does not change the structure when function is identity", () => {
	const nameLens = Lens.prop<User>()("name");
	assertEquals(pipe(alice, Lens.modify(nameLens)((n) => n)), alice);
});

// ---------------------------------------------------------------------------
// andThen
// ---------------------------------------------------------------------------

Deno.test("Lens.andThen composes two lenses", () => {
	const addressLens = Lens.prop<User>()("address");
	const cityLens = Lens.prop<Address>()("city");
	const userCityLens = pipe(addressLens, Lens.andThen(cityLens));

	assertEquals(pipe(alice, Lens.get(userCityLens)), "Berlin");
});

Deno.test("Lens.andThen set updates the nested field", () => {
	const addressLens = Lens.prop<User>()("address");
	const cityLens = Lens.prop<Address>()("city");
	const userCityLens = pipe(addressLens, Lens.andThen(cityLens));

	const updated = pipe(alice, Lens.set(userCityLens)("Hamburg"));
	assertEquals(updated.address.city, "Hamburg");
	assertEquals(updated.address.zip, alice.address.zip);
	assertEquals(updated.name, alice.name);
});

Deno.test("Lens.andThen modify updates the nested field", () => {
	const addressLens = Lens.prop<User>()("address");
	const cityLens = Lens.prop<Address>()("city");
	const userCityLens = pipe(addressLens, Lens.andThen(cityLens));

	const updated = pipe(alice, Lens.modify(userCityLens)((c) => c.toUpperCase()));
	assertEquals(updated.address.city, "BERLIN");
});

// ---------------------------------------------------------------------------
// andThenOptional
// ---------------------------------------------------------------------------

type Profile = { username: string; bio?: string };
type UserWithProfile = { name: string; profile: Profile };

const userWithBio: UserWithProfile = { name: "Alice", profile: { username: "alice", bio: "hi" } };
const userNoBio: UserWithProfile = { name: "Alice", profile: { username: "alice" } };

Deno.test("Lens.andThenOptional get returns Some when inner focus present", () => {
	const profileLens = Lens.prop<UserWithProfile>()("profile");
	const bioOpt = Optional.prop<Profile>()("bio");
	const userBioOpt = pipe(profileLens, Lens.andThenOptional(bioOpt));

	assertEquals(pipe(userWithBio, Optional.get(userBioOpt)), { kind: "Some", value: "hi" });
});

Deno.test("Lens.andThenOptional get returns None when inner focus absent", () => {
	const profileLens = Lens.prop<UserWithProfile>()("profile");
	const bioOpt = Optional.prop<Profile>()("bio");
	const userBioOpt = pipe(profileLens, Lens.andThenOptional(bioOpt));

	assertEquals(pipe(userNoBio, Optional.get(userBioOpt)), { kind: "None" });
});

Deno.test("Lens.andThenOptional set updates inner value", () => {
	const profileLens = Lens.prop<UserWithProfile>()("profile");
	const bioOpt = Optional.prop<Profile>()("bio");
	const userBioOpt = pipe(profileLens, Lens.andThenOptional(bioOpt));

	const updated = pipe(userWithBio, Optional.set(userBioOpt)("updated"));
	assertEquals(updated.profile.bio, "updated");
});

// ---------------------------------------------------------------------------
// toOptional
// ---------------------------------------------------------------------------

Deno.test("Lens.toOptional get always returns Some", () => {
	const nameLens = Lens.prop<User>()("name");
	const nameOpt = Lens.toOptional(nameLens);

	assertEquals(nameOpt.get(alice), { kind: "Some", value: "Alice" });
});

Deno.test("Lens.toOptional set behaves identically to the original lens", () => {
	const nameLens = Lens.prop<User>()("name");
	const nameOpt = Lens.toOptional(nameLens);

	assertEquals(nameOpt.set("Bob")(alice), nameLens.set("Bob")(alice));
});

Deno.test("Lens.toOptional composes with Optional.andThen", () => {
	const addressLens = Lens.prop<User>()("address");
	const landmarkOpt = Optional.prop<Address & { landmark?: string }>()("landmark");

	const userLandmarkOpt = pipe(
		Lens.toOptional(addressLens),
		Optional.andThen(landmarkOpt as Optional<Address, string>),
	);

	assertEquals(userLandmarkOpt.get(alice), { kind: "None" });
});
