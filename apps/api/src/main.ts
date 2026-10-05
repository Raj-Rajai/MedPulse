import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { JsonExpressAdapter } from './common/json-express.adapter';
import { apiPreRouteMiddleware } from './common/pre-route.middleware';
import { registerPortals, SPA_INDEX } from './portals/portals';

export async function createApp(): Promise<NestExpressApplication> {
    const server: Express = express();
    const app = await NestFactory.create<NestExpressApplication>(AppModule, new JsonExpressAdapter(server), {
        bodyParser: false,
        logger: ['error', 'warn'],
    });

    // Request body parsers (same as the original server.js)
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Portal page routes + shared/static assets
    registerPortals(server);

    // Field-location enforcement + /hospital/fap auth, before any API controller
    app.use('/api', apiPreRouteMiddleware(app));

    app.setGlobalPrefix('api');
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();

    // Express-level errors raised before a controller (e.g. malformed JSON bodies):
    // same as the original centralized errorHandler, then the SPA fallback.
    server.use((err: { status?: number; message?: string }, req: Request, res: Response, next: NextFunction) => {
        console.error('Unhandled server error:', err);
        if (req.originalUrl && req.originalUrl.startsWith('/api')) {
            return res.status(err.status || 500).json({ error: err.message || 'Internal server error', status: err.status || 500 });
        }
        next(err);
    });

    return app;
}

async function bootstrap() {
    const PORT = Number(process.env.PORT) || 3000;
    const app = await createApp();
    const server = app.getHttpServer();

    server.on('error', (err: any) => {
        if (err.code === 'ENOBUFS' || err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.code === 'ETIMEDOUT') {
            console.warn(`[Server] Handled transient network error: ${err.code}`);
            return;
        }
        console.error('[Server] Server error:', err);
    });

    await app.listen(PORT, '0.0.0.0');
    console.log(`====================================================`);
    console.log(`🏥 MedPulse Community Health Platform (NestJS + TypeScript)`);
    console.log(`🚀 Server running at: http://localhost:${PORT}`);
    console.log(`👨‍⚕️ Student Portal:    http://localhost:${PORT}/student/family-manage.html`);
    console.log(`👑 Admin Command:     http://localhost:${PORT}/admin/admin.html`);
    console.log(`🏥 Patient Portal:    http://localhost:${PORT}/patient/patient.html`);
    console.log(`🏨 Hospital Portal:   http://localhost:${PORT}/hospital/hospital.html`);
    console.log(`====================================================`);
}

if (require.main === module) {
    void bootstrap();
}

export { SPA_INDEX };
