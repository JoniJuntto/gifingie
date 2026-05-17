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
		rollupOptions: {
			input: {
				panel: "index.html",
			},
		},
	},
	plugins: [tailwindcss(), react()],
});
