const path = require('node:path');
const express = require('express');

// HOSPITAL portal: page routes + static files for frontend/hospital/
module.exports = (app) => {
    const dir = path.join(__dirname, '..', '..', 'frontend', 'hospital');
    app.get(['/hospital', '/hospital/'], (req, res) => res.sendFile(path.join(dir, 'hospital.html')));
    app.get(['/hospital/hospital.html', '/hospital.html'], (req, res) => res.sendFile(path.join(dir, 'hospital.html')));
    app.get('/hospital/login', (req, res) => res.redirect('/login.html?hospital=1'));
    app.use('/hospital', express.static(dir));
};
