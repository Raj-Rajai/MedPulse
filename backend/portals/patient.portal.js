const path = require('node:path');
const express = require('express');

// PATIENT portal: page routes + static files for frontend/patient/
module.exports = (app) => {
    const dir = path.join(__dirname, '..', '..', 'frontend', 'patient');
    app.get(['/patient', '/patient/'], (req, res) => res.sendFile(path.join(dir, 'patient.html')));
    app.get(['/patient/patient.html', '/patient.html'], (req, res) => res.sendFile(path.join(dir, 'patient.html')));
    app.get('/patient/login', (req, res) => res.redirect('/login.html?patient=1'));
    app.use('/patient', express.static(dir));
};
