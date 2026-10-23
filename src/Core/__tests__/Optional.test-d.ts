import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Lens } from "../Lens.ts";
import { Maybe } from "../Maybe.ts";
import { Optional } from "../Optional.ts";

const SYM_EXTRA = Symbol("extra");

type UserProfile = {
	readonly id: string;
	readonly username: string;
	readonly bio?: string;
	readonly avatarUrl: string | null;
	readonly tags?: readonly string[];
	readonly [SYM_EXTRA]?: number;
};

test("from.accessors: constructs Optional from explicit getter and setter functions", () => {
	const bioOpt = Optional.from.accessors(
		(p: UserProfile) => Maybe.from.nullable(p.bio),
		(bio) => (p) => ({ ...p, bio }),
	);

	expectTypeOf(bioOpt).toEqualTypeOf<Optional<UserProfile, string>>();
	expectTypeOf(bioOpt.get).toEqualTypeOf<(structure: UserProfile) => Maybe<string>>();
	expectTypeOf(bioOpt.set).toEqualTypeOf<(value: string) => (structure: UserProfile) => UserProfile>();
});

test("from.property: strips null and undefined, supporting required, optional, nullable, and symbol keys", () => {
	const usernameOpt = Optional.from.property<UserProfile>()("username");
	expectTypeOf(usernameOpt).toEqualTypeOf<Optional<UserProfile, string>>();

	const bioOpt = Optional.from.property<UserProfile>()("bio");
	expectTypeOf(bioOpt).toEqualTypeOf<Optional<UserProfile, string>>();

	const avatarOpt = Optional.from.property<UserProfile>()("avatarUrl");
	expectTypeOf(avatarOpt).toEqualTypeOf<Optional<UserProfile, string>>();

	const extraOpt = Optional.from.property<UserProfile>()(SYM_EXTRA);
	expectTypeOf(extraOpt).toEqualTypeOf<Optional<UserProfile, number>>();
});

test("from.index: focuses on elements of readonly and mutable arrays by index", () => {
	const firstNumOpt = Optional.from.index<number>(0);
	expectTypeOf(firstNumOpt).toEqualTypeOf<Optional<readonly number[], number>>();

	const readonlyNums: readonly number[] = [10, 20, 30];
	const maybeFirst = pipe(readonlyNums, Optional.get(firstNumOpt));
	expectTypeOf(maybeFirst).toEqualTypeOf<Maybe<number>>();

	const updatedReadonly = pipe(readonlyNums, Optional.set(firstNumOpt)(99));
	expectTypeOf(updatedReadonly).toEqualTypeOf<readonly number[]>();

	const mutableNums: number[] = [1, 2, 3];
	const maybeMutable = pipe(mutableNums, Optional.get(firstNumOpt));
	expectTypeOf(maybeMutable).toEqualTypeOf<Maybe<number>>();
});

test("get: extracts focused value as Maybe directly and via pipeline", () => {
	const profile: UserProfile = { id: "p1", username: "alice", bio: "engineer", avatarUrl: null };
	const bioOpt = Optional.from.property<UserProfile>()("bio");

	const directGet = Optional.get(bioOpt)(profile);
	expectTypeOf(directGet).toEqualTypeOf<Maybe<string>>();

	const pipedGet = pipe(profile, Optional.get(bioOpt));
	expectTypeOf(pipedGet).toEqualTypeOf<Maybe<string>>();
});

test("set: updates focused value directly and via pipeline", () => {
	const profile: UserProfile = { id: "p1", username: "alice", bio: "engineer", avatarUrl: null };
	const bioOpt = Optional.from.property<UserProfile>()("bio");

	const directSet = Optional.set(bioOpt)("updated")(profile);
	expectTypeOf(directSet).toEqualTypeOf<UserProfile>();

	const pipedSet = pipe(profile, Optional.set(bioOpt)("updated"));
	expectTypeOf(pipedSet).toEqualTypeOf<UserProfile>();
});

test("modify: transforms focused value directly and via pipeline", () => {
	const profile: UserProfile = { id: "p1", username: "alice", bio: "engineer", avatarUrl: null };
	const bioOpt = Optional.from.property<UserProfile>()("bio");

	const directModify = Optional.modify(bioOpt)((s) => s.toUpperCase())(profile);
	expectTypeOf(directModify).toEqualTypeOf<UserProfile>();

	const pipedModify = pipe(profile, Optional.modify(bioOpt)((s) => s.toUpperCase()));
	expectTypeOf(pipedModify).toEqualTypeOf<UserProfile>();
});

