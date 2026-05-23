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
			components: { Footer: "./src/components/Footer.astro" },
			social: [{ icon: "github", label: "GitHub", href: "https://github.com/nlozgachev/pipelined" }, {
				icon: "npm",
				label: "npm",
				href: "https://www.npmjs.com/package/@nlozgachev/pipelined",
			}],
			plugins: [
				starlightThemeNova({ nav: [{ label: "Docs", href: "/basics/installation" }] }),
				starlightTypeDoc({
					entryPoints: [
						"../src/Core/index.ts",
						"../src/Types/index.ts",
						"../src/Composition/index.ts",
						"../src/Utils/index.ts",
					],
					tsconfig: "../tsconfig.typedoc.json",
					output: "api",
					typeDoc: { entryPointStrategy: "expand", excludePrivate: true, excludeInternal: true },
					sidebar: { label: "API Reference", collapsed: true },
				}),
			],
			sidebar: [{
				label: "The basics",
				collapsed: false,
				items: [{ slug: "basics/installation" }, { slug: "basics/pipelines" }, { slug: "basics/overview" }, {
					slug: "basics/composition",
				}],
			}, {
				label: "Errors & absence",
				collapsed: false,
				items: [{ slug: "guides/maybe" }, { slug: "guides/result" }, { slug: "guides/validation" }, {
					slug: "guides/these",
				}],
			}, {
				label: "Async",
				collapsed: false,
				items: [
					{ slug: "guides/task" },
					{ slug: "guides/deferred" },
					{ slug: "guides/op" },
					{ slug: "guides/remote-data" },
					{ slug: "guides/resource" },
				],
			}, {
				label: "State & context",
				collapsed: false,
				items: [{ slug: "guides/reader" }, { slug: "guides/state" }, { slug: "guides/logged" }],
			}, {
				label: "Nested data",
				collapsed: false,
				items: [{ slug: "guides/lens" }, { slug: "guides/optional" }, { slug: "guides/tuple" }],
			}, {
				label: "Type safety",
				collapsed: false,
				items: [{ slug: "guides/brand" }, { slug: "guides/duration" }, { slug: "guides/refinement" }, {
					slug: "guides/predicate",
				}],
			}, {
				label: "Comparing & combining",
				collapsed: false,
				items: [{ slug: "guides/equality" }, { slug: "guides/ordering" }, { slug: "guides/combinable" }, {
					slug: "guides/lazy",
				}],
			}, {
				label: "Collection utilities",
				collapsed: false,
				items: [{ slug: "guides/arr" }, { slug: "guides/str" }, { slug: "guides/num" }, { slug: "guides/rec" }, {
					slug: "guides/dict",
				}, { slug: "guides/uniq" }],
			}, {
				label: "Appendix",
				items: [{ slug: "appendix/motivation" }, { slug: "appendix/influences" }, { slug: "appendix/benchmarks" }],
			}, typeDocSidebarGroup],
		}),
	],
});
