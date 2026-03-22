import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Lens } from "../Lens.ts";
import { Optional } from "../Optional.ts";

type Profile = { username: string; bio?: string; };

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------

test("Optional.make constructs an optional from getter and setter", () => {
	const firstChar = Optional.make(
		(s: string) => s.length > 0 ? { kind: "Some" as const, value: s[0] } : { kind: "None" as const },
		(c) => (s) => s.length > 0 ? c + s.slice(1) : s,
	);
	expect(firstChar.get("hello")).toEqual({ kind: "Some", value: "h" });
	expect(firstChar.get("")).toEqual({ kind: "None" });
	expect(firstChar.set("H")("hello")).toBe("Hello");
	expect(firstChar.set("H")("")).toBe("");
});

// ---------------------------------------------------------------------------
// prop
// ---------------------------------------------------------------------------

test("Optional.prop get returns Some when field is present", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	const profile: Profile = { username: "alice", bio: "hello" };
	expect(bioOpt.get(profile)).toEqual({ kind: "Some", value: "hello" });
});

test("Optional.prop get returns None when field is absent", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	const profile: Profile = { username: "alice" };
	expect(bioOpt.get(profile)).toEqual({ kind: "None" });
});

test("Optional.prop set inserts the field when absent", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	const profile: Profile = { username: "alice" };
	const updated = bioOpt.set("hello")(profile);
	expect(updated).toEqual({ username: "alice", bio: "hello" });
});

test("Optional.prop set replaces the field when present", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	const profile: Profile = { username: "alice", bio: "old" };
	expect(bioOpt.set("new")(profile)).toEqual({ username: "alice", bio: "new" });
});

// ---------------------------------------------------------------------------
// index
// ---------------------------------------------------------------------------

test("Optional.index get returns Some for in-bounds index", () => {
	const firstOpt = Optional.index<string>(0);
	expect(firstOpt.get(["a", "b", "c"])).toEqual({ kind: "Some", value: "a" });
});

test("Optional.index get returns None for empty array", () => {
	const firstOpt = Optional.index<string>(0);
	expect(firstOpt.get([])).toEqual({ kind: "None" });
});

test("Optional.index get returns None for out-of-bounds index", () => {
	const thirdOpt = Optional.index<string>(2);
	expect(thirdOpt.get(["a"])).toEqual({ kind: "None" });
});

test("Optional.index get returns None for negative index", () => {
	const negOpt = Optional.index<string>(-1);
	expect(negOpt.get(["a", "b"])).toEqual({ kind: "None" });
});

test("Optional.index set replaces element at in-bounds index", () => {
	const firstOpt = Optional.index<string>(0);
	expect(firstOpt.set("z")(["a", "b", "c"])).toEqual(["z", "b", "c"]);
});

test("Optional.index set does not mutate the original array", () => {
	const firstOpt = Optional.index<string>(0);
	const arr = ["a", "b"];
	firstOpt.set("z")(arr);
	expect(arr).toEqual(["a", "b"]);
});

test("Optional.index set is a no-op for out-of-bounds index", () => {
	const thirdOpt = Optional.index<string>(5);
	const arr = ["a", "b"];
	expect(thirdOpt.set("z")(arr)).toEqual(arr);
});

