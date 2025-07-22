// backend/config/db.js
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'mocho',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'housing',
  password: process.env.DB_PASSWORD || 'jackmocho',
  port: parseInt(process.env.DB_PORT) || 5432,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};