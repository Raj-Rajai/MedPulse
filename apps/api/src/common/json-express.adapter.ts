import { ExpressAdapter } from '@nestjs/platform-express';
import type { Response } from 'express';
import { keepsPins, stripPins } from './strip-pins';

/**
 * The original API answered every handler with `res.json(value)`, including `null`,
 * plain strings and numbers. Nest's default adapter sends those as empty or text bodies,
 * so this adapter always goes through `res.json` to keep responses identical.
 */
export class JsonExpressAdapter extends ExpressAdapter {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reply(response: Response, body: any, statusCode?: number) {
        if (statusCode) response.status(statusCode);
        return response.json(keepsPins(response.req.path) ? body : stripPins(body));
    }
}
