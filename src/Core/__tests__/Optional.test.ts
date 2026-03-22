import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Optional } from "../Optional.ts";
import { Lens } from "../Lens.ts";
import { pipe } from "../../Composition/pipe.ts";

type Address = { city: string; zip: string; landmark?: string };
type Profile = { username: string; bio?: string };

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------

Deno.test("Optional.make constructs an optional from getter and setter", () => {
	const firstChar = Optional.make(
		(s: string) => s.length > 0 ? { kind: "Some" as const, value: s[0] } : { kind: "None" as const },
		(c) => (s) => s.length > 0 ? c + s.slice(1) : s,
	);
	assertEquals(firstChar.get("hello"), { kind: "Some", value: "h" });
	assertEquals(firstChar.get(""), { kind: "None" });
	assertEquals(firstChar.set("H")("hello"), "Hello");
	assertEquals(firstChar.set("H")(""), "");
});

// ---------------------------------------------------------------------------
// prop
// ---------------------------------------------------------------------------

Deno.test("Optional.prop get returns Some when field is present", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	const profile: Profile = { username: "alice", bio: "hello" };
	assertEquals(bioOpt.get(profile), { kind: "Some", value: "hello" });
});

Deno.test("Optional.prop get returns None when field is absent", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	const profile: Profile = { username: "alice" };
	assertEquals(bioOpt.get(profile), { kind: "None" });
});

Deno.test("Optional.prop set inserts the field when absent", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	const profile: Profile = { username: "alice" };
	const updated = bioOpt.set("hello")(profile);
	assertEquals(updated, { username: "alice", bio: "hello" });
});

Deno.test("Optional.prop set replaces the field when present", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	const profile: Profile = { username: "alice", bio: "old" };
	assertEquals(bioOpt.set("new")(profile), { username: "alice", bio: "new" });
});

// ---------------------------------------------------------------------------
// index
// ---------------------------------------------------------------------------

Deno.test("Optional.index get returns Some for in-bounds index", () => {
	const firstOpt = Optional.index<string>(0);
	assertEquals(firstOpt.get(["a", "b", "c"]), { kind: "Some", value: "a" });
});

Deno.test("Optional.index get returns None for empty array", () => {
	const firstOpt = Optional.index<string>(0);
	assertEquals(firstOpt.get([]), { kind: "None" });
});

Deno.test("Optional.index get returns None for out-of-bounds index", () => {
	const thirdOpt = Optional.index<string>(2);
	assertEquals(thirdOpt.get(["a"]), { kind: "None" });
});

Deno.test("Optional.index get returns None for negative index", () => {
	const negOpt = Optional.index<string>(-1);
	assertEquals(negOpt.get(["a", "b"]), { kind: "None" });
});

Deno.test("Optional.index set replaces element at in-bounds index", () => {
	const firstOpt = Optional.index<string>(0);
	assertEquals(firstOpt.set("z")(["a", "b", "c"]), ["z", "b", "c"]);
});

Deno.test("Optional.index set does not mutate the original array", () => {
	const firstOpt = Optional.index<string>(0);
	const arr = ["a", "b"];
	firstOpt.set("z")(arr);
	assertEquals(arr, ["a", "b"]);
});

Deno.test("Optional.index set is a no-op for out-of-bounds index", () => {
	const thirdOpt = Optional.index<string>(5);
	const arr = ["a", "b"];
	assertEquals(thirdOpt.set("z")(arr), arr);
});

Deno.test("Optional.index set is a no-op for negative index", () => {
	const negOpt = Optional.index<string>(-1);
	const arr = ["a", "b"];
	assertEquals(negOpt.set("z")(arr), arr);
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

Deno.test("Optional.get returns Some for present focus", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	assertEquals(
		pipe({ username: "alice", bio: "hi" }, Optional.get(bioOpt)),
		{ kind: "Some", value: "hi" },
	);
});

Deno.test("Optional.get returns None for absent focus", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	assertEquals(
		pipe({ username: "alice" }, Optional.get(bioOpt)),
		{ kind: "None" },
	);
});

// ---------------------------------------------------------------------------
// set
// ---------------------------------------------------------------------------

Deno.test("Optional.set replaces the focused value", () => {
	const firstOpt = Optional.index<number>(0);
	assertEquals(pipe([1, 2, 3], Optional.set(firstOpt)(99)), [99, 2, 3]);
});

// ---------------------------------------------------------------------------
// modify
// ---------------------------------------------------------------------------

Deno.test("Optional.modify applies function when focus is present", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	const profile: Profile = { username: "alice", bio: "hello" };
	assertEquals(
		pipe(profile, Optional.modify(bioOpt)((s) => s.toUpperCase())),
		{ username: "alice", bio: "HELLO" },
	);
});

Deno.test("Optional.modify is a no-op when focus is absent", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	const profile: Profile = { username: "alice" };
	assertEquals(pipe(profile, Optional.modify(bioOpt)((s) => s.toUpperCase())), profile);
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

Deno.test("Optional.getOrElse returns focused value when present", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	assertStrictEquals(
		pipe({ username: "alice", bio: "hi" }, Optional.getOrElse(bioOpt)(() => "none")),
		"hi",
	);
});

Deno.test("Optional.getOrElse returns default when focus is absent", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	assertStrictEquals(
		pipe({ username: "alice" }, Optional.getOrElse(bioOpt)(() => "none")),
		"none",
	);
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

Deno.test("Optional.fold calls onSome when focus is present", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	assertStrictEquals(
		pipe(
			{ username: "alice", bio: "hi" },
			Optional.fold(bioOpt)(() => "none", (bio) => `bio:${bio}`),
		),
		"bio:hi",
	);
});

