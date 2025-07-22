const express = require('express');
const db = require('../config/db');
const { encrypt } = require('../utils/encryptData');
const { protect } = require('../middleware/authMiddleware');
const { verifyToken } = require('../utils/jwtUtils');

const router = express.Router();

// Submit new rental
router.post('/submit', async (req, res) => {
  const { title, description, price, nightly_price, type, mode, lat, lng, user_id, images, town } = req.body;
  if (!title || !type || !mode || !user_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (mode === 'lodging' && !nightly_price) {
    return res.status(400).json({ error: 'Nightly price required for lodging' });
  }
  if (mode === 'rental' && !price) {
    return res.status(400).json({ error: 'Monthly price required for rental' });
  }

  // Encrypt images if needed, or just store as is
  // const encryptedImages = images.map(img => encrypt(img));
  // For now, just store as JSON
  const imagesToStore = JSON.stringify(images);

  let locationSQL = 'NULL';
  let locationParams = [];
  if (lat && lng) {
    locationSQL = 'ST_SetSRID(ST_Point($9, $10), 4326)';
    locationParams = [lng, lat];
  }

  try {
    await db.query(
      `INSERT INTO rentals (title, description, price, nightly_price, type, mode, images, town, location, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_Point($9, $10), 4326), $11)`,
      [title, description, price, nightly_price, type, mode, JSON.stringify(images), town, lng, lat, user_id]
    );
    res.json({ message: 'Rental submitted successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit rental' });
  }
});

// Get all rentals (admin only)
router.get('/all', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.*, 
        CASE 
          WHEN r.location IS NOT NULL 
          THEN ST_AsGeoJSON(r.location)::json 
          ELSE NULL 
        END AS location_geojson,
        u.full_name AS landlord_name
      FROM rentals r
      JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC
    `);
    const rentals = result.rows.map(r => {
      if (r.location_geojson) {
        r.location = r.location_geojson;
        delete r.location_geojson;
      }
      return r;
    });
    res.json(rentals);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rentals' });
  }
});

// Get rentals for the logged-in user
router.get('/user', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  let userId;
  try {
    const decoded = verifyToken(token);
    userId = decoded.id;
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const result = await db.query(
      `SELECT * FROM rentals
       WHERE user_id = $1
         AND (status = 'available' OR status = 'booked')
         AND (mode = 'rental' OR mode = 'lodging' OR mode = 'airbnb')
       ORDER BY created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rentals' });
  }
});

