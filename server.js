const express = require('express');
const http = require('http');
const cors = require('cors');
const { Pool } = require('pg');
const chatRoutes = require('./routes/chatRoutes'); // <-- Add this line
const app = express();
const server = http.createServer(app);

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false } // Required for Supabase
});

app.use(cors());
// Increase the JSON body size limit to 10mb
app.use(express.json({ limit: '10mb' }));
app.use('/api/chat', chatRoutes);

// Mount routes
const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);
const statsRoutes = require('./routes/statsRoutes');
app.use('/api/stats', statsRoutes);
const rentalRoutes = require('./routes/rentalRoutes');
app.use('/api/rentals', rentalRoutes);
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

// Setup WebSockets
const setupWebSocket = require('./websocket');
setupWebSocket(server); // ✅ Now this works

const PORT = process.env.PORT || 3000;
server.listen(PORT,'0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});