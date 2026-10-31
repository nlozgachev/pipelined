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

const GUIDE_MAP: Record<string, { module: string; }> = {
	"arr.md": { module: "Arr" },
	"batcher.md": { module: "Batcher" },
	"bignum.md": { module: "BigNum" },
	"bool.md": { module: "Bool" },
	"brand.md": { module: "Brand" },
	"circuit-breaker.md": { module: "CircuitBreaker" },
	"combinable.md": { module: "Combinable" },
	"deferred.md": { module: "Deferred" },
	"dict.md": { module: "Dict" },
	"duration.md": { module: "Duration" },
	"equality.md": { module: "Equality" },
	"event-bus.md": { module: "EventBus" },
	"graph.md": { module: "Graph" },
	"json.md": { module: "Json" },
	"lens.md": { module: "Lens" },
	"logged.md": { module: "Logged" },
	"machine.md": { module: "Machine" },
	"maybe.md": { module: "Maybe" },
	"num.md": { module: "Num" },
	"op.mdx": { module: "Op" },
	"optional.md": { module: "Optional" },
	"ordering.md": { module: "Ordering" },
	"pair.md": { module: "Pair" },
	"predicate.md": { module: "Predicate" },
	"reader.md": { module: "Reader" },
	"rec.md": { module: "Rec" },
	"refinement.mdx": { module: "Refinement" },
	"remote-data.md": { module: "RemoteData" },
	"resource.md": { module: "Resource" },
	"result.md": { module: "Result" },
	"state.md": { module: "State" },
	"str.md": { module: "Str" },
	"task.mdx": { module: "Task" },
	"these.md": { module: "These" },
	"uniq.mdx": { module: "Uniq" },
	"validation.md": { module: "Validation" },
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
		const expectedFormatted = formatBytes(item!.size);

		expect(content).toContain(expectedFormatted);
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
		const expectedFormatted = formatBytes(item!.size);

		expect(content).toContain(expectedFormatted);
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

		const expectedCallout = `> ${formatBytes(item!.size)} minified + gzipped`;

		expect(content).toContain(expectedCallout);
	}
});
