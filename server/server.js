const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for now, restrict in production
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Middleware
app.use(cors());
app.use(express.json());

// Load Data
let data = { geofences: [], users: {} };
if (fs.existsSync(DATA_FILE)) {
    try {
        const fileData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        // Only load geofences from file, not users (users should only be active connections)
        if (fileData.geofences) data.geofences = fileData.geofences;
    } catch (err) {
        console.error("Error reading data file:", err);
    }
}

const saveData = () => {
    // Only save geofences, not users (users are temporary/session data)
    fs.writeFileSync(DATA_FILE, JSON.stringify({ geofences: data.geofences }, null, 2));
};

// Gemini API Setup
// Note: In a real app, use an environment variable. 
// For this prototype, we'll use the provided key if not in env, but better to put in .env
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyDVKnE_sS8ZVJptG2mjBl-08ZDDje-qDr8";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Routes

// Get all geofences
app.get('/api/geofences', (req, res) => {
    res.json(data.geofences);
});

// Create geofence
app.post('/api/geofences', (req, res) => {
    const newGeofence = {
        id: Date.now().toString(),
        ...req.body
    };
    data.geofences.push(newGeofence);
    saveData();
    io.emit('geofence-update', data.geofences);
    res.status(201).json(newGeofence);
});

// Delete geofence
// Delete geofence
app.delete('/api/geofences/:id', (req, res) => {
    console.log("Deleting geofence with ID:", req.params.id);
    const initialLength = data.geofences.length;
    data.geofences = data.geofences.filter(g => g.id !== req.params.id);
    console.log(`Deleted ${initialLength - data.geofences.length} items. Remaining: ${data.geofences.length}`);
    saveData();
    io.emit('geofence-update', data.geofences);
    res.json({ success: true });
});

// AI Safety Prediction
app.post('/api/predict-safety', async (req, res) => {
    const { location, context } = req.body;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `
      Analyze the safety of a tourist at these coordinates: ${JSON.stringify(location)}.
      Context: ${context || "General tourist activity"}.
      Nearby Geofences: ${JSON.stringify(data.geofences)}.
      
      Provide a safety assessment (Safe, Caution, Danger) and a short advice message.
      Format response as JSON: { "status": "Safe" | "Caution" | "Danger", "message": "..." }
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Attempt to parse JSON from the response (Gemini might return markdown code blocks)
        let jsonResponse;
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonResponse = JSON.parse(jsonMatch[0]);
            } else {
                jsonResponse = { status: "Unknown", message: text };
            }
        } catch (e) {
            jsonResponse = { status: "Unknown", message: text };
        }

        res.json(jsonResponse);
    } catch (error) {
        console.error("Gemini API Error:", error);
        res.status(500).json({ error: "Failed to predict safety" });
    }
});

// Socket.io Logic
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('register-user', (userData) => {
        data.users[socket.id] = {
            id: socket.id,
            ...userData,
            lastSeen: new Date()
        };
        io.emit('users-update', Object.values(data.users));
    });

    socket.on('location-update', (location) => {
        if (!data.users[socket.id]) {
            // Implicit registration if missing (e.g. after server restart)
            data.users[socket.id] = {
                id: socket.id,
                name: "Reconnect User",
                phone: "",
                type: "tourist",
                lastSeen: new Date()
            };
        }

        data.users[socket.id].location = location;
        data.users[socket.id].lastSeen = new Date();
        io.emit('users-update', Object.values(data.users));

        // Check geofences
        checkGeofences(socket.id, location);
    });

    socket.on('sos-alert', (alertData) => {
        console.log("SOS Alert:", alertData);
        io.emit('admin-alert', {
            userId: socket.id,
            user: data.users[socket.id],
            ...alertData,
            timestamp: new Date()
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete data.users[socket.id];
        io.emit('users-update', Object.values(data.users));
    });
});

function checkGeofences(userId, location) {
    // Simple point-in-polygon check or distance check could go here
    // For now, we'll let the frontend do the heavy lifting of checking, 
    // or implement a simple server-side check if needed.
    // But the requirement says "if any user enters into danger zone, the admin get alerted"
    // We can do this on the client (User App) and send an event, or here.
    // Doing it here is more secure.

    // Let's assume geofences are circles for simplicity in this prototype, or polygons.
    // If polygons, we need a library like 'turf' or 'point-in-polygon'.
    // For this MVP, we will rely on the client to report "Entered Zone" events 
    // OR implement a simple distance check if they are circular.
    // The plan said "Draw zones", implying polygons.
    // I'll add a 'check-zone' event that the client can emit, OR just trust the client for now 
    // to keep server simple without heavy geo libraries.
}

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
