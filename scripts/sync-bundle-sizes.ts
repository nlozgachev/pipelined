import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

interface SizeItem {
	name: string;
	size: number;
	sizeLimit?: number;
	passed?: boolean;
}

const pkgName = "@nlozgachev/pipelined";

const GUIDE_MAP: Record<string, { module: string; }> = {
	"arr.md": { module: "Arr" },
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

export function formatBytes(bytes: number): string {
	if (bytes < 1000) {
		return `${bytes} B`;
	}
	const kb = bytes / 1000;
	return `${kb.toFixed(2)} kB`;
}

export function formatNumberWithCommas(n: number): string {
	return n.toLocaleString("en-US");
}

export function getMeasuredSizes(): Map<string, SizeItem> {
	const coreDist = path.join(projectRoot, "dist/core.mjs");
	if (!fs.existsSync(coreDist)) {
		execSync("pnpm build", { cwd: projectRoot, stdio: "inherit" });
	}
	const raw = execSync("pnpm size-limit --json", { cwd: projectRoot, encoding: "utf8" });
	const items = JSON.parse(raw) as SizeItem[];
	const map = new Map<string, SizeItem>();
	for (const item of items) {
		map.set(item.name, item);
	}
	return map;
}

export function requireSize(sizeMap: Map<string, SizeItem>, target: string): number {
	const item = sizeMap.get(target);
	if (!item) {
		throw new Error(`Bundle size sync failed: target "${target}" not found in size-limit output.`);
	}
	return item.size;
}

export const STANDALONE_MODULES = [
	"pipe",
	"flow",
	"Brand",
	"Duration",
	"Maybe",
	"Result",
	"Validation",
	"RemoteData",
	"Machine",
	"EventBus",
	"Resource",
	"Graph",
	"Task",
	"Op",
	"Lens",
	"Arr",
	"Rec",
	"Dict",
	"Str",
] as const;

export function buildBundleTables(sizeMap: Map<string, SizeItem>): string {
	const standaloneRows = STANDALONE_MODULES.map((name) => {
		const item = sizeMap.get(name);
		if (!item) { return ""; }
		return `| \`${name}\` | **${formatBytes(item.size)}** |`;
	}).filter(Boolean).join("\n");

	const subpaths = [{
		name: "Index (Monolithic import *)",
		display: "**All entry points combined**",
		scope: "Monolithic import of entire library",
	}];

	const subpathRows = subpaths.map(({ name, display, scope }) => {
		const item = sizeMap.get(name);
		if (!item) { return ""; }
		const limitStr = item.sizeLimit ? formatBytes(item.sizeLimit) : "N/A";
		return `| ${display} | ${scope} | **${formatBytes(item.size)}** | ${limitStr} |`;
	}).filter(Boolean).join("\n");

	return `### Standalone Module Footprint (Tree-Shaken)

When imported individually, only the targeted module is bundled into your application:

| Import Pattern | Subpath | Minified + Gzipped |
| :--- | :--- | :--- |
${standaloneRows}

### Subpath Ceilings (Worst-Case Monolithic Imports)

The upper bounds below apply only if your application imports every exported symbol from that subpath:

| Subpath | Scope | Gzipped Size | Budget Limit |
| :--- | :--- | :--- | :--- |
${subpathRows}`;
}

export function updateReadme(sizeMap: Map<string, SizeItem>): void {
	const readmePath = path.join(projectRoot, "README.md");
	let content = fs.readFileSync(readmePath, "utf8");

	const standaloneSizes = STANDALONE_MODULES.map((name) => requireSize(sizeMap, name));
	const minIndividual = Math.min(...standaloneSizes);
	const maxIndividual = Math.max(...standaloneSizes);
	const indexSize = requireSize(sizeMap, "Index (Monolithic import *)");

	const overviewReplacement =
		`<!-- BUNDLE_OVERVIEW:START -->\nIt has zero dependencies, ships ESM and CommonJS builds, and tree-shakes down to ~${
			formatBytes(minIndividual)
		}–${formatBytes(maxIndividual)} gzipped for individual modules and ${
			formatBytes(indexSize)
		} for the entire package.\n<!-- BUNDLE_OVERVIEW:END -->`;

	if (content.includes("<!-- BUNDLE_OVERVIEW:START -->")) {
		content = content.replace(/<!-- BUNDLE_OVERVIEW:START -->[\s\S]*?<!-- BUNDLE_OVERVIEW:END -->/, overviewReplacement);
	} else {
		content = content.replace(
			/It has zero dependencies, ships ESM and CommonJS builds[\s\S]*?\(<20 KB for the whole package\)\./,
			overviewReplacement,
		);
	}

	const tables = buildBundleTables(sizeMap);
	const tableReplacement = `<!-- BUNDLE_TABLE:START -->\n${tables}\n<!-- BUNDLE_TABLE:END -->`;

	if (content.includes("<!-- BUNDLE_TABLE:START -->")) {
		content = content.replace(/<!-- BUNDLE_TABLE:START -->[\s\S]*?<!-- BUNDLE_TABLE:END -->/, tableReplacement);
	} else {
		const archPattern =
			/## Package Architecture and Performance\s*\n\s*`pipelined` is split into four tree-shakeable entry points:\s*\n\s*- \*\*`@nlozgachev\/pipelined\/core`[\s\S]*?(?=Data helpers use pre-allocated)/;
		content = content.replace(
			archPattern,
			`## Package Architecture and Performance\n\nAll entry points are published with \`"sideEffects": false\` and structured as static constant objects without class prototypes or closure side-effects. Modern bundlers (Vite, Rollup, webpack, esbuild, Next.js) automatically tree-shake unused functions and modules, bundling only the specific symbols imported by your application.\n\n${tableReplacement}\n\n`,
		);
	}

	fs.writeFileSync(readmePath, content, "utf8");
}

export function updateInstallationDoc(sizeMap: Map<string, SizeItem>): void {
	const docPath = path.join(projectRoot, "docs/src/content/docs/basics/installation.mdx");
	let content = fs.readFileSync(docPath, "utf8");

	const tables = buildBundleTables(sizeMap);
	const tableReplacement = `{/* BUNDLE_TABLE:START */}\n${tables}\n{/* BUNDLE_TABLE:END */}`;

	const existingTablePattern =
		/(?:<!--\s*BUNDLE_TABLE:START\s*-->[\s\S]*?<!--\s*BUNDLE_TABLE:END\s*-->|\{\/\*\s*BUNDLE_TABLE:START\s*\*\/\}[\s\S]*?\{\/\*\s*BUNDLE_TABLE:END\s*\*\/\})/;

	if (existingTablePattern.test(content)) {
		content = content.replace(existingTablePattern, tableReplacement);
	} else {
		const treeShakingPattern =
			/### Tree-Shaking\s*\n\s*All entry points are published with `"sideEffects": false`[\s\S]*?(?=## Requirements)/;
		const sectionReplacement =
			`### Tree-Shaking & Bundle Impact\n\nAll entry points are published with \`"sideEffects": false\` and structured as static constant objects without class prototypes or closure side-effects. Modern bundlers (Vite, Rollup, webpack, esbuild, Next.js) automatically tree-shake unused functions and modules, bundling only the specific symbols imported by your application.\n\n${tableReplacement}\n\n`;
		content = content.replace(treeShakingPattern, sectionReplacement);
	}

	fs.writeFileSync(docPath, content, "utf8");
}

export function updateGuides(sizeMap: Map<string, SizeItem>): void {
	const guidesDir = path.join(projectRoot, "docs/src/content/docs/guides");

	for (const [filename, { module }] of Object.entries(GUIDE_MAP)) {
		const filePath = path.join(guidesDir, filename);
		if (!fs.existsSync(filePath)) { continue; }

		let content = fs.readFileSync(filePath, "utf8");
		const item = sizeMap.get(module);
		if (!item) { continue; }

		const isMdx = filename.endsWith(".mdx");
		const startTag = isMdx ? "{/* BUNDLE_SIZE:START */}" : "<!-- BUNDLE_SIZE:START -->";
		const endTag = isMdx ? "{/* BUNDLE_SIZE:END */}" : "<!-- BUNDLE_SIZE:END -->";

		const callout = `${startTag}\n\n> ${formatBytes(item.size)} minified + gzipped\n\n${endTag}`;

		// First, remove any existing BUNDLE_SIZE blocks across the file
		const anyExistingPattern =
			/(?:<!--\s*BUNDLE_SIZE:START\s*-->[\s\S]*?<!--\s*BUNDLE_SIZE:END\s*-->|\{\/\*\s*BUNDLE_SIZE:START\s*\*\/\}[\s\S]*?\{\/\*\s*BUNDLE_SIZE:END\s*\*\/\})\r?\n*/g;
		content = content.replace(anyExistingPattern, "");

		// Now insert directly after the frontmatter closing ---
		const frontmatterMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
		if (frontmatterMatch) {
			const endOfFrontmatter = frontmatterMatch[0].length;
			content = `${content.slice(0, endOfFrontmatter)}${callout}\n\n${content.slice(endOfFrontmatter).trimStart()}`;
		} else {
			content = `${callout}\n\n${content}`;
		}

		fs.writeFileSync(filePath, content, "utf8");
	}
}

export function syncAll(): void {
	console.log("Measuring bundle sizes via size-limit...");
	const sizeMap = getMeasuredSizes();
	console.log(`Measured ${sizeMap.size} size targets.`);

	console.log("Updating README.md...");
	updateReadme(sizeMap);

	console.log("Updating docs/src/content/docs/basics/installation.mdx...");
	updateInstallationDoc(sizeMap);

	console.log("Updating guides in docs/src/content/docs/guides/...");
	updateGuides(sizeMap);

	console.log("Formatting modified documents with dprint...");
	try {
		execSync("pnpm format", { cwd: projectRoot, stdio: "inherit" });
	} catch (e) {
		console.warn("Formatting failed or dprint not found:", e);
	}

	console.log("Bundle sizes synchronized successfully.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	syncAll();
}
