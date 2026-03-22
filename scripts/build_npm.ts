import { build, emptyDir } from "@deno/dnt";

const denoJson = JSON.parse(await Deno.readTextFile("./deno.json"));

await emptyDir("./npm");

await build({
	entryPoints: [
		"mod.ts",
		{
			name: "./composition",
			path: "./src/Composition/index.ts",
		},
		{
			name: "./core",
			path: "./src/Core/index.ts",
		},
		{
			name: "./utils",
			path: "./src/Utils/index.ts",
		},
		{
			name: "./types",
			path: "./src/Types/index.ts",
		},
	],
	importMap: "./deno.json",
	outDir: "./npm",
	shims: {
		deno: false,
	},
	declaration: "separate",
	test: false,
	typeCheck: "both",
	compilerOptions: {
		lib: ["ES2022", "DOM"],
		target: "ES2022",
	},
	package: {
		name: "@nlozgachev/pipelined",
		version: denoJson.version,
		homepage: "https://pipelined.lozgachev.dev",
		description: "Simple functional programming toolkit for TypeScript",
		license: "BSD-3-Clause",
		sideEffects: false,
		repository: {
			type: "git",
			url: "https://github.com/nlozgachev/pipelined",
		},
		keywords: ["functional", "fp", "typescript", "composition", "pipe"],
		engines: { node: ">=22" },
	},
	postBuild() {
		try {
			Deno.copyFileSync("README.md", "npm/README.md");
		} catch {
			console.error("ERROR: Unable to copy README.md");
		}

		const pkgPath = "./npm/package.json";
		const pkg = JSON.parse(Deno.readTextFileSync(pkgPath));

		delete pkg.main;
		delete pkg.module;
		delete pkg._generatedBy;
		delete pkg.exports["."];

		pkg.files = ["esm", "script", "types"];

		Deno.writeTextFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
	},
});
