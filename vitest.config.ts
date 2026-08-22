import path from "node:path";
import { defineConfig } from "vitest/config";

const r = (p: string) => path.resolve(import.meta.dirname, p);

export default defineConfig({
	resolve: {
		alias: {
			"#core/": `${r("src/Core")}/`,
			"#data/": `${r("src/Data")}/`,
			"#types/": `${r("src/Types")}/`,
			"#composition/": `${r("src/Composition")}/`,
		},
	},
	test: {
		include: ["src/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["lcov", "text", "html"],
			include: ["src/**/*.ts"],
			exclude: [
				"src/**/index.ts",
				"src/index.ts",
				"src/**/__tests__/**",
				"src/**/__bench__/**",
				"src/internal/InternalTypes.ts",
			],
			thresholds: { statements: 99, branches: 99, functions: 99, lines: 99 },
		},
	},
});
