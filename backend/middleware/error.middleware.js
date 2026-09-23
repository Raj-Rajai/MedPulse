/**
 * Strict 404 Handler for Unmatched API Endpoints
 * (NEVER return HTML for API requests!)
 */
function strictApi404(req, res) {
    res.status(404).json({
        error: `API endpoint not found: ${req.method} ${req.originalUrl}. If this is a newly added route, please restart the server.`,
        status: 404
    });
}

/**
 * Centralized Express Error Handling Middleware for APIs
 */
function errorHandler(err, req, res, next) {
    console.error('Unhandled server error:', err);
    if (req.originalUrl && req.originalUrl.startsWith('/api')) {
        return res.status(err.status || 500).json({
            error: err.message || 'Internal server error',
            status: err.status || 500
        });
    }
    next(err);
}

module.exports = {
    strictApi404,
    errorHandler
};
