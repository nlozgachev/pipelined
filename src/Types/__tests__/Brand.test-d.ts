import { describe, expectTypeOf, it } from "vitest";
import { Brand } from "../Brand.ts";

describe("Brand type-level tests", () => {
	type UserId = Brand<"UserId", string>;
	type ProductId = Brand<"ProductId", string>;

	it("inspects brand construction, unwrapping, and nominal safety", () => {
		const toUserId = Brand.wrap<"UserId", string>();
		const toProductId = Brand.wrap<"ProductId", string>();

		const userId = toUserId("usr_123");
		expectTypeOf(userId).toEqualTypeOf<UserId>();

		const productId = toProductId("prod_456");
		expectTypeOf(productId).toEqualTypeOf<ProductId>();

		// Branded value can be passed where underlying type is expected
		const rawString: string = userId;
		expectTypeOf(rawString).toEqualTypeOf<string>();

		// Unwrap recovers underlying type
		expectTypeOf(Brand.unwrap(userId)).toEqualTypeOf<string>();
	});

	it("rejects mixing distinct nominal brands and assigning raw primitives to branded variables", () => {
		const toUserId = Brand.wrap<"UserId", string>();
		const toProductId = Brand.wrap<"ProductId", string>();

		const userId = toUserId("u1");
		const productId = toProductId("p1");

		// @ts-expect-error ProductId is not assignable to UserId
		const _wrongId: UserId = productId;

		// @ts-expect-error Raw string is not assignable to UserId without wrapping
		const _unbranded: UserId = "u1";

		expectTypeOf(userId).not.toEqualTypeOf(productId);
	});
});
