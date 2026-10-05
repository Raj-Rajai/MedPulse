import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * Multi-page build. Every HTML file under pages/ becomes a page at the same URL path it had
 * in the original frontend/ folder (pages/hospital/hospital.html -> dist/hospital/hospital.html),
 * so the NestJS portal routes serve the React build unchanged (MEDPULSE_FRONTEND_DIR=apps/web/dist).
 * Shared pages and their assets live in dist/shared, which the server mounts at "/".
 */
const pagesDir = resolve(__dirname, 'pages');
const inputs: Record<string, string> = {};
for (const dir of readdirSync(pagesDir)) {
    const full = resolve(pagesDir, dir);
    if (!statSync(full).isDirectory()) continue;
    for (const f of readdirSync(full)) if (f.endsWith('.html')) inputs[`${dir}/${f.replace(/\.html$/, '')}`] = resolve(full, f);
}

export default defineConfig({
    root: pagesDir,
    publicDir: resolve(__dirname, 'public'),
    plugins: [react()],
    build: {
        outDir: resolve(__dirname, 'dist'),
        emptyOutDir: true,
        assetsDir: 'shared/assets',
        rollupOptions: { input: inputs },
    },
    // Bundles are written to dist/shared/assets but served from /assets (dist/shared is the site root).
    experimental: {
        renderBuiltUrl(filename) {
            return '/' + filename.replace(/^shared\//, '');
        },
    },
    server: {
        host: true,
        port: 5173,
        proxy: { '/api': 'http://localhost:3000' },
    },
});
