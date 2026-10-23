/**
 * Test utility that returns `true` typed as `boolean`.
 * Used in tests to construct natural un-narrowed unions deterministically without CFA narrowing.
 */
export const constTruthyBool = (): boolean => true;

/**
 * Test utility that returns `false` typed as `boolean`.
 * Used in tests to construct natural un-narrowed unions deterministically without CFA narrowing.
 */
export const constFalseBool = (): boolean => false;
