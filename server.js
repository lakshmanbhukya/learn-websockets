const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const dotenv = require("dotenv");
const cloudinary = require("cloudinary").v2;
const path = require("path");
const fs = require("fs");

dotenv.config();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// CORS middleware
app.use(cors());

// --- Socket.IO logic ---
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join_room", ({ username, room }) => {
    socket.join(room);
    console.log(`${username} joined room: ${room}`);
  });

  socket.on("send_message", (data) => {
    io.to(data.room).emit("receive_message", data);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// --- File upload route ---
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { room, username } = req.body;

    const stream = cloudinary.uploader.upload_stream(
      { resource_type: "auto" },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return res.status(500).json({ error });
        }

        // Emit file message to room
        io.to(room).emit("receive_message", {
          username,
          fileUrl: result.secure_url,
          fileName: req.file.originalname,
        });

        res.json({ url: result.secure_url });
      }
    );

    // Pipe buffer directly to Cloudinary
    stream.end(req.file.buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- Start server ---
const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
