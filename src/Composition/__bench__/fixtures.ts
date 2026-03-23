export const n = 42;
export const add1 = (x: number) => x + 1;
export const double = (x: number) => x * 2;
export const negate = (x: number) => -x;
export const square = (x: number) => x * x;
export const halve = (x: number) => x / 2;

export const direct3 = (): void => { negate(double(add1(n))); };
export const direct5 = (): void => { halve(square(negate(double(add1(n))))); };
export const direct10 = (): void => { halve(square(negate(double(add1(halve(square(negate(double(add1(n)))))))))); };

export const gc = (globalThis as any).gc as (() => void) | undefined;

export function bytesPerCall(fn: () => void, iters = 500_000): number {
	for (let i = 0; i < 50_000; i++) fn(); // warm up JIT
	gc?.();
	const before = process.memoryUsage().heapUsed;
	for (let i = 0; i < iters; i++) fn();
	gc?.();
	const after = process.memoryUsage().heapUsed;
	return Math.max(0, (after - before) / iters);
}
