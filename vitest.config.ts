import path from "node:path";
import { defineConfig } from "vitest/config";

const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
	resolve: {
		alias: {
			"#core/": r("src/Core") + "/",
			"#utils/": r("src/Utils") + "/",
			"#types/": r("src/Types") + "/",
			"#composition/": r("src/Composition") + "/",
		},
	},
	test: {
		include: ["src/**/*.test.ts"],
		coverage: {
			reporter: ["lcov"],
		},
	},
});
