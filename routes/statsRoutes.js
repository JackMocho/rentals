const express = require('express');
const db = require('../config/db');
const router = express.Router();

router.get('/counts', async (req, res) => {
  try {
    // Count active users (approved and not suspended)
    const usersRes = await db.query("SELECT COUNT(*) FROM users WHERE approved = true AND (suspended = false OR suspended IS NULL)");
    // Count all rentals
    const rentalsRes = await db.query("SELECT COUNT(*) FROM rentals");
    // Count active listings (status = 'available')
    const activeRes = await db.query("SELECT COUNT(*) FROM rentals WHERE status = 'available'");

    res.json({
      totalUsers: parseInt(usersRes.rows[0].count, 10),
      totalRentals: parseInt(rentalsRes.rows[0].count, 10),
      activeRentals: parseInt(activeRes.rows[0].count, 10),
    });
  } catch (err) {
    console.error('Error fetching stats:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;