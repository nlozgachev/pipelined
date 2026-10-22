import { expect, expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Lens } from "../Lens.ts";
import { Maybe } from "../Maybe.ts";
import { Optional } from "../Optional.ts";

type Profile = { username: string; bio?: string; };

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------

test("from.accessors: constructs an optional from getter and setter", () => {
	const firstChar = Optional.from.accessors(
		(s: string) => s.length > 0 ? Maybe.make.some(s.charAt(0)) : Maybe.make.none(),
		(c: string) => (s: string) => s.length > 0 ? c + s.slice(1) : s,
	);
	expectTypeOf(firstChar).toEqualTypeOf<Optional<string, string>>();
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
	expectTypeOf(bioOpt).toEqualTypeOf<Optional<Profile, string>>();
	const profile: Profile = { username: "alice", bio: "hello" };
	expect(bioOpt.get(profile)).toStrictEqual({ kind: "Some", value: "hello" });
});

test("from.property: returns None when field is absent", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	const profile: Profile = { username: "alice" };
	expect(bioOpt.get(profile)).toStrictEqual({ kind: "None" });
});

test("from.property: handles symbol keys", () => {
	const metaKey = Symbol("meta");
	type Document = { title: string; [metaKey]?: string; };
	const metaOpt = Optional.from.property<Document>()(metaKey);
	expectTypeOf(metaOpt).toEqualTypeOf<Optional<Document, string>>();
	expect(metaOpt.get({ title: "Doc", [metaKey]: "tagged" })).toStrictEqual({ kind: "Some", value: "tagged" });
	expect(metaOpt.get({ title: "Doc" })).toStrictEqual({ kind: "None" });
	expect(metaOpt.set("updated")({ title: "Doc" })).toStrictEqual({ title: "Doc", [metaKey]: "updated" });
});

test("from.property: handles nullable (null) fields", () => {
	type UserWithNull = { username: string; middleName: string | null; };
	const middleOpt = Optional.from.property<UserWithNull>()("middleName");
	expectTypeOf(middleOpt).toEqualTypeOf<Optional<UserWithNull, string>>();
	expect(middleOpt.get({ username: "alice", middleName: "Marie" })).toStrictEqual({ kind: "Some", value: "Marie" });
	expect(middleOpt.get({ username: "alice", middleName: null })).toStrictEqual({ kind: "None" });
});

test("from.property: handles required non-nullable fields", () => {
	const nameOpt = Optional.from.property<Profile>()("username");
	expectTypeOf(nameOpt).toEqualTypeOf<Optional<Profile, string>>();
	expect(nameOpt.get({ username: "alice" })).toStrictEqual({ kind: "Some", value: "alice" });
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

test("from.index: returns Some for in-bounds index", () => {
	const firstOpt = Optional.from.index<string>(0);
	expectTypeOf(firstOpt).toEqualTypeOf<Optional<readonly string[], string>>();
	expect(firstOpt.get(["a", "b", "c"])).toStrictEqual({ kind: "Some", value: "a" });
});

test("from.index: works with readonly arrays", () => {
	const readonlyArr: readonly string[] = ["a", "b"];
	const firstOpt = Optional.from.index<string>(0);
	expect(firstOpt.get(readonlyArr)).toStrictEqual({ kind: "Some", value: "a" });
	expect(firstOpt.set("z")(readonlyArr)).toStrictEqual(["z", "b"]);
});

test("from.index: returns None for empty array", () => {
	const firstOpt = Optional.from.index<string>(0);
	expect(firstOpt.get([])).toStrictEqual({ kind: "None" });
});

test("from.index: returns None for out-of-bounds index", () => {
	const thirdOpt = Optional.from.index<string>(2);
	expect(thirdOpt.get(["a"])).toStrictEqual({ kind: "None" });
});

test("from.index: returns None for negative index", () => {
	const negOpt = Optional.from.index<string>(-1);
	expect(negOpt.get(["a", "b"])).toStrictEqual({ kind: "None" });
});

test("from.index: replaces element at in-bounds index on set", () => {
	const firstOpt = Optional.from.index<string>(0);
	expect(firstOpt.set("z")(["a", "b", "c"])).toStrictEqual(["z", "b", "c"]);
});

test("from.index: does not mutate original array on set", () => {
	const firstOpt = Optional.from.index<string>(0);
	const arr = ["a", "b"];
	firstOpt.set("z")(arr);
	expect(arr).toStrictEqual(["a", "b"]);
});

test("from.index: preserves array reference when setting identical value", () => {
	const firstOpt = Optional.from.index<string>(0);
	const arr = ["a", "b"];
	expect(firstOpt.set("a")(arr)).toBe(arr);
});

test("from.index: no-op on set for out-of-bounds index", () => {
	const thirdOpt = Optional.from.index<string>(5);
	const arr = ["a", "b"];
	expect(thirdOpt.set("z")(arr)).toStrictEqual(arr);
});

test("from.index: no-op on set for negative index", () => {
	const negOpt = Optional.from.index<string>(-1);
	const arr = ["a", "b"];
	expect(negOpt.set("z")(arr)).toStrictEqual(arr);
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

test("get: returns Some for present focus", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	const res = pipe({ username: "alice", bio: "hi" }, Optional.get(bioOpt));
	expectTypeOf(res).toEqualTypeOf<Maybe<string>>();
	expect(res).toStrictEqual({ kind: "Some", value: "hi" });
});

test("get: returns None for absent focus", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	expect(pipe({ username: "alice" }, Optional.get(bioOpt))).toStrictEqual({ kind: "None" });
});

// ---------------------------------------------------------------------------
// set
// ---------------------------------------------------------------------------

test("set: replaces the focused value", () => {
	const firstOpt = Optional.from.index<number>(0);
	const setFirst = Optional.set(firstOpt)(99);
	expectTypeOf(setFirst).toEqualTypeOf<(structure: readonly number[]) => readonly number[]>();
	expect(pipe([1, 2, 3], setFirst)).toStrictEqual([99, 2, 3]);
});

// ---------------------------------------------------------------------------
// modify
// ---------------------------------------------------------------------------

test("modify: applies function when focus is present", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	const profile: Profile = { username: "alice", bio: "hello" };
	const modBio = Optional.modify(bioOpt)((s) => s.toUpperCase());
	expectTypeOf(modBio).toEqualTypeOf<(structure: Profile) => Profile>();
	expect(pipe(profile, modBio)).toStrictEqual({ username: "alice", bio: "HELLO" });
});

test("modify: no-op when focus is absent", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	const profile: Profile = { username: "alice" };
	expect(pipe(profile, Optional.modify(bioOpt)((s) => s.toUpperCase()))).toStrictEqual(profile);
});

