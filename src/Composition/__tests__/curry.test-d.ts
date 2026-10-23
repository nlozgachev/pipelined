import { describe, expectTypeOf, it } from "vitest";
import { curry } from "../curry.ts";
import { flip } from "../flip.ts";
import { uncurry } from "../uncurry.ts";

describe("curry, uncurry, and flip type-level tests", () => {
	it("inspects curry arities", () => {
		const f2 = (a: number, b: string): boolean => a === b.length;
		const f3 = (a: number, b: string, c: boolean): string => `${a}-${b}-${c}`;
		const f4 = (a: number, b: string, c: boolean, d: number[]): number => a + b.length + (c ? 1 : 0) + d.length;

		expectTypeOf(curry(f2)).toEqualTypeOf<(a: number) => (b: string) => boolean>();
		expectTypeOf(curry(f3)).toEqualTypeOf<(a: number) => (b: string) => (c: boolean) => string>();
		expectTypeOf(curry(f4)).toEqualTypeOf<(a: number) => (b: string) => (c: boolean) => (d: number[]) => number>();
	});

	it("inspects uncurry arities", () => {
		const c0 = () => () => "hello";
		const c1 = (a: number) => () => a * 2;
		const c2 = (a: number) => (b: string) => a === b.length;
		const c3 = (a: number) => (b: string) => (c: boolean) => `${a}-${b}-${c}`;
		const c4 = (a: number) => (_b: string) => (_c: boolean) => (d: number[]) => a + d.length;

		expectTypeOf(uncurry(c0)).toEqualTypeOf<() => string>();
		expectTypeOf(uncurry(c1)).toEqualTypeOf<(a: number) => number>();
		expectTypeOf(uncurry(c2)).toEqualTypeOf<(a: number, b: string) => boolean>();
		expectTypeOf(uncurry(c3)).toEqualTypeOf<(a: number, b: string, c: boolean) => string>();
		expectTypeOf(uncurry(c4)).toEqualTypeOf<(a: number, b: string, c: boolean, d: number[]) => number>();
	});

	it("inspects flip", () => {
		const f = (a: number) => (b: string): boolean => a === b.length;
		expectTypeOf(flip(f)).toEqualTypeOf<(b: string) => (a: number) => boolean>();
	});

	it("rejects invalid input types", () => {
		// @ts-expect-error non-function passed to curry
		expectTypeOf(curry(123)).toBeFunction();

		// @ts-expect-error non-curried function passed to flip
		expectTypeOf(flip((_a: number, _b: string) => true)).toBeFunction();
	});
});