test("Optional.index set is a no-op for negative index", () => {
	const negOpt = Optional.index<string>(-1);
	const arr = ["a", "b"];
	expect(negOpt.set("z")(arr)).toEqual(arr);
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

test("Optional.get returns Some for present focus", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	expect(pipe({ username: "alice", bio: "hi" }, Optional.get(bioOpt))).toEqual({ kind: "Some", value: "hi" });
});

test("Optional.get returns None for absent focus", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	expect(pipe({ username: "alice" }, Optional.get(bioOpt))).toEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// set
// ---------------------------------------------------------------------------

test("Optional.set replaces the focused value", () => {
	const firstOpt = Optional.index<number>(0);
	expect(pipe([1, 2, 3], Optional.set(firstOpt)(99))).toEqual([99, 2, 3]);
});

// ---------------------------------------------------------------------------
// modify
// ---------------------------------------------------------------------------

test("Optional.modify applies function when focus is present", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	const profile: Profile = { username: "alice", bio: "hello" };
	expect(pipe(profile, Optional.modify(bioOpt)((s) => s.toUpperCase()))).toEqual({ username: "alice", bio: "HELLO" });
});

test("Optional.modify is a no-op when focus is absent", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	const profile: Profile = { username: "alice" };
	expect(pipe(profile, Optional.modify(bioOpt)((s) => s.toUpperCase()))).toEqual(profile);
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("Optional.getOrElse returns focused value when present", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	expect(pipe({ username: "alice", bio: "hi" }, Optional.getOrElse(bioOpt)(() => "none"))).toBe("hi");
});

test("Optional.getOrElse returns default when focus is absent", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	expect(pipe({ username: "alice" }, Optional.getOrElse(bioOpt)(() => "none"))).toBe("none");
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("Optional.fold calls onSome when focus is present", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	expect(pipe(
		{ username: "alice", bio: "hi" },
		Optional.fold(bioOpt)(() => "none", (bio) => `bio:${bio}`),
	)).toBe("bio:hi");
});

test("Optional.fold calls onNone when focus is absent", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	expect(pipe(
		{ username: "alice" },
		Optional.fold(bioOpt)(() => "none", (bio) => `bio:${bio}`),
	)).toBe("none");
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

test("Optional.match calls some handler when focus is present", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	expect(pipe(
		{ username: "alice", bio: "hi" },
		Optional.match(bioOpt)({ none: () => "none", some: (bio) => `bio:${bio}` }),
	)).toBe("bio:hi");
});

test("Optional.match calls none handler when focus is absent", () => {
	const bioOpt = Optional.prop<Profile>()("bio");
	expect(pipe(
		{ username: "alice" },
		Optional.match(bioOpt)({ none: () => "none", some: (bio) => `bio:${bio}` }),
	)).toBe("none");
});

// ---------------------------------------------------------------------------
// andThen
// ---------------------------------------------------------------------------

type City = { name: string; landmark?: string; };
type Region = { capital?: City; };

test("Optional.andThen get returns Some when both focuses are present", () => {
	const capitalOpt = Optional.prop<Region>()("capital");
	const landmarkOpt = Optional.prop<City>()("landmark");
	const regionLandmarkOpt = pipe(capitalOpt, Optional.andThen(landmarkOpt));

	const region: Region = { capital: { name: "Paris", landmark: "Eiffel Tower" } };
	expect(pipe(region, Optional.get(regionLandmarkOpt))).toEqual({ kind: "Some", value: "Eiffel Tower" });
});

test("Optional.andThen get returns None when outer focus is absent", () => {
	const capitalOpt = Optional.prop<Region>()("capital");
	const landmarkOpt = Optional.prop<City>()("landmark");
	const regionLandmarkOpt = pipe(capitalOpt, Optional.andThen(landmarkOpt));

	expect(pipe({}, Optional.get(regionLandmarkOpt))).toEqual({ kind: "None" });
});

test("Optional.andThen get returns None when inner focus is absent", () => {
	const capitalOpt = Optional.prop<Region>()("capital");
	const landmarkOpt = Optional.prop<City>()("landmark");
	const regionLandmarkOpt = pipe(capitalOpt, Optional.andThen(landmarkOpt));

	const region: Region = { capital: { name: "Paris" } };
	expect(pipe(region, Optional.get(regionLandmarkOpt))).toEqual({ kind: "None" });
});

test("Optional.andThen set updates inner value when both focuses present", () => {
	const capitalOpt = Optional.prop<Region>()("capital");
	const landmarkOpt = Optional.prop<City>()("landmark");
	const regionLandmarkOpt = pipe(capitalOpt, Optional.andThen(landmarkOpt));

	const region: Region = { capital: { name: "Paris", landmark: "old" } };
	const updated = pipe(region, Optional.set(regionLandmarkOpt)("new"));
	expect(updated.capital?.landmark).toBe("new");
});

test("Optional.andThen set is a no-op when outer focus is absent", () => {
	const capitalOpt = Optional.prop<Region>()("capital");
	const landmarkOpt = Optional.prop<City>()("landmark");
	const regionLandmarkOpt = pipe(capitalOpt, Optional.andThen(landmarkOpt));

	const region: Region = {};
	expect(pipe(region, Optional.set(regionLandmarkOpt)("new"))).toEqual(region);
});

test("Optional.andThen set is a no-op when inner focus is absent", () => {
	const capitalOpt = Optional.prop<Region>()("capital");
	const landmarkOpt = Optional.prop<City>()("landmark");
	const regionLandmarkOpt = pipe(capitalOpt, Optional.andThen(landmarkOpt));

	const region: Region = { capital: { name: "Paris" } };
	const updated = pipe(region, Optional.set(regionLandmarkOpt)("Eiffel"));
	expect(updated.capital?.landmark).toBe("Eiffel");
});

// ---------------------------------------------------------------------------
// andThenLens
// ---------------------------------------------------------------------------

test("Optional.andThenLens get returns Some when optional focus is present", () => {
	const capitalOpt = Optional.prop<Region>()("capital");
	const nameLens = Lens.prop<City>()("name");
	const capitalNameOpt = pipe(capitalOpt, Optional.andThenLens(nameLens));

	const region: Region = { capital: { name: "Paris" } };
	expect(pipe(region, Optional.get(capitalNameOpt))).toEqual({ kind: "Some", value: "Paris" });
});

test("Optional.andThenLens get returns None when optional focus is absent", () => {
	const capitalOpt = Optional.prop<Region>()("capital");
	const nameLens = Lens.prop<City>()("name");
	const capitalNameOpt = pipe(capitalOpt, Optional.andThenLens(nameLens));

	expect(pipe({}, Optional.get(capitalNameOpt))).toEqual({ kind: "None" });
});

test("Optional.andThenLens set updates when optional focus is present", () => {
	const capitalOpt = Optional.prop<Region>()("capital");
	const nameLens = Lens.prop<City>()("name");
	const capitalNameOpt = pipe(capitalOpt, Optional.andThenLens(nameLens));

	const region: Region = { capital: { name: "Paris" } };
	const updated = pipe(region, Optional.set(capitalNameOpt)("Lyon"));
	expect(updated.capital?.name).toBe("Lyon");
});

test("Optional.andThenLens set is a no-op when optional focus is absent", () => {
	const capitalOpt = Optional.prop<Region>()("capital");
	const nameLens = Lens.prop<City>()("name");
	const capitalNameOpt = pipe(capitalOpt, Optional.andThenLens(nameLens));

	const region: Region = {};
	expect(pipe(region, Optional.set(capitalNameOpt)("Lyon"))).toEqual(region);
});