test("modify: preserves reference when transform returns identical value", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	const profile: Profile = { username: "alice", bio: "hello" };
	expect(pipe(profile, Optional.modify(bioOpt)((s) => s))).toBe(profile);
});

// ---------------------------------------------------------------------------
// getOrElse
// ---------------------------------------------------------------------------

test("getOrElse: returns focused value when present", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	const getBio = Optional.getOrElse(bioOpt)(() => "none");
	expectTypeOf(getBio).toEqualTypeOf<(structure: Profile) => string>();
	expect(pipe({ username: "alice", bio: "hi" }, getBio)).toBe("hi");
});

test("getOrElse: returns default when focus is absent", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	expect(pipe({ username: "alice" }, Optional.getOrElse(bioOpt)(() => "none"))).toBe("none");
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

test("match: calls some handler when focus is present", () => {
	const bioOpt = Optional.from.property<Profile>()("bio");
	const matchBio = Optional.match(bioOpt)({ none: () => "none", some: (bio) => `bio:${bio}` });
	expectTypeOf(matchBio).toEqualTypeOf<(structure: Profile) => string>();
	expect(pipe({ username: "alice", bio: "hi" }, matchBio)).toBe("bio:hi");
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
	expectTypeOf(regionLandmarkOpt).toEqualTypeOf<Optional<Region, string>>();

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

test("andThen: updates inner property when outer focus is present and inner property is absent", () => {
	const capitalOpt = Optional.from.property<Region>()("capital");
	const landmarkOpt = Optional.from.property<City>()("landmark");
	const regionLandmarkOpt = pipe(capitalOpt, Optional.andThen(landmarkOpt));

	const region: Region = { capital: { name: "Paris" } };
	const updated = pipe(region, Optional.set(regionLandmarkOpt)("Eiffel"));
	expect(updated.capital?.landmark).toBe("Eiffel");
});

test("andThen: no-op on set when inner index focus is absent", () => {
	type ListWrapper = { items?: readonly string[]; };
	const itemsOpt = Optional.from.property<ListWrapper>()("items");
	const firstItemOpt = Optional.from.index<string>(0);
	const wrapperFirstOpt = pipe(itemsOpt, Optional.andThen(firstItemOpt));
	const wrapper: ListWrapper = { items: [] };
	expect(pipe(wrapper, Optional.set(wrapperFirstOpt)("hello"))).toStrictEqual({ items: [] });
});

// ---------------------------------------------------------------------------
// andThenLens
// ---------------------------------------------------------------------------

test("andThenLens: returns Some on get when optional focus is present", () => {
	const capitalOpt = Optional.from.property<Region>()("capital");
	const nameLens = Lens.from.property<City>()("name");
	const capitalNameOpt = pipe(capitalOpt, Optional.andThenLens(nameLens));
	expectTypeOf(capitalNameOpt).toEqualTypeOf<Optional<Region, string>>();

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
