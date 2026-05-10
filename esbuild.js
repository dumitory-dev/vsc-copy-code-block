const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

/**
 * Copies the resvg WebAssembly binary into dist/ so the Node renderer can
 * load it at runtime via fs.readFileSync.
 * @type {import('esbuild').Plugin}
 */
const copyResvgWasmPlugin = {
	name: 'copy-resvg-wasm',
	setup(build) {
		build.onEnd(() => {
			const src = path.join(__dirname, 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm');
			const dest = path.join(__dirname, 'dist', 'resvg.wasm');
			fs.mkdirSync(path.dirname(dest), { recursive: true });
			fs.copyFileSync(src, dest);
		});
	},
};

async function main() {
	const ctx = await esbuild.context({
		entryPoints: [
			'src/extension.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [
			copyResvgWasmPlugin,
			/* add to the end of plugins array */
			esbuildProblemMatcherPlugin,
		],
	});
	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
