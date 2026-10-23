import { expectTypeOf, test } from "vitest";
import { pipe } from "../../Composition/pipe.ts";
import { Lens } from "../Lens.ts";
import type { Maybe } from "../Maybe.ts";
import { Optional } from "../Optional.ts";

type Address = { readonly street: string; readonly city: string; readonly zipCode: number; };

const SYM_ID = Symbol("id");

type User = {
	readonly id: string;
	readonly name: string;
	readonly age: number;
	readonly address: Address;
	readonly [SYM_ID]: number;
};

test("from.accessors: constructs Lens from explicit getter and setter functions", () => {
	const nameLens = Lens.from.accessors((u: User) => u.name, (name) => (u) => ({ ...u, name }));

	expectTypeOf(nameLens).toEqualTypeOf<Lens<User, string>>();
	expectTypeOf(nameLens.get).toEqualTypeOf<(structure: User) => string>();
	expectTypeOf(nameLens.set).toEqualTypeOf<(value: string) => (structure: User) => User>();
});

test("from.property: creates typed Lens for object properties and symbol keys", () => {
	const nameLens = Lens.from.property<User>()("name");
	expectTypeOf(nameLens).toEqualTypeOf<Lens<User, string>>();

	const ageLens = Lens.from.property<User>()("age");
	expectTypeOf(ageLens).toEqualTypeOf<Lens<User, number>>();

	const addressLens = Lens.from.property<User>()("address");
	expectTypeOf(addressLens).toEqualTypeOf<Lens<User, Address>>();

	const symbolLens = Lens.from.property<User>()(SYM_ID);
	expectTypeOf(symbolLens).toEqualTypeOf<Lens<User, number>>();
});

test("get: extracts focused value from structure directly and via pipeline", () => {
	const user: User = {
		id: "u1",
		name: "Alice",
		age: 30,
		address: { street: "123 Main St", city: "Metropolis", zipCode: 10001 },
		[SYM_ID]: 42,
	};
	const nameLens = Lens.from.property<User>()("name");

	const nameDirect = Lens.get(nameLens)(user);
	expectTypeOf(nameDirect).toEqualTypeOf<string>();

	const namePiped = pipe(user, Lens.get(nameLens));
	expectTypeOf(namePiped).toEqualTypeOf<string>();
});

test("set: replaces focused value returning updated structure directly and via pipeline", () => {
	const user: User = {
		id: "u1",
		name: "Alice",
		age: 30,
		address: { street: "123 Main St", city: "Metropolis", zipCode: 10001 },
		[SYM_ID]: 42,
	};
	const nameLens = Lens.from.property<User>()("name");

	const updatedDirect = Lens.set(nameLens)("Bob")(user);
	expectTypeOf(updatedDirect).toEqualTypeOf<User>();

	const updatedPiped = pipe(user, Lens.set(nameLens)("Bob"));
	expectTypeOf(updatedPiped).toEqualTypeOf<User>();
});

test("modify: transforms focused value with function returning updated structure", () => {
	const user: User = {
		id: "u1",
		name: "Alice",
		age: 30,
		address: { street: "123 Main St", city: "Metropolis", zipCode: 10001 },
		[SYM_ID]: 42,
	};
	const ageLens = Lens.from.property<User>()("age");

	const modifiedDirect = Lens.modify(ageLens)((n) => n + 1)(user);
	expectTypeOf(modifiedDirect).toEqualTypeOf<User>();

	const modifiedPiped = pipe(user, Lens.modify(ageLens)((n) => n + 1));
	expectTypeOf(modifiedPiped).toEqualTypeOf<User>();
});

test("andThen: composes two Lenses focusing deeply into nested structures", () => {
	const addressLens = Lens.from.property<User>()("address");
	const cityLens = Lens.from.property<Address>()("city");

	const userCityLens = pipe(addressLens, Lens.andThen(cityLens));
	expectTypeOf(userCityLens).toEqualTypeOf<Lens<User, string>>();

	const user: User = {
		id: "u1",
		name: "Alice",
		age: 30,
		address: { street: "123 Main St", city: "Metropolis", zipCode: 10001 },
		[SYM_ID]: 42,
	};
	const city = pipe(user, Lens.get(userCityLens));
	expectTypeOf(city).toEqualTypeOf<string>();

	const updated = pipe(user, Lens.set(userCityLens)("Gotham"));
	expectTypeOf(updated).toEqualTypeOf<User>();
});

test("andThenOptional: composes Lens with Optional yielding Optional", () => {
	type Profile = { readonly username: string; readonly bio?: string; };
	type Account = { readonly id: string; readonly profile: Profile; };

	const profileLens = Lens.from.property<Account>()("profile");
	const bioOpt = Optional.from.property<Profile>()("bio");

	const accountBioOpt = pipe(profileLens, Lens.andThenOptional(bioOpt));
	expectTypeOf(accountBioOpt).toEqualTypeOf<Optional<Account, string>>();

	const account: Account = { id: "a1", profile: { username: "alice", bio: "engineer" } };
	const bio = pipe(account, Optional.get(accountBioOpt));
	expectTypeOf(bio).toEqualTypeOf<Maybe<string>>();
});

test("to.Optional: converts Lens to Optional preserving structure and value types", () => {
	const nameLens = Lens.from.property<User>()("name");
	const nameOpt = pipe(nameLens, Lens.to.Optional);

	expectTypeOf(nameOpt).toEqualTypeOf<Optional<User, string>>();

	const user: User = {
		id: "u1",
		name: "Alice",
		age: 30,
		address: { street: "123 Main St", city: "Metropolis", zipCode: 10001 },
		[SYM_ID]: 42,
	};
	const maybeName = pipe(user, Optional.get(nameOpt));
	expectTypeOf(maybeName).toEqualTypeOf<Maybe<string>>();
});

test("negative: disallows invalid property keys, mismatched types, and incompatible compositions", () => {
	const nameLens = Lens.from.property<User>()("name");

	// @ts-expect-error Non-existent property 'nonExistent' on User
	expectTypeOf(Lens.from.property<User>()("nonExistent")).toBeFunction();

	// @ts-expect-error Setter argument must match getter return type
	expectTypeOf(Lens.from.accessors((u: User) => u.name, (_val: number) => (u: User) => u)).toBeObject();

	// @ts-expect-error Setter rejects incompatible value type (number instead of string)
	expectTypeOf(Lens.set(nameLens)(123)).toBeFunction();

	// @ts-expect-error Modify transform must receive and return string
	expectTypeOf(Lens.modify(nameLens)((s: number) => s)).toBeFunction();

	type AddressLocal = { readonly street: string; };
	const streetLens = Lens.from.property<AddressLocal>()("street");

	// @ts-expect-error Cannot compose Lens<User, string> with Lens<AddressLocal, string>
	expectTypeOf(Lens.andThen(streetLens)(nameLens)).toBeObject();

	type ProfileLocal = { readonly bio?: string; };
	const bioOpt = Optional.from.property<ProfileLocal>()("bio");

	// @ts-expect-error Cannot compose Lens<User, string> with Optional<ProfileLocal, string>
	expectTypeOf(Lens.andThenOptional(bioOpt)(nameLens)).toBeObject();
});
