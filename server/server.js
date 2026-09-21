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

// Fallback catch-all route
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
