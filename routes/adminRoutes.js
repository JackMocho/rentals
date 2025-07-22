const express = require('express');
const db = require('../config/db');
const { protect, isAdmin } = require('../middleware/authMiddleware');
const router = express.Router();

// 1. User Management
router.get('/users', async (req, res) => {
  try {
    const users = await db.query('SELECT * FROM users ORDER BY created_at DESC');
    res.json(users.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});
router.patch('/users/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  try {
    const result = await db.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, full_name, email, role',
      [role, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user role.' });
  }
});
router.patch('/users/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const result = await db.query(
      'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, full_name, email, status',
      [status, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user status.' });
  }
});
router.patch('/users/:id/approved', async (req, res) => {
  const { id } = req.params;
  const { approved } = req.body;
  try {
    const result = await db.query(
      'UPDATE users SET approved = $1 WHERE id = $2 RETURNING id, full_name, email, approved',
      [approved, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user approval.' });
  }
});
// Suspend user and set approved to false
router.put('/user/:id/suspend', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('UPDATE users SET suspended = true, approved = false WHERE id = $1', [id]);
    res.json({ message: 'User suspended and moved to pending' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to suspend user' });
  }
});
router.delete('/user/:id', async (req, res) => {
  const { id } = req.params;
  const userRes = await db.query('SELECT superuser FROM users WHERE id = $1', [id]);
  if (userRes.rows.length && userRes.rows[0].superuser) {
    return res.status(403).json({ error: ' Stop it! You can never Delete this Special User.' });
  }
  await db.query('DELETE FROM users WHERE id = $1', [id]);
  res.json({ message: 'User deleted' });
});
router.get('/active-users', async (req, res) => {
  const users = await db.query('SELECT * FROM users WHERE approved = true AND suspended = false');
  res.json(users.rows);
});

// Get all pending users (not approved, not suspended)
router.get('/pending-users', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM users WHERE approved = false AND (suspended = false OR suspended IS NULL) ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending users' });
  }
});

// Approve a user (admin action)
router.put('/approve-user/:id', protect, isAdmin, async (req, res) => {
  const userId = req.params.id;
  try {
    await db.query('UPDATE users SET approved = true, suspended = false WHERE id = $1', [userId]);
    res.json({ message: 'User approved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

// 2. Rental Management
router.get('/rentals', async (req, res) => {
  const rentals = await db.query(`
    SELECT r.*
    FROM rentals r
    JOIN users u ON r.landlord_id = u.id
    WHERE u.status = 'approved'
    ORDER BY r.created_at DESC
  `);
  res.json(rentals.rows);
});

router.put('/rental/:id/approve', async (req, res) => {
  const { id } = req.params;
  await db.query('UPDATE rentals SET approved = true WHERE id = $1', [id]);
  res.json({ message: 'Rental approved' });
});
// Admin: Delete any rental
router.delete('/rental/:id', protect, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM rentals WHERE id = $1', [id]);
    res.json({ message: 'Rental deleted by admin' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete rental' });
  }
});

// 3. Analytics (example: counts)
router.get('/stats', async (req, res) => {
  const users = await db.query('SELECT COUNT(*) FROM users');
  const rentals = await db.query('SELECT COUNT(*) FROM rentals');
  const activeRentals = await db.query('SELECT COUNT(*) FROM rentals WHERE status = $1', ['available']);
  res.json({
    totalUsers: users.rows[0].count,
    totalRentals: rentals.rows[0].count,
    activeRentals: activeRentals.rows[0].count,
  });
});

// 4. Moderation: Reported messages/rentals
router.get('/reports', async (req, res) => {
  const reports = await db.query('SELECT * FROM reports ORDER BY created_at DESC');
  res.json(reports.rows);
});

// 5. Announcements
router.post('/announcement', async (req, res) => {
  const { message, target } = req.body;
  // Save to DB or broadcast via websocket
  res.json({ message: 'Announcement sent' });
});

// 6. Audit Logs (example)
router.get('/audit', async (req, res) => {
  const logs = await db.query('SELECT * FROM audit_logs ORDER BY created_at DESC');
  res.json(logs.rows);
});

module.exports = router;