import adapter from '@sveltejs/adapter-netlify';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Node-basierte Netlify Function (keine Edge Function): der MongoDB-Treiber benötigt Node-APIs.
			// Statische Dateien landen in «build» (siehe netlify.toml).
			adapter: adapter({ edge: false, split: false, publish: 'build' })
		})
	]
});
