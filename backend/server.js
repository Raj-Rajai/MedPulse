const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const { initDatabase } = require('./config/db');
const apiRoutes = require('./routes');
const { strictApi404, errorHandler } = require('./middleware/error.middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database schema and auto-seed initial data
initDatabase();

// Request body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Paths
const frontendShared = path.join(__dirname, '..', 'frontend', 'shared');
const legacyPublic = path.join(__dirname, '..', 'public');

// Portal page routes + static folders: one file per portal in backend/portals/
const portalDir = path.join(__dirname, 'portals');
fs.readdirSync(portalDir)
    .filter((f) => f.endsWith('.portal.js'))
    .sort()
    .forEach((f) => require(path.join(portalDir, f))(app));

// Public Auth Aliases
app.get('/login', (req, res) => res.redirect('/login.html'));
app.get('/register', (req, res) => res.redirect('/register.html'));

// Shared frontend assets (styles, scripts, icons, vendor, login, index)
app.use(express.static(frontendShared));

// Also serve legacy public directory for full fallback safety
app.use(express.static(legacyPublic));

// Mount modular API routes on /api
app.use('/api', apiRoutes);

// Strict 404 Handler for Unmatched API Endpoints (NEVER return HTML for API requests!)
app.use('/api', strictApi404);

// Centralized Express Error Handling Middleware for APIs
app.use(errorHandler);

// Fallback catch-all route for frontend Single Page Application navigation
app.use((req, res) => {
    res.sendFile(path.join(frontendShared, 'index.html'));
});

// Start server when executed directly
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`🏥 MedPulse Community Health Platform (MVC Architecture)`);
        console.log(`🚀 Server running at: http://localhost:${PORT}`);
        console.log(`👨‍⚕️ Student Portal:    http://localhost:${PORT}/student/family-manage.html`);
        console.log(`👑 Admin Command:     http://localhost:${PORT}/admin/admin.html`);
        console.log(`🏥 Patient Portal:    http://localhost:${PORT}/patient/patient.html`);
        console.log(`🏨 Hospital Portal:   http://localhost:${PORT}/hospital/hospital.html`);
        console.log(`====================================================`);
    });
}

module.exports = app;
