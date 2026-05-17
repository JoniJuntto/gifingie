import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	server: {
		port: 8080,
		https: false,
	},
	build: {
		outDir: "dist",
		cssCodeSplit: false,
		rollupOptions: {
			input: "src/main.tsx",
			output: {
				format: "iife",
				entryFileNames: "panel.js",
				assetFileNames: "panel[extname]",
			},
		},
	},
	plugins: [tailwindcss(), react()],
});
