const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const Message = require('./Message');

const app = express();
const server = http.createServer(app);

// Force Socket.io to use WebSocket transport directly for lower latency
const io = new Server(server, {
  transports: ['websocket']
});

// MongoDB Atlas connection string
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://onioncom243_db_user:wYTCiXmReoVtndEU@cluster1.vlxvuxl.mongodb.net/glass_chat?appName=Cluster1";
// Connect to MongoDB with pooled options
mongoose.connect(MONGO_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => console.log('MongoDB connected with 3-day TTL'))
.catch(err => console.error('MongoDB connection error:', err));

app.use(express.static('public'));

// -------------------------------------------------------------
// REAL-TIME ACTIVE DEVICE TRACKING
// Maps deviceId -> current socket.id
// -------------------------------------------------------------
const activeDevices = new Map();

io.on('connection', (socket) => {

  // 1. Register device on connection/refresh and calculate online status
  socket.on('register-device', ({ deviceId, pairedDeviceId }) => {
    socket.deviceId = deviceId;
    activeDevices.set(deviceId, socket.id);

    // Check if the paired device is currently in our active Map
    const isPairedOnline = pairedDeviceId && activeDevices.has(pairedDeviceId);

    // Tell the device that just connected its pair's status
    socket.emit('status-update', { online: isPairedOnline });

    // Tell the paired device that its partner is now online
    if (isPairedOnline) {
      const pairedSocketId = activeDevices.get(pairedDeviceId);
      io.to(pairedSocketId).emit('status-update', { online: true });
    }
  });

  // 2. Handle sending and broadcasting chat messages
  socket.on('send-message', async (data) => {
    try {
      const newMessage = new Message(data);
      await newMessage.save();

      io.emit('receive-message', newMessage);
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  // 3. Handle device disconnect (closing browser or refreshing)
  socket.on('disconnect', () => {
    if (socket.deviceId) {
      activeDevices.delete(socket.deviceId);
      
      // Notify all other sockets that this device went offline
      socket.broadcast.emit('device-disconnected', { deviceId: socket.deviceId });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});