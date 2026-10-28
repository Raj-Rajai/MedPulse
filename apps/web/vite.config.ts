import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { existsSync, readdirSync, statSync } from 'node:fs';
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

/** Match the page aliases and shared public files served by the API in production. */
function portalDevRoutes(): Plugin {
    const aliases: Record<string, string> = {
        '/login.html': '/shared/login.html',
        '/register.html': '/shared/register.html',
        '/index.html': '/student/index.html',
        '/admin.html': '/admin/admin.html',
        '/hospital.html': '/hospital/hospital.html',
        '/patient.html': '/patient/patient.html',
    };
    for (const page of ['family-manage', 'entry', 'analytics', 'exams', 'profile', 'schedule']) {
        aliases[`/${page}.html`] = `/student/${page}.html`;
    }
    for (const [portal, page] of Object.entries({ admin: 'admin', hospital: 'hospital', patient: 'patient', student: 'profile' })) {
        aliases[`/${portal}`] = aliases[`/${portal}/`] = `/${portal}/${page}.html`;
    }
    const redirects: Record<string, string> = {
        '/': '/profile.html',
        '/login': '/login.html',
        '/register': '/register.html',
        '/student/login': '/login.html',
        '/admin/login': '/login.html?admin=1',
        '/hospital/login': '/login.html?hospital=1',
        '/patient/login': '/login.html?patient=1',
        '/attendance': '/profile.html',
        '/attendance.html': '/profile.html',
        '/student/attendance.html': '/profile.html',
    };
    const sharedPublic = resolve(__dirname, 'public/shared');
    return {
        name: 'portal-dev-routes',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const url = new URL(req.url || '/', 'http://localhost');
                const redirect = redirects[url.pathname];
                if (redirect) {
                    res.writeHead(302, { Location: redirect + (redirect.includes('?') ? (url.search ? '&' + url.search.slice(1) : '') : url.search) });
                    res.end();
                    return;
                }
                if (aliases[url.pathname]) {
                    req.url = aliases[url.pathname] + url.search;
                } else {
                    const publicFile = resolve(sharedPublic, '.' + url.pathname);
                    if (publicFile.startsWith(sharedPublic + '/') || publicFile.startsWith(sharedPublic + '\\')) {
                        if (existsSync(publicFile) && statSync(publicFile).isFile()) {
                            req.url = '/shared' + url.pathname + url.search;
                        }
                    }
                }
                next();
            });
        },
    };
}

export default defineConfig({
    root: pagesDir,
    publicDir: resolve(__dirname, 'public'),
    plugins: [portalDevRoutes(), react()],
    resolve: {
        alias: { '/src': resolve(__dirname, 'src') },
    },
    build: {
        outDir: resolve(__dirname, 'dist'),
        emptyOutDir: true,
        // The student portal bundle is ~560 kB (163 kB gzipped); raise the 500 kB warning threshold.
        chunkSizeWarningLimit: 700,
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
        // Preserve the browser-facing host so the API can verify same-origin writes.
        proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false } },
    },
});
