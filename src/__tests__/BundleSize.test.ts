import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

const projectRoot = path.resolve(__dirname, "../../");

interface SizeItem {
	name: string;
	size: number;
	sizeLimit?: number;
	passed?: boolean;
}

function formatBytes(bytes: number): string {
	if (bytes < 1000) {
		return `${bytes} B`;
	}
	const kb = bytes / 1000;
	return `${kb.toFixed(2)} kB`;
}

function formatNumberWithCommas(n: number): string {
	return n.toLocaleString("en-US");
}

function getMeasuredSizes(): Map<string, SizeItem> {
	const coreDist = path.join(projectRoot, "dist/core.mjs");
	if (!fs.existsSync(coreDist)) {
		execSync("pnpm build", { cwd: projectRoot, stdio: "pipe" });
	}
	const raw = execSync("npx size-limit --json", { cwd: projectRoot, encoding: "utf8" });
	const items = JSON.parse(raw) as SizeItem[];
	const map = new Map<string, SizeItem>();
	for (const item of items) {
		map.set(item.name, item);
	}
	return map;
}

const GUIDE_MAP: Record<string, { module: string; subpath: string; }> = {
	"arr.md": { module: "Arr", subpath: "@nlozgachev/pipelined/data" },
	"bignum.md": { module: "BigNum", subpath: "@nlozgachev/pipelined/data" },
	"bool.md": { module: "Bool", subpath: "@nlozgachev/pipelined/data" },
	"brand.md": { module: "Brand", subpath: "@nlozgachev/pipelined/types" },
	"combinable.md": { module: "Combinable", subpath: "@nlozgachev/pipelined/core" },
	"deferred.md": { module: "Deferred", subpath: "@nlozgachev/pipelined/core" },
	"dict.md": { module: "Dict", subpath: "@nlozgachev/pipelined/data" },
	"duration.md": { module: "Duration", subpath: "@nlozgachev/pipelined/types" },
	"equality.md": { module: "Equality", subpath: "@nlozgachev/pipelined/core" },
	"event-bus.md": { module: "EventBus", subpath: "@nlozgachev/pipelined/core" },
	"graph.md": { module: "Graph", subpath: "@nlozgachev/pipelined/core" },
	"json.md": { module: "Json", subpath: "@nlozgachev/pipelined/data" },
	"lens.md": { module: "Lens", subpath: "@nlozgachev/pipelined/core" },
	"logged.md": { module: "Logged", subpath: "@nlozgachev/pipelined/core" },
	"machine.md": { module: "Machine", subpath: "@nlozgachev/pipelined/core" },
	"maybe.md": { module: "Maybe", subpath: "@nlozgachev/pipelined/core" },
	"num.md": { module: "Num", subpath: "@nlozgachev/pipelined/data" },
	"op.mdx": { module: "Op", subpath: "@nlozgachev/pipelined/core" },
	"optional.md": { module: "Optional", subpath: "@nlozgachev/pipelined/core" },
	"ordering.md": { module: "Ordering", subpath: "@nlozgachev/pipelined/core" },
	"pair.md": { module: "Pair", subpath: "@nlozgachev/pipelined/core" },
	"predicate.md": { module: "Predicate", subpath: "@nlozgachev/pipelined/core" },
	"reader.md": { module: "Reader", subpath: "@nlozgachev/pipelined/core" },
	"rec.md": { module: "Rec", subpath: "@nlozgachev/pipelined/data" },
	"refinement.mdx": { module: "Refinement", subpath: "@nlozgachev/pipelined/core" },
	"remote-data.md": { module: "RemoteData", subpath: "@nlozgachev/pipelined/core" },
	"resource.md": { module: "Resource", subpath: "@nlozgachev/pipelined/core" },
	"result.md": { module: "Result", subpath: "@nlozgachev/pipelined/core" },
	"state.md": { module: "State", subpath: "@nlozgachev/pipelined/core" },
	"str.md": { module: "Str", subpath: "@nlozgachev/pipelined/data" },
	"task.mdx": { module: "Task", subpath: "@nlozgachev/pipelined/core" },
	"these.md": { module: "These", subpath: "@nlozgachev/pipelined/core" },
	"uniq.mdx": { module: "Uniq", subpath: "@nlozgachev/pipelined/data" },
	"validation.md": { module: "Validation", subpath: "@nlozgachev/pipelined/core" },
};

const sizeMap = getMeasuredSizes();

test("BundleSize: enforces size-limit budgets across all targets", () => {
	for (const [name, item] of sizeMap) {
		expect(item.passed, `Target "${name}" exceeded limit: ${item.size} > ${item.sizeLimit}`).toBe(true);
	}
});

test("BundleSize: verifies README.md reflects current measured sizes", () => {
	const readmePath = path.join(projectRoot, "README.md");
	const content = fs.readFileSync(readmePath, "utf8");

	expect(content).toContain("<!-- BUNDLE_TABLE:START -->");
	expect(content).toContain("<!-- BUNDLE_TABLE:END -->");

	for (const name of ["Machine", "Result", "Maybe", "Op", "EventBus", "pipe"]) {
		const item = sizeMap.get(name);
		expect(item, `Size item for ${name} not found in sizeMap`).toBeDefined();
		const expectedBytes = formatNumberWithCommas(item!.size);
		const expectedFormatted = formatBytes(item!.size);

		expect(content).toContain(expectedFormatted);
		expect(content).toContain(expectedBytes);
	}
});

test("BundleSize: verifies installation.mdx reflects current measured sizes", () => {
	const docPath = path.join(projectRoot, "docs/src/content/docs/basics/installation.mdx");
	const content = fs.readFileSync(docPath, "utf8");

	expect(content).toContain("{/* BUNDLE_TABLE:START */}");
	expect(content).toContain("{/* BUNDLE_TABLE:END */}");

	for (const name of ["Machine", "Result", "Maybe", "Resource", "Task"]) {
		const item = sizeMap.get(name);
		expect(item, `Size item for ${name} not found in sizeMap`).toBeDefined();
		const expectedBytes = formatNumberWithCommas(item!.size);
		const expectedFormatted = formatBytes(item!.size);

		expect(content).toContain(expectedFormatted);
		expect(content).toContain(expectedBytes);
	}
});

test("BundleSize: verifies all module guides contain exact measured sizes without drift", () => {
	const guidesDir = path.join(projectRoot, "docs/src/content/docs/guides");

	for (const [filename, { module }] of Object.entries(GUIDE_MAP)) {
		const filePath = path.join(guidesDir, filename);
		expect(fs.existsSync(filePath), `Guide file ${filename} does not exist`).toBe(true);

		const content = fs.readFileSync(filePath, "utf8");
		const isMdx = filename.endsWith(".mdx");
		const startTag = isMdx ? "{/* BUNDLE_SIZE:START */}" : "<!-- BUNDLE_SIZE:START -->";
		expect(content).toContain(startTag);

		const occurrences = (content.match(/BUNDLE_SIZE:START/g) || []).length;
		expect(occurrences, `Duplicate BUNDLE_SIZE:START blocks found in ${filename}`).toBe(1);

		const item = sizeMap.get(module);
		expect(item, `Size item for ${module} not found in sizeMap`).toBeDefined();

		const expectedCallout = item!.size < 1000
			? `> ${formatBytes(item!.size)} minified + gzipped`
			: `> ${formatBytes(item!.size)} minified + gzipped (${formatNumberWithCommas(item!.size)} B)`;

		expect(content).toContain(expectedCallout);
	}
});
