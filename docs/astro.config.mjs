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
					nodeBorder: "#3f3f46",
					clusterBkg: "#18181b",
					clusterBorder: "#3f3f46",
					titleColor: "#f4f4f5",
					tertiaryTextColor: "#f4f4f5",
					lineColor: "#71717a",
					defaultLinkColor: "#71717a",
					arrowheadColor: "#71717a",
					nodeTextColor: "#f4f4f5",
					edgeLabelBackground: "#1f1f23",
					labelBackground: "#1f1f23",
					labelBoxBkgColor: "#1f1f23",
					labelBoxBorderColor: "#3f3f46",
					labelTextColor: "#d4d4d8",
					textColor: "#f4f4f5",
					noteBkgColor: "#27272a",
					noteTextColor: "#f4f4f5",
					noteBorderColor: "#3f3f46",
					fontSize: "14px",
					fontFamily: "ui-sans-serif, system-ui, sans-serif",
					dropShadow: "none",
					nodeShadow: false,
				},
				flowchart: { curve: "basis", htmlLabels: false, minNodeWidth: 0, padding: 8, nodeSpacing: 45, rankSpacing: 45 },
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
					items: [
						{ slug: "guides/task" },
						{ slug: "guides/deferred" },
						{ slug: "guides/op" },
						{ slug: "guides/event-bus" },
						{ slug: "guides/resource" },
					],
				},
				{
					label: "State & context",
					collapsed: false,
					items: [{ slug: "guides/reader" }, { slug: "guides/state" }, { slug: "guides/machine" }, {
						slug: "guides/logged",
					}],
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
					items: [{ slug: "guides/equality" }, { slug: "guides/ordering" }, { slug: "guides/combinable" }],
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