test("getOrElse: extracts value with fallback default, widening return type", () => {
	const profile: UserProfile = { id: "p1", username: "alice", bio: "engineer", avatarUrl: null };
	const bioOpt = Optional.from.property<UserProfile>()("bio");

	const directGetOrElse = Optional.getOrElse(bioOpt)(() => "default")(profile);
	expectTypeOf(directGetOrElse).toEqualTypeOf<string>();

	const pipedGetOrElse = pipe(profile, Optional.getOrElse(bioOpt)(() => "default"));
	expectTypeOf(pipedGetOrElse).toEqualTypeOf<string>();

	const widenedNull = pipe(profile, Optional.getOrElse(bioOpt)((): null => null));
	expectTypeOf(widenedNull).toEqualTypeOf<string | null>();

	const widenedNumber = pipe(profile, Optional.getOrElse(bioOpt)(() => 123));
	expectTypeOf(widenedNumber).toEqualTypeOf<string | number>();
});

test("match: handles presence and absence with named handlers directly and via pipeline", () => {
	const profile: UserProfile = { id: "p1", username: "alice", bio: "engineer", avatarUrl: null };
	const bioOpt = Optional.from.property<UserProfile>()("bio");

	const directMatch = Optional.match(bioOpt)({ none: () => 0, some: (s) => s.length })(profile);
	expectTypeOf(directMatch).toEqualTypeOf<number>();

	const pipedMatch = pipe(profile, Optional.match(bioOpt)({ none: () => "none", some: (s) => `bio: ${s}` }));
	expectTypeOf(pipedMatch).toEqualTypeOf<string>();
});

test("andThen: composes two Optionals through nested structures", () => {
	const tagsOpt = Optional.from.property<UserProfile>()("tags");
	const firstTagOpt = Optional.from.index<string>(0);

	const userFirstTagOpt = pipe(tagsOpt, Optional.andThen(firstTagOpt));
	expectTypeOf(userFirstTagOpt).toEqualTypeOf<Optional<UserProfile, string>>();

	const profile: UserProfile = { id: "p1", username: "alice", avatarUrl: null, tags: ["typescript", "fp"] };

	const firstTag = pipe(profile, Optional.get(userFirstTagOpt));
	expectTypeOf(firstTag).toEqualTypeOf<Maybe<string>>();

	const updated = pipe(profile, Optional.set(userFirstTagOpt)("rust"));
	expectTypeOf(updated).toEqualTypeOf<UserProfile>();
});

test("andThenLens: composes Optional with Lens into nested structure", () => {
	type Address = { readonly street: string; readonly city: string; };
	type Company = { readonly name: string; readonly hq?: Address; };

	const hqOpt = Optional.from.property<Company>()("hq");
	const cityLens = Lens.from.property<Address>()("city");

	const companyCityOpt = pipe(hqOpt, Optional.andThenLens(cityLens));
	expectTypeOf(companyCityOpt).toEqualTypeOf<Optional<Company, string>>();

	const company: Company = { name: "Acme Corp", hq: { street: "100 Broadway", city: "New York" } };

	const city = pipe(company, Optional.get(companyCityOpt));
	expectTypeOf(city).toEqualTypeOf<Maybe<string>>();

	const updated = pipe(company, Optional.set(companyCityOpt)("San Francisco"));
	expectTypeOf(updated).toEqualTypeOf<Company>();
});

test("negative: disallows invalid properties, indices, missing match handlers, and incompatible compositions", () => {
	const bioOpt = Optional.from.property<UserProfile>()("bio");

	// @ts-expect-error Non-existent property 'missingProp' on UserProfile
	expectTypeOf(Optional.from.property<UserProfile>()("missingProp")).toBeFunction();

	// @ts-expect-error Index must be a number
	expectTypeOf(Optional.from.index<string>("first")).toBeObject();

	// @ts-expect-error Setter rejects incompatible value type (number instead of string)
	expectTypeOf(Optional.set(bioOpt)(123)).toBeFunction();

	// @ts-expect-error Modify transform must receive and return string
	expectTypeOf(Optional.modify(bioOpt)((n: number) => n)).toBeFunction();

	// @ts-expect-error Fallback must be a function thunk
	expectTypeOf(Optional.getOrElse(bioOpt)("not-a-thunk")).toBeFunction();

	// @ts-expect-error Missing 'none' handler in match cases
	expectTypeOf(Optional.match(bioOpt)({ some: (s: string) => s })).toBeFunction();

	// @ts-expect-error Missing 'some' handler in match cases
	expectTypeOf(Optional.match(bioOpt)({ none: () => "fallback" })).toBeFunction();

	type Setting = { readonly theme: string; };
	const themeOpt = Optional.from.property<Setting>()("theme");

	// @ts-expect-error Cannot compose Optional<UserProfile, string> with Optional<Setting, string>
	expectTypeOf(Optional.andThen(themeOpt)(bioOpt)).toBeObject();

	type AddressLocal = { readonly city: string; };
	const cityLens = Lens.from.property<AddressLocal>()("city");

	// @ts-expect-error Cannot compose Optional<UserProfile, string> with Lens<AddressLocal, string>
	expectTypeOf(Optional.andThenLens(cityLens)(bioOpt)).toBeObject();
});
