import { ArgumentsHost, Catch, ExceptionFilter, HttpException, NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import finalhandler from 'finalhandler';
import { HttpError } from './http-error';
import { SPA_INDEX } from '../portals/portals';

/**
 * Renders errors exactly like the original Express app:
 *  - HttpError          -> its own status + body
 *  - unmatched /api/*    -> strictApi404 body
 *  - unmatched pages     -> shared/index.html (SPA fallback)
 *  - anything else      -> centralized errorHandler body ({ error, status })
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse<Response>();
        const req = ctx.getRequest<Request>();

        if (res.headersSent) return;

        if (exception instanceof HttpError) {
            res.status(exception.status).json(exception.body);
            return;
        }

        if (exception instanceof NotFoundException && req.originalUrl.startsWith('/api')) {
            res.status(404).json({
                error: `API endpoint not found: ${req.method} ${req.originalUrl}. If this is a newly added route, please restart the server.`,
                status: 404,
            });
            return;
        }

        // Fallback catch-all for frontend Single Page Application navigation
        if (exception instanceof NotFoundException && !req.originalUrl.startsWith('/api')) {
            res.sendFile(SPA_INDEX);
            return;
        }

        const err = exception as { status?: number; message?: string };
        // Non-API errors (e.g. a missing page file): Express' default final handler, as before.
        if (!req.originalUrl.startsWith('/api') && !(exception instanceof HttpException)) {
            console.error('Unhandled server error:', exception);
            finalhandler(req, res, { env: process.env.NODE_ENV || 'development' })(exception);
            return;
        }
        console.error('Unhandled server error:', exception);
        const status = exception instanceof HttpException ? exception.getStatus() : err.status || 500;
        res.status(status).json({ error: err.message || 'Internal server error', status });
    }
}
