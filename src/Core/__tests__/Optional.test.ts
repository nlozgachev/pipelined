import { expect, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Lens } from "../Lens.ts";
import { Optional } from "../Optional.ts";

type Profile = { username: string; bio?: string; };

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------

test("from.accessors: constructs an optional from getter and setter", () => {
	const firstChar = Optional.from.accessors(
		(s: string) => s.length > 0 ? { kind: "Some" as const, value: s[0] } : { kind: "None" as const },
		(c) => (s) => s.length > 0 ? c + s.slice(1) : s,
	);
	expect(firstChar.get("hello")).toStrictEqual({ kind: "Some", value: "h" });
	expect(firstChar.get("")).toStrictEqual({ kind: "None" });
	expect(firstChar.set("H")("hello")).toBe("Hello");
	expect(firstChar.set("H")("")).toBe("");
});

// ---------------------------------------------------------------------------
// prop
// ---------------------------------------------------------------------------

test("from.property: returns Some when field is present", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	const profile: Profile = { username: "alice", bio: "hello" };
	expect(bioOpt.get(profile)).toStrictEqual({ kind: "Some", value: "hello" });
});

test("from.property: returns None when field is absent", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	const profile: Profile = { username: "alice" };
	expect(bioOpt.get(profile)).toStrictEqual({ kind: "None" });
});

test("set: inserts field when absent via from.property", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	const profile: Profile = { username: "alice" };
	const updated = bioOpt.set("hello")(profile);
	expect(updated).toStrictEqual({ username: "alice", bio: "hello" });
});

test("set: replaces field when present via from.property", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	const profile: Profile = { username: "alice", bio: "old" };
	expect(bioOpt.set("new")(profile)).toStrictEqual({ username: "alice", bio: "new" });
});

// ---------------------------------------------------------------------------
// index
// ---------------------------------------------------------------------------

test("index: returns Some for in-bounds index", () => {
	const firstOpt = Optional.index<string>(0);
	expect(firstOpt.get(["a", "b", "c"])).toStrictEqual({ kind: "Some", value: "a" });
});

test("index: returns None for empty array", () => {
	const firstOpt = Optional.index<string>(0);
	expect(firstOpt.get([])).toStrictEqual({ kind: "None" });
});

test("index: returns None for out-of-bounds index", () => {
	const thirdOpt = Optional.index<string>(2);
	expect(thirdOpt.get(["a"])).toStrictEqual({ kind: "None" });
});

test("index: returns None for negative index", () => {
	const negOpt = Optional.index<string>(-1);
	expect(negOpt.get(["a", "b"])).toStrictEqual({ kind: "None" });
});

test("index: replaces element at in-bounds index on set", () => {
	const firstOpt = Optional.index<string>(0);
	expect(firstOpt.set("z")(["a", "b", "c"])).toStrictEqual(["z", "b", "c"]);
});

test("index: does not mutate original array on set", () => {
	const firstOpt = Optional.index<string>(0);
	const arr = ["a", "b"];
	firstOpt.set("z")(arr);
	expect(arr).toStrictEqual(["a", "b"]);
});

test("index: no-op on set for out-of-bounds index", () => {
	const thirdOpt = Optional.index<string>(5);
	const arr = ["a", "b"];
	expect(thirdOpt.set("z")(arr)).toStrictEqual(arr);
});

