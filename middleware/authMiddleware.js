// backend/middleware/authMiddleware
const db = require('../config/db');
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../utils/jwtUtils');

// Auth middleware
function protect(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token, authorization denied' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token); // <-- JWT verify
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid' });
  }
}

// Admin check middleware
function isAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Not authorized as admin' });
}

// Optional: alternate admin check



// Do NOT define routes here! Only export middleware functions.
module.exports = {
  protect,
  isAdmin
};