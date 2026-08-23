import { build } from "esbuild";
import path from "node:path";
import { expect, test } from "vitest";

const projectRoot = path.resolve(__dirname, "../../");

async function bundleCode(inputCode: string, minify = false): Promise<string> {
	const result = await build({
		stdin: { contents: inputCode, resolveDir: projectRoot, loader: "ts" },
		bundle: true,
		treeShaking: true,
		minify,
		platform: "node",
		format: "esm",
		target: "es2024",
		write: false,
		alias: {
			"#core": path.resolve(projectRoot, "src/Core/index.ts"),
			"#data": path.resolve(projectRoot, "src/Data/index.ts"),
			"#types": path.resolve(projectRoot, "src/Types/index.ts"),
			"#composition": path.resolve(projectRoot, "src/Composition/index.ts"),
			"#internal": path.resolve(projectRoot, "src/internal/index.ts"),
		},
	});

	return result.outputFiles[0].text;
}

test("Tree-shaking: importing only Maybe from #core excludes Op, Stream, and Dict", async () => {
	const code = `
		import { Maybe } from "#core";
		const val = Maybe.make.some(42);
		console.log(val);
	`;
	const output = await bundleCode(code);
	expect(output).not.toContain("OpErr");
	expect(output).not.toContain("Stream");
	expect(output).not.toContain("Dict");
	expect(output).not.toContain("TaskValidation");
});

test("Tree-shaking: importing only Result from #core excludes Op and Stream", async () => {
	const code = `
		import { Result } from "#core";
		const res = Result.make.ok("success");
		console.log(res);
	`;
	const output = await bundleCode(code);
	expect(output).not.toContain("Stream");
	expect(output).not.toContain("OpErr");
	expect(output).not.toContain("TaskValidation");
});

test("Tree-shaking: importing only Arr from #data excludes Dict, Rec, Str, and Uniq", async () => {
	const code = `
		import { Arr } from "#data";
		const res = Arr.head([1, 2, 3]);
		console.log(res);
	`;
	const output = await bundleCode(code);
	expect(output).not.toContain("Dict");
	expect(output).not.toContain("Uniq");
	expect(output).not.toContain("NonEmptyString");
});

test("Tree-shaking: importing only Dict from #data excludes Arr, Rec, Str, and Uniq", async () => {
	const code = `
		import { Dict } from "#data";
		const m = Dict.empty();
		console.log(m);
	`;
	const output = await bundleCode(code);
	expect(output).not.toContain("chunkBy");
	expect(output).not.toContain("dedupeAdjacent");
	expect(output).not.toContain("NonEmptyString");
});

test("Tree-shaking: importing only pipe from #composition excludes Core and Data abstractions", async () => {
	const code = `
		import { pipe } from "#composition";
		const res = pipe(5, (n: number) => n * 2);
		console.log(res);
	`;
	const output = await bundleCode(code);
	expect(output).not.toContain("Maybe");
	expect(output).not.toContain("Result");
	expect(output).not.toContain("Arr");
	expect(output).not.toContain("Dict");
	expect(output.length).toBeLessThan(3000);
});

test("Tree-shaking: importing Duration from #types excludes Core, Data, and Composition", async () => {
	const code = `
		import { Duration } from "#types";
		const d = Duration.seconds(5);
		console.log(d);
	`;
	const output = await bundleCode(code);
	expect(output).not.toContain("Maybe");
	expect(output).not.toContain("Result");
	expect(output).not.toContain("Arr");
	expect(output).not.toContain("function pipe");
});

test("Tree-shaking: minified bundle using pipe + Maybe.map is under 6 KB", async () => {
	const code = `
		import { pipe } from "#composition";
		import { Maybe } from "#core";

		const result = pipe(
			Maybe.make.some(10),
			Maybe.map((n: number) => n * 2),
			Maybe.getOrElse(() => 0)
		);
		console.log(result);
	`;
	const minified = await bundleCode(code, true);
	expect(minified.length).toBeLessThan(6000);
});