// Get all rentals (public)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, 
        CASE 
          WHEN r.location IS NOT NULL 
          THEN ST_AsGeoJSON(r.location)::json 
          ELSE NULL 
        END AS location_geojson,
        u.full_name AS landlord_name
      FROM rentals r
      JOIN users u ON r.user_id = u.id
      WHERE r.status = 'available'
        AND u.role = 'landlord'
        AND u.approved = TRUE
        AND (r.mode = 'rental' OR r.mode = 'lodging' OR r.mode = 'airbnb')
      ORDER BY r.created_at DESC`
    );
    const rentals = result.rows.map(r => {
      if (r.location_geojson) {
        r.location = r.location_geojson;
        delete r.location_geojson;
      }
      return r;
    });
    res.json(rentals);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rentals' });
  }
});

// Nearby rentals
router.get('/nearby', async (req, res) => {
  const { lat, lng, distance } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng required' });
  }
  const dist = distance || 5; // default 5km
  try {
    const result = await db.query(
      `
      SELECT r.*, 
        CASE 
          WHEN r.location IS NOT NULL 
          THEN ST_AsGeoJSON(r.location)::json 
          ELSE NULL 
        END AS location_geojson,
        u.full_name AS landlord_name
      FROM rentals r
      JOIN users u ON r.user_id = u.id
      WHERE r.location IS NOT NULL
        AND r.status = 'available'
        AND u.role = 'landlord'
        AND u.approved = TRUE
        AND (r.mode = 'rental' OR r.mode = 'lodging' OR r.mode = 'airbnb')
        AND ST_DWithin(
          r.location::geography,
          ST_SetSRID(ST_Point($1, $2), 4326)::geography,
          $3 * 1000
        )
      ORDER BY r.created_at DESC
      `,
      [lng, lat, dist]
    );
    const rentals = result.rows.map(r => {
      if (r.location_geojson) {
        r.location = r.location_geojson;
        delete r.location_geojson;
      }
      return r;
    });
    res.json(rentals);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch nearby rentals' });
  }
});

// Rentals in a specified town
router.get('/town/:town', async (req, res) => {
  const { town } = req.params;
  try {
    const result = await db.query(
      `SELECT r.*, 
        CASE 
          WHEN r.location IS NOT NULL 
          THEN ST_AsGeoJSON(r.location)::json 
          ELSE NULL 
        END AS location_geojson,
        u.full_name AS landlord_name
      FROM rentals r
      JOIN users u ON r.user_id = u.id
      WHERE LOWER(r.town) = LOWER($1)
        AND r.status = 'available'
        AND u.role = 'landlord'
        AND u.approved = TRUE
        AND (r.mode = 'rental' OR r.mode = 'lodging' OR r.mode = 'airbnb')
      ORDER BY r.created_at DESC`,
      [town]
    );
    const rentals = result.rows.map(r => {
      if (r.location_geojson) {
        r.location = r.location_geojson;
        delete r.location_geojson;
      }
      return r;
    });
    res.json(rentals);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rentals by town' });
  }
});

// Calculate distance from rental to a given point (e.g., town, school, hospital)
router.get('/:id/distance', async (req, res) => {
  const { id } = req.params;
  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng required' });
  }
  try {
    const result = await db.query(
      `SELECT 
        ST_Distance(
          location::geography,
          ST_SetSRID(ST_Point($1, $2), 4326)::geography
        ) AS distance_meters
      FROM rentals WHERE id = $3`,
      [lng, lat, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rental not found' });
    }
    res.json({ distance_meters: result.rows[0].distance_meters });
  } catch (err) {
    res.status(500).json({ error: 'Failed to calculate distance' });
  }
});

// Edit rental
router.put('/:id', protect, async (req, res) => {
  const rentalId = req.params.id;
  const userId = req.user.id; // from token

  // Fetch rental from DB
  const rentalRes = await db.query('SELECT user_id FROM rentals WHERE id = $1', [rentalId]);
  if (rentalRes.rows.length === 0) return res.status(404).json({ error: 'Rental not found' });

  // Only allow if the landlord owns this rental
  if (rentalRes.rows[0].user_id !== userId) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  // ...proceed with update...
});

// Delete rental (only landlord/owner can delete)
router.delete('/:id', protect, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Check ownership
  const rentalRes = await db.query('SELECT user_id FROM rentals WHERE id = $1', [id]);
  if (rentalRes.rows.length === 0) return res.status(404).json({ error: 'Rental not found' });
  if (rentalRes.rows[0].user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

  await db.query('DELETE FROM rentals WHERE id = $1', [id]);
  res.json({ message: 'Rental deleted successfully' });
});

// GET route for fetching rental by id (must be last)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT *, 
        CASE 
          WHEN location IS NOT NULL 
          THEN ST_AsGeoJSON(location)::json 
          ELSE NULL 
        END AS location_geojson
      FROM rentals WHERE id = $1`, 
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rental not found' });
    }
    const rental = result.rows[0];
    // Prefer location_geojson if present
    if (rental.location_geojson) {
      rental.location = rental.location_geojson;
      delete rental.location_geojson;
    }
    res.json(rental);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rental' });
  }
});

// Create new rental (public)
router.post('/', async (req, res) => {
  const { title, description, price, type, images, town, location, user_id } = req.body;

  // Defensive: check location
  let lng = null, lat = null;
  if (
    location &&
    Array.isArray(location.coordinates) &&
    location.coordinates.length === 2 &&
    typeof location.coordinates[0] === 'number' &&
    typeof location.coordinates[1] === 'number' &&
    !isNaN(location.coordinates[0]) &&
    !isNaN(location.coordinates[1])
  ) {
    lng = location.coordinates[0];
    lat = location.coordinates[1];
  }

  const imagesArr = Array.isArray(images) ? images : (typeof images === 'string' ? images.split(',').map(s => s.trim()) : []);
  const imagesJson = JSON.stringify(imagesArr);

  try {
    await db.query(
      `INSERT INTO rentals (title, description, price, type, images, town, location, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_Point($7, $8), 4326), $9)`,
      [title, description, price, type, imagesJson, town, lng, lat, user_id]
    );
    res.json({ message: 'Rental created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create rental' });
  }
});

// Mark a rental as Booked
router.put('/:id/book', protect, async (req, res) => {
  const rentalId = req.params.id;
  try {
    await db.query('UPDATE rentals SET status = $1 WHERE id = $2', ['booked', rentalId]);
    res.json({ message: 'Rental marked as Booked' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update rental status' });
  }
});

// Mark a rental as available
router.put('/:id/available', protect, async (req, res) => {
  const rentalId = req.params.id;
  try {
    await db.query('UPDATE rentals SET status = $1 WHERE id = $2', ['available', rentalId]);
    res.json({ message: 'Rental marked as available' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update rental status' });
  }
});

// Get all rentals by approved landlords
router.get('/rentals', async (req, res) => {
  try {
    const rentals = await db.query(`
      SELECT r.*, u.full_name AS landlord_name
      FROM rentals r
      JOIN users u ON r.user_id = u.id
      WHERE u.role = 'landlord' AND u.approved = TRUE AND u.status = 'approved'
      ORDER BY r.created_at DESC
    `);
    res.json(rentals.rows);
  } catch (err) {
    console.error(err); // This will show the real error in your backend console!
    res.status(500).json({ error: 'Failed to fetch rentals.' });
  }
});

module.exports = router;