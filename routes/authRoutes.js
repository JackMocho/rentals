const express = require('express');
const db = require('../config/db'); // <-- use db, not { pool }
const { signToken } = require('../utils/jwtUtils'); // Use your existing util

const router = express.Router();

// Register User
router.post('/register', async (req, res) => {
  const {
    full_name,
    email,
    phone, // <-- Add this
    password,
    role = 'client',
    town,
    latitude,
    longitude
  } = req.body;

  if (!full_name || !phone || !password) { // <-- Require phone
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    let existingUser;
    if (email) {
      existingUser = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    } else {
      existingUser = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
    }

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    await db.query(
      `INSERT INTO users (full_name, email, phone, password, role, town, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [full_name, email, phone, password, role, town, latitude, longitude]
    );

    res.json({ message: 'Registration successful. Awaiting approval.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login using email OR phone
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Email/Phone and password are required' });
  }

  try {
    const field = identifier.includes('@') ? 'email' : 'phone';
    const result = await db.query(`SELECT * FROM users WHERE ${field} = $1`, [identifier]);
    const user = result.rows[0];

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Only allow login if approved is true
    if (!user.approved) {
      return res.status(403).json({ error: 'Your account is not approved yet.' });
    }

    // Optionally, still block suspended users if you want:
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Your account is suspended. Contact the administrator.' });
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      // ...any other fields you want in the token
    });
    res.json({ token, user: { ...user, password: undefined } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;