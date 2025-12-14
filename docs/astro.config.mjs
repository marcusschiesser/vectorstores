// @ts-check

import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import { defineConfig, passthroughImageService } from "astro/config";
import AutoImport from "astro-auto-import";
import path from "path";
import starlightAutoSidebar from "starlight-auto-sidebar";
import remarkInclude from "./src/plugins/remark-include.mjs";
import remarkPackageInstall from "./src/plugins/remark-package-install.mjs";

// https://astro.build/config
export default defineConfig({
	site: "https://vectorstores.org",
	base: "/",
	outDir: path.resolve("../dist/"),
	markdown: {
		remarkPlugins: [remarkInclude, remarkPackageInstall],
	},
	integrations: [
		AutoImport({
			imports: [
				{
					"@astrojs/starlight/components": [
						"Card",
						"CardGrid",
						"LinkCard",
						"Icon",
						"Tabs",
						"TabItem",
						"Aside",
					],
				},
			],
		}),
		starlight({
			plugins: [starlightAutoSidebar()],
			title: "vectorstores Documentation",
			head: [
				{
					tag: "script",
					content: `
						document.addEventListener("DOMContentLoaded", function () {
							var script = document.createElement("script");
							script.type = "module";
							script.id = "runllm-widget-script"
							script.src = "https://widget.runllm.com";
							script.setAttribute("version", "stable");
							script.setAttribute("crossorigin", "true");
							script.setAttribute("runllm-keyboard-shortcut", "Mod+j");
							script.setAttribute("runllm-name", "vectorstores");
							script.setAttribute("runllm-position", "BOTTOM_RIGHT");
							script.setAttribute("runllm-assistant-id", "1604");
							script.setAttribute("runllm-disable-ask-a-person", true);
							script.async = true;
							document.head.appendChild(script);
						});
					`,
				},
			],
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: "https://github.com/marcusschiesser/vectorstores",
				},
			],
			logo: {
				light: "./src/assets/vectorstores-dark.svg",
				dark: "./src/assets/vectorstores-light.svg",
				replacesTitle: true,
			},
			favicon: "/logo-dark.png",
			components: {
				SiteTitle: "./src/components/SiteTitle.astro",
				Header: "./src/components/Header.astro",
			},
			sidebar: [
				{
					slug: "index",
				},
				{
					label: "Getting Started",
					autogenerate: { directory: "getting_started", collapsed: true },
				},
				{
					label: "Integration",
					autogenerate: { directory: "integration", collapsed: true },
				},
			
				{
					label: "Modules",
					autogenerate: { directory: "modules", collapsed: true },
				},
				{
					label: "Migration",
					autogenerate: { directory: "migration", collapsed: true },
				},
				{
					label: "API Reference",
					autogenerate: { directory: "api", collapsed: true },
				},
				{
					slug: "more",
				},
			],
		}),
		mdx(),
		react(),
	],
	image: {
		service: passthroughImageService(),
	},
});
