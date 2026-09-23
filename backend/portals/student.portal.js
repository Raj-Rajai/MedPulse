const path = require('node:path');
const express = require('express');

// STUDENT portal: page routes + static files for frontend/student/
module.exports = (app) => {
    const dir = path.join(__dirname, '..', '..', 'frontend', 'student');
    app.get(['/student', '/student/'], (req, res) => res.sendFile(path.join(dir, 'family-manage.html')));
    app.get(['/student/family-manage.html', '/family-manage.html'], (req, res) => res.sendFile(path.join(dir, 'family-manage.html')));
    app.get(['/student/entry.html', '/entry.html'], (req, res) => res.sendFile(path.join(dir, 'entry.html')));
    app.get(['/student/analytics.html', '/analytics.html'], (req, res) => res.sendFile(path.join(dir, 'analytics.html')));
    app.get(['/student/profile.html', '/profile.html'], (req, res) => res.sendFile(path.join(dir, 'profile.html')));
    app.get('/student/login', (req, res) => res.redirect('/login.html'));
    app.use('/student', express.static(dir));
};
