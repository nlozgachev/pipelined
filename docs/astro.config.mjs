// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightTypeDoc, { typeDocSidebarGroup } from "starlight-typedoc";
import starlightThemeNova from "starlight-theme-nova";

export default defineConfig({
  redirects: {
    "/api/core/namespaces/arr": "/api/core/namespaces/arr/functions/chunksof",
    "/api/core/namespaces/rec": "/api/core/namespaces/rec/functions/entries",
  },
  integrations: [
    starlight({
      title: "pipelined",
      favicon: "favicon.svg",
      customCss: ["./src/styles/custom.css"],
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
              href: "/getting-started/installation",
            },
          ],
        }),
        starlightTypeDoc({
          entryPoints: [
            "../src/Core/index.ts",
            "../src/Types/index.ts",
            "../src/Composition/index.ts",
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
          label: "Getting Started",
          items: [
            { label: "Installation", slug: "getting-started/installation" },
            {
              label: "Thinking in pipelines",
              slug: "getting-started/pipelines",
            },
          ],
        },
        {
          label: "Guides",
          items: [
                        { label: "Composition utilities", slug: "guides/composition" },
            { label: "Option — absent values", slug: "guides/option" },
            { label: "Result — handling failures", slug: "guides/result" },
            {
              label: "Validation — collecting errors",
              slug: "guides/validation",
            },
            { label: "Deferred — infallible async values", slug: "guides/deferred" },
            { label: "Task — lazy async", slug: "guides/task" },
            {
              label: "RemoteData — loading states",
              slug: "guides/remote-data",
            },
            { label: "These — inclusive OR", slug: "guides/these" },
            { label: "Lens — nested updates", slug: "guides/lens" },
            { label: "Optional — nullable paths", slug: "guides/optional" },
            { label: "Reader — deferred dependencies", slug: "guides/reader" },
            { label: "Brand — distinguishing values", slug: "guides/brand" },
            { label: "Arr — array utilities", slug: "guides/arr" },
            { label: "Rec — record utilities", slug: "guides/rec" },

          ],
        },
        {
          label: "Appendix",
          items: [
            { label: "Why this exists", slug: "motivation" },
            { label: "Design & influences", slug: "appendix" },
          ],
        },
        typeDocSidebarGroup,
      ],
    }),
  ],
});
