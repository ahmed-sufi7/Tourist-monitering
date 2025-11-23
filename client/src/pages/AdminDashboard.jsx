import React, { useState, useEffect } from 'react';
import Map from '../components/Map';
import { socket } from '../services/socket';
import { Marker, Popup, Polygon } from 'react-leaflet';
import { AlertTriangle, Shield, Map as MapIcon, Users } from 'lucide-react';

const AdminDashboard = () => {
    const [geofences, setGeofences] = useState([]);
    const [users, setUsers] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [newGeofencePoints, setNewGeofencePoints] = useState([]);

    useEffect(() => {
        // Initial fetch
        fetch('http://localhost:3000/api/geofences')
            .then(res => res.json())
            .then(data => setGeofences(data));

        // Socket listeners
        socket.on('geofence-update', (data) => setGeofences(data));
        socket.on('users-update', (data) => setUsers(data));
        socket.on('admin-alert', (alert) => {
            setAlerts(prev => [alert, ...prev]);
            // Play sound or notification here
            alert("SOS Alert received!");
        });

        return () => {
            socket.off('geofence-update');
            socket.off('users-update');
            socket.off('admin-alert');
        };
    }, []);

    const handleMapClick = (e) => {
        if (isDrawing) {
            setNewGeofencePoints([...newGeofencePoints, [e.latlng.lat, e.latlng.lng]]);
        }
    };

    const saveGeofence = async () => {
        if (newGeofencePoints.length < 3) return alert("Need at least 3 points");
        const name = prompt("Enter Geofence Name (e.g., Danger Zone 1):");
        const type = confirm("Is this a Danger Zone? (Cancel for Safe Zone)") ? "danger" : "safe";

        await fetch('http://localhost:3000/api/geofences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                type,
                points: newGeofencePoints
            })
        });

        setNewGeofencePoints([]);
        setIsDrawing(false);
    };

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            <div className="w-80 bg-white shadow-lg flex flex-col z-10">
                <div className="p-4 border-b bg-blue-600 text-white">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Shield size={24} /> Admin Monitor
                    </h1>
                </div>

                <div className="p-4 flex-1 overflow-y-auto">
                    {/* Alerts Section */}
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-red-600">
                            <AlertTriangle size={20} /> Active Alerts
                        </h2>
                        {alerts.length === 0 && <p className="text-gray-500 text-sm">No active alerts</p>}
                        {alerts.map((alert, idx) => (
                            <div key={idx} className="bg-red-50 border-l-4 border-red-500 p-3 mb-2 text-sm">
                                <p className="font-bold">SOS from User</p>
                                <p>ID: {alert.userId.slice(0, 5)}...</p>
                                <p className="text-xs text-gray-500">{new Date(alert.timestamp).toLocaleTimeString()}</p>
                            </div>
                        ))}
                    </div>

                    {/* Users Section */}
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-blue-600">
                            <Users size={20} /> Active Users ({users.length})
                        </h2>
                        {users.map(user => (
                            <div key={user.id} className="bg-gray-50 p-2 rounded mb-1 text-sm flex justify-between">
                                <span>User {user.id.slice(0, 5)}...</span>
                                <span className="text-xs text-gray-500">
                                    {user.location ? "Online" : "No Loc"}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Controls */}
                    <div>
                        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-green-600">
                            <MapIcon size={20} /> Geofencing
                        </h2>
                        {!isDrawing ? (
                            <button
                                onClick={() => setIsDrawing(true)}
                                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
                            >
                                Create New Zone
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button
                                    onClick={saveGeofence}
                                    className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => { setIsDrawing(false); setNewGeofencePoints([]); }}
                                    className="flex-1 bg-gray-500 text-white py-2 rounded hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                        {isDrawing && (
                            <p className="text-xs text-gray-500 mt-2">Click on map to add points.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Map Area */}
            <div className="flex-1 relative">
                <Map onClick={handleMapClick}>
                    {/* Render Geofences */}
                    {geofences.map(geo => (
                        <Polygon
                            key={geo.id}
                            positions={geo.points}
                            pathOptions={{
                                color: geo.type === 'danger' ? 'red' : 'green',
                                fillColor: geo.type === 'danger' ? '#fca5a5' : '#86efac',
                                fillOpacity: 0.4
                            }}
                        >
                            <Popup>{geo.name} ({geo.type})</Popup>
                        </Polygon>
                    ))}

                    {/* Render Drawing Polygon */}
                    {newGeofencePoints.length > 0 && (
                        <Polygon
                            positions={newGeofencePoints}
                            pathOptions={{ color: 'blue', dashArray: '5, 5' }}
                        />
                    )}

                    {/* Render Users */}
                    {users.map(user => user.location && (
                        <Marker key={user.id} position={[user.location.lat, user.location.lng]}>
                            <Popup>
                                User: {user.id.slice(0, 5)}... <br />
                                Last Seen: {new Date(user.lastSeen).toLocaleTimeString()}
                            </Popup>
                        </Marker>
                    ))}
                </Map>
            </div>
        </div>
    );
};

export default AdminDashboard;
