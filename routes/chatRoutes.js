const express = require('express');
const db = require('../config/db');
const { logError } = require('../utils/logger');
const { verifyToken } = require('../utils/jwtUtils');
const router = express.Router();

// Send message (new or reply)
router.post('/send', async (req, res) => {
  const { sender_id, receiver_id, message, rental_id, parent_id } = req.body;
  if (!sender_id || !receiver_id || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    await db.query(
      `INSERT INTO messages (sender_id, receiver_id, message, rental_id, parent_id, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [sender_id, receiver_id, message, rental_id || null, parent_id || null]
    );
    res.json({ success: true });
  } catch (err) {
    logError(err, req); // <--- improved logging
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Reply to a message (for threaded replies)
router.post('/reply/:messageId', async (req, res) => {
  const { messageId } = req.params;
  const { sender_id, receiver_id, message, rental_id } = req.body;
  if (!sender_id || !receiver_id || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    await db.query(
      `INSERT INTO messages (sender_id, receiver_id, message, rental_id, parent_id, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [sender_id, receiver_id, message, rental_id || null, messageId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Reply message error:', err);
    logError(err, req);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

// Fetch messages for a rental (restrict access)
router.get('/messages/:rental_id', async (req, res) => {
  const { rental_id } = req.params;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  let userId, userRole;
  try {
    const decoded = verifyToken(token);
    userId = decoded.id;
    userRole = decoded.role;
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    // Get the rental to find the landlord
    const rentalRes = await db.query('SELECT user_id FROM rentals WHERE id = $1', [rental_id]);
    if (rentalRes.rows.length === 0) return res.status(404).json({ error: 'Rental not found' });
    const landlordId = rentalRes.rows[0].user_id;

    // Only allow landlord or a client who is a participant in the chat
    if (userId !== landlordId) {
      // Check if user is a participant (sender or receiver) in any message for this rental
      const msgRes = await db.query(
        'SELECT 1 FROM messages WHERE rental_id = $1 AND (sender_id = $2 OR receiver_id = $2) LIMIT 1',
        [rental_id, userId]
      );
      if (msgRes.rows.length === 0) {
        return res.status(403).json({ error: 'Forbidden: Not a participant in this chat' });
      }
    }

    // Return all messages for this rental
    const result = await db.query(
      'SELECT * FROM messages WHERE rental_id = $1 ORDER BY created_at ASC',
      [rental_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Fetch recent messages for a user (inbox)
router.get('/messages/recent/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await db.query(
      `
      SELECT DISTINCT ON (m.rental_id)
        m.*,
        u.full_name AS sender_name,
        u.email AS sender_email
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.sender_id = $1 OR m.receiver_id = $1
      ORDER BY m.rental_id, m.created_at DESC
      `,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inbox' });
  }
});

// Fetch all messages between admin and a user (not rental-specific)
router.get('/messages/admin/:adminId/:userId', async (req, res) => {
  const { adminId, userId } = req.params;
  try {
    const result = await db.query(
      `SELECT * FROM messages
       WHERE (sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at ASC`,
      [adminId, userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch admin-user messages' });
  }
});

module.exports = router;