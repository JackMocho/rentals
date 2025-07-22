const express = require('express');
const db = require('../config/db');
const router = express.Router();

// Get all users
router.get('/', async (req, res) => {
  try {
    const users = await db.query('SELECT * FROM users ORDER BY created_at DESC');
    res.json(users.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT id, full_name, email, phone, role, status FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;