// @ts-check
import starlight from "@astrojs/starlight";
import mermaid from "astro-mermaid";
import { defineConfig } from "astro/config";
import starlightThemeNova from "starlight-theme-nova";
import starlightTypeDoc, { typeDocSidebarGroup } from "starlight-typedoc";

export default defineConfig({
	redirects: {
		"/api/utils/namespaces/arr/functions": "/api/utils/namespaces/arr/functions/chunksof",
		"/api/utils/namespaces/rec/functions": "/api/utils/namespaces/rec/functions/compact",
		"/api/utils/namespaces/uniq/functions": "/api/utils/namespaces/uniq/functions/difference",
		"/api/utils/namespaces/dict/functions": "/api/utils/namespaces/dict/functions/compact",
		"/api/utils/namespaces/num/functions": "/api/utils/namespaces/num/functions/add",
		"/api/utils/namespaces/str/functions": "/api/utils/namespaces/str/functions/endswith",
	},
	integrations: [
		mermaid(),
		starlight({
			title: "pipelined",
			favicon: "favicon.svg",
			customCss: ["./src/styles/custom.css"],
			components: {
				Footer: "./src/components/Footer.astro",
			},
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: "https://github.com/nlozgachev/pipelined",
				},
				{
					icon: "npm",
					label: "npm",
					href: "https://www.npmjs.com/package/@nlozgachev/pipelined",
				},
			],
			plugins: [
				starlightThemeNova({
					nav: [
						{
							label: "Docs",
							href: "/basics/installation",
						},
					],
				}),
				starlightTypeDoc({
					entryPoints: [
						"../src/Core/index.ts",
						"../src/Types/index.ts",
						"../src/Composition/index.ts",
						"../src/Utils/index.ts",
					],
					tsconfig: "../tsconfig.typedoc.json",
					output: "api",
					typeDoc: {
						entryPointStrategy: "expand",
						excludePrivate: true,
						excludeInternal: true,
					},
					sidebar: {
						label: "API Reference",
						collapsed: true,
					},
				}),
			],
			sidebar: [
				{
					label: "The basics",
					collapsed: false,
					items: [
						{ label: "Installation", slug: "basics/installation" },
						{
							label: "Thinking in pipelines",
							slug: "basics/pipelines",
						},
						{
							label: "What you will learn",
							slug: "basics/overview",
						},
						{
							label: "Composition utilities",
							slug: "basics/composition",
						},
					],
				},
				{
					label: "Errors & absence",
					collapsed: false,
					items: [
						{ label: "Maybe — absent values", slug: "guides/maybe" },
						{ label: "Result — handling failures", slug: "guides/result" },
						{
							label: "Validation — collecting errors",
							slug: "guides/validation",
						},
						{ label: "These — inclusive OR", slug: "guides/these" },
					],
				},
				{
					label: "Async",
					collapsed: false,
					items: [
						{ label: "Task — lazy async", slug: "guides/task" },
						{
							label: "Deferred — infallible async values",
							slug: "guides/deferred",
						},
						{ label: "Op — managed async operations", slug: "guides/op" },
						{
							label: "RemoteData — loading states",
							slug: "guides/remote-data",
						},
						{
							label: "Resource — safe acquire-release",
							slug: "guides/resource",
						},
					],
				},
				{
					label: "State & context",
					collapsed: false,
					items: [
						{
							label: "Reader — deferred dependencies",
							slug: "guides/reader",
						},
						{ label: "State — threading state", slug: "guides/state" },
						{ label: "Logged — values with logs", slug: "guides/logged" },
					],
				},
				{
					label: "Nested data",
					collapsed: false,
					items: [
						{ label: "Lens — nested updates", slug: "guides/lens" },
						{
							label: "Optional — nullable paths",
							slug: "guides/optional",
						},
						{ label: "Tuple — typed pairs", slug: "guides/tuple" },
					],
				},
				{
					label: "Type safety",
					collapsed: false,
					items: [
						{
							label: "Brand — distinguishing values",
							slug: "guides/brand",
						},
						{ label: "Duration — type-safe time", slug: "guides/duration" },
						{
							label: "Refinement — type predicates",
							slug: "guides/refinement",
						},
						{
							label: "Predicate — boolean checks",
							slug: "guides/predicate",
						},
					],
				},
				{
					label: "Comparing & combining",
					collapsed: false,
					items: [
						{
							label: "Equality — custom equality",
							slug: "guides/equality",
						},
						{
							label: "Ordering — typed comparators",
							slug: "guides/ordering",
						},
						{
							label: "Combinable — combining values",
							slug: "guides/combinable",
						},
						{ label: "Lazy — memoized values", slug: "guides/lazy" },
					],
				},
				{
					label: "Collection utilities",
					collapsed: false,
					items: [
						{ label: "Arr — array utilities", slug: "guides/arr" },
						{ label: "Str — string utilities", slug: "guides/str" },
						{ label: "Num — number utilities", slug: "guides/num" },
						{ label: "Rec — record utilities", slug: "guides/rec" },
						{ label: "Dict — dictionary utilities", slug: "guides/dict" },
						{
							label: "Uniq — unique collection utilities",
							slug: "guides/uniq",
						},
					],
				},

				{
					label: "Appendix",
					items: [
						{ label: "Why this exists", slug: "appendix/motivation" },
						{ label: "Design & influences", slug: "appendix/influences" },
						{ label: "Performance & benchmarks", slug: "appendix/benchmarks" },
					],
				},
				typeDocSidebarGroup,
			],
		}),
	],
});