test("index: no-op on set for negative index", () => {
	const negOpt = Optional.index<string>(-1);
	const arr = ["a", "b"];
	expect(negOpt.set("z")(arr)).toStrictEqual(arr);
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

test("get: returns Some for present focus", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	expect(pipe({ username: "alice", bio: "hi" }, Optional.get(bioOpt))).toStrictEqual({ kind: "Some", value: "hi" });
});

test("get: returns None for absent focus", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	expect(pipe({ username: "alice" }, Optional.get(bioOpt))).toStrictEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// set
// ---------------------------------------------------------------------------

test("set: replaces the focused value", () => {
	const firstOpt = Optional.index<number>(0);
	expect(pipe([1, 2, 3], Optional.set(firstOpt)(99))).toStrictEqual([99, 2, 3]);
});

// ---------------------------------------------------------------------------
// modify
// ---------------------------------------------------------------------------

test("modify: applies function when focus is present", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	const profile: Profile = { username: "alice", bio: "hello" };
	expect(pipe(profile, Optional.modify(bioOpt)((s) => s.toUpperCase()))).toStrictEqual({
		username: "alice",
		bio: "HELLO",
	});
});

test("modify: no-op when focus is absent", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	const profile: Profile = { username: "alice" };
	expect(pipe(profile, Optional.modify(bioOpt)((s) => s.toUpperCase()))).toStrictEqual(profile);
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("getOrElse: returns focused value when present", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	expect(pipe({ username: "alice", bio: "hi" }, Optional.getOrElse(bioOpt)(() => "none"))).toBe("hi");
});

test("getOrElse: returns default when focus is absent", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	expect(pipe({ username: "alice" }, Optional.getOrElse(bioOpt)(() => "none"))).toBe("none");
});

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------

test("fold: calls onSome when focus is present", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	expect(pipe({ username: "alice", bio: "hi" }, Optional.fold(bioOpt)(() => "none", (bio) => `bio:${bio}`))).toBe(
		"bio:hi",
	);
});

test("fold: calls onNone when focus is absent", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	expect(pipe({ username: "alice" }, Optional.fold(bioOpt)(() => "none", (bio) => `bio:${bio}`))).toBe("none");
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

test("match: calls some handler when focus is present", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	expect(
		pipe({ username: "alice", bio: "hi" }, Optional.match(bioOpt)({ none: () => "none", some: (bio) => `bio:${bio}` })),
	).toBe("bio:hi");
});

test("match: calls none handler when focus is absent", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	expect(pipe({ username: "alice" }, Optional.match(bioOpt)({ none: () => "none", some: (bio) => `bio:${bio}` }))).toBe(
		"none",
	);
});

// ---------------------------------------------------------------------------
// andThen
// ---------------------------------------------------------------------------

type City = { name: string; landmark?: string; };
type Region = { capital?: City; };

test("andThen: returns Some on get when both focuses are present", () => {
	const capitalOpt = Optional.from.property<Region>()("capital");
	const landmarkOpt = Optional.from.property<City>()("landmark");
	const regionLandmarkOpt = pipe(capitalOpt, Optional.andThen(landmarkOpt));

	const region: Region = { capital: { name: "Paris", landmark: "Eiffel Tower" } };
	expect(pipe(region, Optional.get(regionLandmarkOpt))).toStrictEqual({ kind: "Some", value: "Eiffel Tower" });
});

test("andThen: returns None on get when outer focus is absent", () => {
	const capitalOpt = Optional.from.property<Region>()("capital");
	const landmarkOpt = Optional.from.property<City>()("landmark");
	const regionLandmarkOpt = pipe(capitalOpt, Optional.andThen(landmarkOpt));

	expect(pipe({}, Optional.get(regionLandmarkOpt))).toStrictEqual({ kind: "None" });
});

test("andThen: returns None on get when inner focus is absent", () => {
	const capitalOpt = Optional.from.property<Region>()("capital");
	const landmarkOpt = Optional.from.property<City>()("landmark");
	const regionLandmarkOpt = pipe(capitalOpt, Optional.andThen(landmarkOpt));

	expect(pipe({ capital: { name: "Paris" } }, Optional.get(regionLandmarkOpt))).toStrictEqual({ kind: "None" });
});

