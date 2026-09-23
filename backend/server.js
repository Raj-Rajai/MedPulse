const express = require('express');
const path = require('node:path');
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
const frontendStudent = path.join(__dirname, '..', 'frontend', 'student');
const frontendAdmin = path.join(__dirname, '..', 'frontend', 'admin');
const frontendPatient = path.join(__dirname, '..', 'frontend', 'patient');
const frontendHospital = path.join(__dirname, '..', 'frontend', 'hospital');
const legacyPublic = path.join(__dirname, '..', 'public');

// Role folder root and direct page routes
app.get(['/patient', '/patient/'], (req, res) => res.sendFile(path.join(frontendPatient, 'patient.html')));
app.get(['/patient/patient.html', '/patient.html'], (req, res) => res.sendFile(path.join(frontendPatient, 'patient.html')));
app.get('/patient/login', (req, res) => res.redirect('/login.html?patient=1'));

app.get(['/hospital', '/hospital/'], (req, res) => res.sendFile(path.join(frontendHospital, 'hospital.html')));
app.get(['/hospital/hospital.html', '/hospital.html'], (req, res) => res.sendFile(path.join(frontendHospital, 'hospital.html')));
app.get('/hospital/login', (req, res) => res.redirect('/login.html?hospital=1'));

app.get(['/admin', '/admin/'], (req, res) => res.sendFile(path.join(frontendAdmin, 'admin.html')));
app.get(['/admin/admin.html', '/admin.html'], (req, res) => res.sendFile(path.join(frontendAdmin, 'admin.html')));
app.get('/admin/login', (req, res) => res.redirect('/login.html?admin=1'));

app.get(['/student', '/student/'], (req, res) => res.sendFile(path.join(frontendStudent, 'family-manage.html')));
app.get(['/student/family-manage.html', '/family-manage.html'], (req, res) => res.sendFile(path.join(frontendStudent, 'family-manage.html')));
app.get(['/student/entry.html', '/entry.html'], (req, res) => res.sendFile(path.join(frontendStudent, 'entry.html')));
app.get(['/student/analytics.html', '/analytics.html'], (req, res) => res.sendFile(path.join(frontendStudent, 'analytics.html')));
app.get(['/student/profile.html', '/profile.html'], (req, res) => res.sendFile(path.join(frontendStudent, 'profile.html')));
app.get('/student/login', (req, res) => res.redirect('/login.html'));

// Public Auth Aliases
app.get('/login', (req, res) => res.redirect('/login.html'));
app.get('/register', (req, res) => res.redirect('/register.html'));

// Role-based folder static endpoints
app.use('/student', express.static(frontendStudent));
app.use('/admin', express.static(frontendAdmin));
app.use('/patient', express.static(frontendPatient));
app.use('/hospital', express.static(frontendHospital));

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
