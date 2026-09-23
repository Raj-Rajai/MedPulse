const path = require('node:path');
const express = require('express');

// ADMIN portal: page routes + static files for frontend/admin/
module.exports = (app) => {
    const dir = path.join(__dirname, '..', '..', 'frontend', 'admin');
    app.get(['/admin', '/admin/'], (req, res) => res.sendFile(path.join(dir, 'admin.html')));
    app.get(['/admin/admin.html', '/admin.html'], (req, res) => res.sendFile(path.join(dir, 'admin.html')));
    app.get('/admin/login', (req, res) => res.redirect('/login.html?admin=1'));
    app.use('/admin', express.static(dir));
};
