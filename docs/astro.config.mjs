// @ts-check

import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import { defineConfig, passthroughImageService } from "astro/config";
import AutoImport from "astro-auto-import";
import path from "path";
import starlightAutoSidebar from "starlight-auto-sidebar";
import remarkPackageInstall from "./src/plugins/remark-package-install.mjs";

// https://astro.build/config
export default defineConfig({
	site: "https://vectorstores.dev",
	base: "/",
	outDir: path.resolve("../dist/"),
	markdown: {
		remarkPlugins: [remarkPackageInstall],
	},
	integrations: [
		starlight({
			plugins: [starlightAutoSidebar()],
			title: "vectorstores Documentation",
			head: [
				{
					tag: "script",
					content: `
					(function (w, d, s, l, i) {
					  w[l] = w[l] || [];
					  w[l].push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
					  var f = d.getElementsByTagName(s)[0],
						j = d.createElement(s),
						dl = l != "dataLayer" ? "&l=" + l : "";
					  j.async = true;
					  j.src = "https://www.googletagmanager.com/gtm.js?id=" + i + dl;
					  f.parentNode.insertBefore(j, f);
					})(window, document, "script", "dataLayer", "GTM-WWRFB36R");
				  `,
				},
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
							script.setAttribute("runllm-assistant-id", "1450");
							script.setAttribute("runllm-disable-ask-a-person", true);
							script.setAttribute(
								"runllm-slack-community-url",
								"https://discord.com/invite/eN6D2HQ4aX"
							);
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
					label: "Framework",
					autogenerate: { directory: ".", collapsed: true },
				},
			],
		}),
		AutoImport({
			imports: [
				{
					"@icons-pack/react-simple-icons": [
						"SiBun",
						"SiCloudflareworkers",
						"SiDeno",
						"SiNodedotjs",
						"SiTypescript",
						"SiVite",
						"SiNextdotjs",
						"SiDiscord",
						"SiGithub",
						"SiNpm",
						"SiX",
					],
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
		react(),
	],
	image: {
		service: passthroughImageService(),
	},
});
