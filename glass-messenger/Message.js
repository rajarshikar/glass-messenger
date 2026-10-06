const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  senderDeviceId: { type: String, required: true, index: true },
  recipientDeviceId: { type: String, required: true, index: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, expires: "3d" } // Auto-deletes after 3 days
});

module.exports = mongoose.model("Message", messageSchema);