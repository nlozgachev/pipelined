import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		composition: "src/Composition/index.ts",
		core: "src/Core/index.ts",
		utils: "src/Utils/index.ts",
		types: "src/Types/index.ts",
	},
	format: ["esm", "cjs"],
	dts: true,
	clean: true,
	target: "es2024",
	outDir: "dist",
});
