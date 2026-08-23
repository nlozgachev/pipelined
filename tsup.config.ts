import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		composition: "src/Composition/index.ts",
		core: "src/Core/index.ts",
		data: "src/Data/index.ts",
		types: "src/Types/index.ts",
	},
	format: ["esm", "cjs"],
	outExtension({ format }) {
		return { js: format === "cjs" ? ".cjs" : ".mjs" };
	},
	splitting: false,
	// [WARN]: workaround
	// https://github.com/egoist/tsup/issues/1388
	dts: { compilerOptions: { ignoreDeprecations: "6.0" } },
	clean: true,
	target: "es2024",
	outDir: "dist",
});
