declare const _brand: unique symbol;

/**
 * Brand<K, T> creates a nominal type by tagging T with a phantom brand K.
 * Prevents accidentally mixing up values that share the same underlying type.
 *
 * @example
 * ```ts
 * type UserId = Brand<"UserId", string>;
 * type ProductId = Brand<"ProductId", string>;
 *
 * const toUserId = Brand.wrap<"UserId", string>();
 * const toProductId = Brand.wrap<"ProductId", string>();
 *
 * const userId: UserId = toUserId("user-123");
 * const productId: ProductId = toProductId("prod-456");
 *
 * // Type error: ProductId is not assignable to UserId
 * // const wrong: UserId = productId;
 * ```
 */
export type Brand<K extends string, T> = T & { readonly [_brand]: K; };

export namespace Brand {
	/**
	 * Returns a constructor that wraps a value of type T in brand K.
	 * The resulting function performs an unchecked cast — only use when the raw
	 * value is known to satisfy the brand's invariants.
	 *
	 * @example
	 * ```ts
	 * type PositiveNumber = Brand<"PositiveNumber", number>;
	 * const toPositiveNumber = Brand.wrap<"PositiveNumber", number>();
	 *
	 * const n: PositiveNumber = toPositiveNumber(42);
	 * ```
	 */
	export const wrap = <K extends string, T>() => (value: T): Brand<K, T> => value as Brand<K, T>;

	/**
	 * Strips the brand and returns the underlying value.
	 * Since Brand<K, T> extends T this is rarely needed, but can improve readability.
	 *
	 * @example
	 * ```ts
	 * const userId: UserId = toUserId("user-123");
	 * const raw: string = Brand.unwrap(userId); // "user-123"
	 * ```
	 */
	export const unwrap = <K extends string, T>(branded: Brand<K, T>): T => branded as T;
}
