const express = require('express');
const path = require('node:path');
const { initDatabase } = require('./db');
const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database schema and seed data
initDatabase();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static assets
app.use(express.static(path.join(__dirname, '..', 'public')));

// Mount API routes
app.use('/api', apiRoutes);

// Strict 404 Handler for Unmatched API Endpoints (NEVER return HTML for API requests!)
app.use('/api', (req, res) => {
    res.status(404).json({
        error: `API endpoint not found: ${req.method} ${req.originalUrl}. If this is a newly added route, please restart the server.`,
        status: 404
    });
});

// Centralized Express Error Handling Middleware for APIs
app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err);
    if (req.originalUrl && req.originalUrl.startsWith('/api')) {
        return res.status(err.status || 500).json({
            error: err.message || 'Internal server error',
            status: err.status || 500
        });
    }
    next(err);
});

// Fallback catch-all route ONLY for frontend Single Page Application HTML navigation
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🏥 MedCollege Community Health Survey Platform`);
    console.log(`🚀 Server running at: http://localhost:${PORT}`);
    console.log(`📝 Data Entry Form:  http://localhost:${PORT}/entry.html`);
    console.log(`📊 Analytics Dashboard: http://localhost:${PORT}/analytics.html`);
    console.log(`====================================================`);
});
