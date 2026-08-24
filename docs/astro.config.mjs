// @ts-check
import starlight from "@astrojs/starlight";
import mermaid from "astro-mermaid";
import { defineConfig } from "astro/config";
import starlightThemeNova from "starlight-theme-nova";
import starlightTypeDoc, { typeDocSidebarGroup } from "starlight-typedoc";

export default defineConfig({
	integrations: [
		mermaid({
			theme: "base",
			autoTheme: false,
			mermaidConfig: {
				theme: "base",
				themeVariables: {
					darkMode: true,
					background: "#18181b",
					mainBkg: "#1f1f23",
					nodeBorder: "#52525b",
					clusterBkg: "#18181b",
					lineColor: "#71717a",
					defaultLinkColor: "#71717a",
					arrowheadColor: "#3b82f6",
					nodeTextColor: "#f4f4f5",
					edgeLabelBackground: "#27272a",
					labelBackground: "#27272a",
					textColor: "#f4f4f5",
					fontFamily: "ui-sans-serif, system-ui, sans-serif",
				},
				flowchart: { curve: "linear", htmlLabels: true },
			},
		}),
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
						"../src/Data/index.ts",
					],
					tsconfig: "../tsconfig.typedoc.json",
					output: "api",
					typeDoc: { entryPointStrategy: "expand", excludePrivate: true, excludeInternal: true },
					sidebar: { label: "API Reference", collapsed: true },
				}),
			],
			sidebar: [
				{
					label: "The basics",
					collapsed: false,
					items: [{ slug: "basics/installation" }, { slug: "basics/pipelines" }, { slug: "basics/overview" }, {
						slug: "basics/composition",
					}],
				},
				{
					label: "Errors & absence",
					collapsed: false,
					items: [{ slug: "guides/maybe" }, { slug: "guides/result" }, { slug: "guides/validation" }],
				},
				{
					label: "Data containers",
					collapsed: false,
					items: [{ slug: "guides/pair" }, { slug: "guides/these" }, { slug: "guides/remote-data" }],
				},
				{
					label: "Async",
					collapsed: false,
					items: [{ slug: "guides/task" }, { slug: "guides/deferred" }, { slug: "guides/op" }, { slug: "guides/stream" }, {
						slug: "guides/resource",
					}],
				},
				{
					label: "State & context",
					collapsed: false,
					items: [{ slug: "guides/reader" }, { slug: "guides/state" }, { slug: "guides/logged" }],
				},
				{ label: "Optics", collapsed: false, items: [{ slug: "guides/lens" }, { slug: "guides/optional" }] },
				{
					label: "Type safety",
					collapsed: false,
					items: [{ slug: "guides/brand" }, { slug: "guides/duration" }, { slug: "guides/nonempty" }, {
						slug: "guides/refinement",
					}, { slug: "guides/predicate" }],
				},
				{
					label: "Comparing & combining",
					collapsed: false,
					items: [{ slug: "guides/equality" }, { slug: "guides/ordering" }, { slug: "guides/combinable" }, {
						slug: "guides/lazy",
					}],
				},
				{
					label: "Collection utilities",
					collapsed: false,
					items: [
						{ slug: "guides/arr" },
						{ slug: "guides/str" },
						{ slug: "guides/num" },
						{ slug: "guides/bignum" },
						{ slug: "guides/bool" },
						{ slug: "guides/rec" },
						{ slug: "guides/dict" },
						{ slug: "guides/uniq" },
						{ slug: "guides/json" },
					],
				},
				{
					label: "Appendix",
					items: [{ slug: "appendix/motivation" }, { slug: "appendix/influences" }, { slug: "appendix/benchmarks" }],
				},
				typeDocSidebarGroup,
			],
		}),
	],
});