test("andThen: updates inner value on set when both focuses present", () => {
	const capitalOpt = Optional.from.property<Region>()("capital");
	const landmarkOpt = Optional.from.property<City>()("landmark");
	const regionLandmarkOpt = pipe(capitalOpt, Optional.andThen(landmarkOpt));

	const region: Region = { capital: { name: "Paris", landmark: "old" } };
	const updated = pipe(region, Optional.set(regionLandmarkOpt)("new"));
	expect(updated.capital?.landmark).toBe("new");
});

test("andThen: no-op on set when outer focus is absent", () => {
	const capitalOpt = Optional.from.property<Region>()("capital");
	const landmarkOpt = Optional.from.property<City>()("landmark");
	const regionLandmarkOpt = pipe(capitalOpt, Optional.andThen(landmarkOpt));

	const region: Region = {};
	expect(pipe(region, Optional.set(regionLandmarkOpt)("new"))).toStrictEqual(region);
});

test("andThen: no-op on set when inner focus is absent", () => {
	const capitalOpt = Optional.from.property<Region>()("capital");
	const landmarkOpt = Optional.from.property<City>()("landmark");
	const regionLandmarkOpt = pipe(capitalOpt, Optional.andThen(landmarkOpt));

	const region: Region = { capital: { name: "Paris" } };
	const updated = pipe(region, Optional.set(regionLandmarkOpt)("Eiffel"));
	expect(updated.capital?.landmark).toBe("Eiffel");
});

// ---------------------------------------------------------------------------
// andThenLens
// ---------------------------------------------------------------------------

test("andThenLens: returns Some on get when optional focus is present", () => {
	const capitalOpt = Optional.from.property<Region>()("capital");
	const nameLens = Lens.from.property<City>()("name");
	const capitalNameOpt = pipe(capitalOpt, Optional.andThenLens(nameLens));

	const region: Region = { capital: { name: "Paris" } };
	expect(pipe(region, Optional.get(capitalNameOpt))).toStrictEqual({ kind: "Some", value: "Paris" });
});

test("andThenLens: returns None on get when optional focus is absent", () => {
	const capitalOpt = Optional.from.property<Region>()("capital");
	const nameLens = Lens.from.property<City>()("name");
	const capitalNameOpt = pipe(capitalOpt, Optional.andThenLens(nameLens));

	expect(pipe({}, Optional.get(capitalNameOpt))).toStrictEqual({ kind: "None" });
});

test("andThenLens: updates on set when optional focus is present", () => {
	const capitalOpt = Optional.from.property<Region>()("capital");
	const nameLens = Lens.from.property<City>()("name");
	const capitalNameOpt = pipe(capitalOpt, Optional.andThenLens(nameLens));

	const region: Region = { capital: { name: "Paris" } };
	const updated = pipe(region, Optional.set(capitalNameOpt)("Lyon"));
	expect(updated.capital?.name).toBe("Lyon");
});

test("andThenLens: no-op on set when optional focus is absent", () => {
	const capitalOpt = Optional.from.property<Region>()("capital");
	const nameLens = Lens.from.property<City>()("name");
	const capitalNameOpt = pipe(capitalOpt, Optional.andThenLens(nameLens));

	const region: Region = {};
	expect(pipe(region, Optional.set(capitalNameOpt)("Lyon"))).toStrictEqual(region);
});

// --- side-effect isolation ---

test("modify: executes side effect when focus is present", () => {
	let called = false;
	const bioOpt = Optional.from.property<Profile>()("bio");
	pipe(
		{ username: "alice", bio: "hello" },
		Optional.modify(bioOpt)((s) => {
			called = true;
			return s.toUpperCase();
		}),
	);
	expect(called).toBe(true);
});

test("modify: does not execute side effect when focus is absent", () => {
	let called = false;
	const bioOpt = Optional.from.property<Profile>()("bio");
	pipe(
		{ username: "alice" },
		Optional.modify(bioOpt)((s) => {
			called = true;
			return s.toUpperCase();
		}),
	);
	expect(called).toBe(false);
});
