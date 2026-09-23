const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const router = express.Router();

// Auto-mount every *.routes.js file in this folder.
// Adding a new module (CRM or HMS) never requires editing this file.
fs.readdirSync(__dirname)
    .filter((f) => f.endsWith('.routes.js'))
    .sort()
    .forEach((f) => router.use(require(path.join(__dirname, f))));

module.exports = router;
