import { defineConfig } from "tsdown";

export default defineConfig({
	entry: { index: "src/index.ts" },
	format: ["esm", "cjs"],
	outExtensions({ format }) {
		return { js: format === "cjs" ? ".cjs" : ".mjs", dts: format === "cjs" ? ".d.cts" : ".d.ts" };
	},
	clean: true,
	target: "es2024",
	dts: true,
	publint: true,
	attw: { profile: "node16" },
});