Deno.test("Optional.fold calls onNone when focus is absent", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	assertStrictEquals(
		pipe(
			{ username: "alice" },
			Optional.fold(bioOpt)(() => "none", (bio) => `bio:${bio}`),
		),
		"none",
	);
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

Deno.test("Optional.match calls some handler when focus is present", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	assertStrictEquals(
		pipe(
			{ username: "alice", bio: "hi" },
			Optional.match(bioOpt)({ none: () => "none", some: (bio) => `bio:${bio}` }),
		),
		"bio:hi",
	);
});

Deno.test("Optional.match calls none handler when focus is absent", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	assertStrictEquals(
		pipe(
			{ username: "alice" },
			Optional.match(bioOpt)({ none: () => "none", some: (bio) => `bio:${bio}` }),
		),
		"none",
	);
});

// ---------------------------------------------------------------------------
// andThen
// ---------------------------------------------------------------------------

type City = { name: string; landmark?: string };
type Region = { capital?: City };

Deno.test("Optional.andThen get returns Some when both focuses are present", () => {
	const capitalOpt = Optional.prop<Region>()("capital");
	const landmarkOpt = Optional.prop<City>()("landmark");
	const regionLandmarkOpt = pipe(capitalOpt, Optional.andThen(landmarkOpt));

	const region: Region = { capital: { name: "Paris", landmark: "Eiffel Tower" } };
	assertEquals(
		pipe(region, Optional.get(regionLandmarkOpt)),
		{ kind: "Some", value: "Eiffel Tower" },
	);
});

Deno.test("Optional.andThen get returns None when outer focus is absent", () => {
	const capitalOpt = Optional.prop<Region>()("capital");
	const landmarkOpt = Optional.prop<City>()("landmark");
	const regionLandmarkOpt = pipe(capitalOpt, Optional.andThen(landmarkOpt));

	assertEquals(pipe({}, Optional.get(regionLandmarkOpt)), { kind: "None" });
});

Deno.test("Optional.andThen get returns None when inner focus is absent", () => {
	const capitalOpt = Optional.prop<Region>()("capital");
	const landmarkOpt = Optional.prop<City>()("landmark");
	const regionLandmarkOpt = pipe(capitalOpt, Optional.andThen(landmarkOpt));

	const region: Region = { capital: { name: "Paris" } };
	assertEquals(pipe(region, Optional.get(regionLandmarkOpt)), { kind: "None" });
});

Deno.test("Optional.andThen set updates inner value when both focuses present", () => {
	const capitalOpt = Optional.prop<Region>()("capital");
	const landmarkOpt = Optional.prop<City>()("landmark");
	const regionLandmarkOpt = pipe(capitalOpt, Optional.andThen(landmarkOpt));

	const region: Region = { capital: { name: "Paris", landmark: "old" } };
	const updated = pipe(region, Optional.set(regionLandmarkOpt)("new"));
	assertEquals(updated.capital?.landmark, "new");
});

Deno.test("Optional.andThen set is a no-op when outer focus is absent", () => {
	const capitalOpt = Optional.prop<Region>()("capital");
	const landmarkOpt = Optional.prop<City>()("landmark");
	const regionLandmarkOpt = pipe(capitalOpt, Optional.andThen(landmarkOpt));

	const region: Region = {};
	assertEquals(pipe(region, Optional.set(regionLandmarkOpt)("new")), region);
});

Deno.test("Optional.andThen set is a no-op when inner focus is absent", () => {
	const capitalOpt = Optional.prop<Region>()("capital");
	const landmarkOpt = Optional.prop<City>()("landmark");
	const regionLandmarkOpt = pipe(capitalOpt, Optional.andThen(landmarkOpt));

	const region: Region = { capital: { name: "Paris" } };
	const updated = pipe(region, Optional.set(regionLandmarkOpt)("Eiffel"));
	assertEquals(updated.capital?.landmark, "Eiffel");
});

// ---------------------------------------------------------------------------
// andThenLens
// ---------------------------------------------------------------------------

Deno.test("Optional.andThenLens get returns Some when optional focus is present", () => {
	const capitalOpt = Optional.prop<Region>()("capital");
	const nameLens = Lens.prop<City>()("name");
	const capitalNameOpt = pipe(capitalOpt, Optional.andThenLens(nameLens));

	const region: Region = { capital: { name: "Paris" } };
	assertEquals(pipe(region, Optional.get(capitalNameOpt)), { kind: "Some", value: "Paris" });
});

Deno.test("Optional.andThenLens get returns None when optional focus is absent", () => {
	const capitalOpt = Optional.prop<Region>()("capital");
	const nameLens = Lens.prop<City>()("name");
	const capitalNameOpt = pipe(capitalOpt, Optional.andThenLens(nameLens));

	assertEquals(pipe({}, Optional.get(capitalNameOpt)), { kind: "None" });
});

Deno.test("Optional.andThenLens set updates when optional focus is present", () => {
	const capitalOpt = Optional.prop<Region>()("capital");
	const nameLens = Lens.prop<City>()("name");
	const capitalNameOpt = pipe(capitalOpt, Optional.andThenLens(nameLens));

	const region: Region = { capital: { name: "Paris" } };
	const updated = pipe(region, Optional.set(capitalNameOpt)("Lyon"));
	assertEquals(updated.capital?.name, "Lyon");
});

Deno.test("Optional.andThenLens set is a no-op when optional focus is absent", () => {
	const capitalOpt = Optional.prop<Region>()("capital");
	const nameLens = Lens.prop<City>()("name");
	const capitalNameOpt = pipe(capitalOpt, Optional.andThenLens(nameLens));

	const region: Region = {};
	assertEquals(pipe(region, Optional.set(capitalNameOpt)("Lyon")), region);
});
