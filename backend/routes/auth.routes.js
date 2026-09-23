const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/auth.controller');

router.post('/auth/register', AuthController.register);
router.post('/auth/login', AuthController.login);
router.get('/auth/me', AuthController.me);

module.exports = router;
