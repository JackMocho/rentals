const WebSocket = require('ws');
const { pool } = require('./config/db');

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'SEND_MESSAGE') {
          // Save to DB
          await pool.query(
            `INSERT INTO messages (sender_id, receiver_id, rental_id, message)
             VALUES ($1, $2, $3, $4)`,
            [data.sender_id, data.receiver_id, data.rental_id, data.message]
          );

          // Broadcast to receiver
          wss.clients.forEach((client) => {
            if (client.id === data.receiver_id && client.readyState === WebSocket.OPEN) {
              client.send(message);
            }
          });
        }
      } catch (err) {
        console.error('Message failed:', err.message);
      }
    });
  });
}

module.exports = setupWebSocket;