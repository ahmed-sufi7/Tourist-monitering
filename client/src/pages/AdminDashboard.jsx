import React, { useState, useEffect } from 'react';
import Map from '../components/Map';
import { socket } from '../services/socket';
import { Marker, Popup, Polygon, CircleMarker } from 'react-leaflet';
import { AlertTriangle, Shield, Map as MapIcon, Users, Search } from 'lucide-react';

// Ray-casting algorithm for point in polygon
const isPointInPolygon = (point, vs) => {
    // point = [lat, lng], vs = [[lat, lng], ...]
    const x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i][0], yi = vs[i][1];
        const xj = vs[j][0], yj = vs[j][1];
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

const AdminDashboard = () => {
    const [geofences, setGeofences] = useState([]);
    const [users, setUsers] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [newGeofencePoints, setNewGeofencePoints] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [mapCenter, setMapCenter] = useState(null);
    const [mapZoom, setMapZoom] = useState(13);
    const [showModal, setShowModal] = useState(false);
    const [manualCoords, setManualCoords] = useState("");
    const [zoneName, setZoneName] = useState("");
    const [zoneType, setZoneType] = useState("safe");

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

    const openSaveModal = () => {
        if (newGeofencePoints.length < 3) return alert("Need at least 3 points");
        setManualCoords(newGeofencePoints.map(p => `${p[0]}, ${p[1]}`).join('\n'));
        setShowModal(true);
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.length > 2) {
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
                    const data = await res.json();
                    setSuggestions(data);
                } catch (err) {
                    console.error("Search error:", err);
                }
            } else {
                setSuggestions([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleSelectLocation = (lat, lon, displayName) => {
        setMapCenter([parseFloat(lat), parseFloat(lon)]);
        setMapZoom(16); // Zoom in closer for specific location
        setSearchQuery(displayName); // Optional: update input
        setSuggestions([]); // Clear suggestions
    };

    const handleSearch = (e) => {
        e.preventDefault();
        // Fallback or explicit enter press
        if (suggestions.length > 0) {
            handleSelectLocation(suggestions[0].lat, suggestions[0].lon, suggestions[0].display_name);
        }
    };

    const saveGeofence = async () => {
        if (!zoneName) return alert("Name is required");

        // Parse manual coords if changed
        let points = [];
        try {
            points = manualCoords.trim().split('\n').map(line => {
                const [lat, lng] = line.split(',').map(n => parseFloat(n.trim()));
                if (isNaN(lat) || isNaN(lng)) throw new Error("Invalid number");
                return [lat, lng];
            });
        } catch (e) {
            return alert("Invalid coordinates format. Use 'lat, lng' per line.");
        }

        if (points.length < 3) return alert("Need at least 3 points");

        await fetch('http://localhost:3000/api/geofences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: zoneName,
                type: zoneType,
                points: points
            })
        });

        setNewGeofencePoints([]);
        setIsDrawing(false);
        setShowModal(false);
        setZoneName("");
        setManualCoords("");
    };

    const deleteGeofence = async (id) => {
        console.log("Attempting to delete geofence:", id);
        if (!confirm("Are you sure you want to delete this zone?")) return;
        try {
            const res = await fetch(`http://localhost:3000/api/geofences/${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            console.log("Delete response:", data);
            if (data.success) {
                // Optional: Force a refresh if socket doesn't work
                setGeofences(prev => prev.filter(g => g.id !== id));
            } else {
                alert("Failed to delete zone");
            }
        } catch (err) {
            console.error("Delete error:", err);
            alert("Error deleting zone");
        }
    };

    const dismissAlert = (index) => {
        setAlerts(prev => prev.filter((_, i) => i !== index));
    };

    const getUserStatus = (userLoc) => {
        if (!userLoc) return 'neutral';
        const point = [userLoc.lat, userLoc.lng];

        // Check danger zones first
        const dangerZones = geofences.filter(g => g.type === 'danger');
        for (let zone of dangerZones) {
            if (isPointInPolygon(point, zone.points)) return 'danger';
        }

        // Check safe zones
        const safeZones = geofences.filter(g => g.type === 'safe');
        for (let zone of safeZones) {
            if (isPointInPolygon(point, zone.points)) return 'safe';
        }

        return 'neutral';
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

                <div className="p-4 border-b relative">
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Search location..."
                            className="flex-1 p-2 border rounded text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
                            <Search size={16} />
                        </button>
                    </form>
                    {suggestions.length > 0 && (
                        <div className="absolute left-4 right-4 top-full bg-white border shadow-lg rounded-b z-50 max-h-60 overflow-y-auto">
                            {suggestions.map((item) => (
                                <div
                                    key={item.place_id}
                                    className="p-2 hover:bg-gray-100 cursor-pointer text-sm border-b last:border-b-0"
                                    onClick={() => handleSelectLocation(item.lat, item.lon, item.display_name)}
                                >
                                    {item.display_name}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 flex-1 overflow-y-auto">
                    {/* Alerts Section */}
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-red-600">
                            <AlertTriangle size={20} /> Active Alerts
                        </h2>
                        {alerts.length === 0 && <p className="text-gray-500 text-sm">No active alerts</p>}
                        {alerts.map((alert, idx) => (
                            <div key={idx} className="bg-red-50 border-l-4 border-red-500 p-3 mb-2 text-sm shadow-sm">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-red-700">SOS ALERT</p>
                                        <p className="font-semibold">{alert.user?.name || "Unknown User"}</p>
                                        <p className="text-xs text-gray-600">{alert.user?.phone || "No Phone"}</p>
                                        <p className="text-xs text-gray-400 mt-1">{new Date(alert.timestamp).toLocaleTimeString()}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (alert.location) {
                                                setMapCenter([alert.location.lat, alert.location.lng]);
                                                setMapZoom(18);
                                            }
                                        }}
                                        className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 flex items-center gap-1"
                                    >
                                        <MapIcon size={12} /> View
                                    </button>
                                </div>
                                <button
                                    onClick={() => dismissAlert(idx)}
                                    className="w-full mt-2 bg-gray-200 text-gray-700 py-1 rounded text-xs hover:bg-gray-300"
                                >
                                    Dismiss Alert
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Users Section */}
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-blue-600">
                            <Users size={20} /> Active Users ({users.length})
                        </h2>
                        {users.map(user => (
                            <div key={user.id} className="bg-gray-50 p-2 rounded mb-1 text-sm flex justify-between items-center">
                                <div>
                                    <p className="font-bold">{user.name || `User ${user.id.slice(0, 5)}...`}</p>
                                    <p className="text-xs text-gray-500">{user.phone || "No Phone"}</p>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full ${user.location ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                                    {user.location ? "Online" : "Offline"}
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
                                    onClick={openSaveModal}
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

                        <div className="mt-4 pt-4 border-t">
                            <button
                                onClick={() => {
                                    setIsDrawing(false);
                                    setNewGeofencePoints([]);
                                    setManualCoords("");
                                    setShowModal(true);
                                }}
                                className="w-full bg-gray-700 text-white py-2 rounded hover:bg-gray-800 text-sm"
                            >
                                Add Manually (Coords)
                            </button>
                        </div>
                    </div>

                    {/* Zone List Section */}
                    <div className="mt-6 border-t pt-4">
                        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-purple-600">
                            <MapIcon size={20} /> Zones ({geofences.length})
                        </h2>
                        {geofences.length === 0 && <p className="text-gray-500 text-sm">No zones created.</p>}
                        <div className="space-y-2">
                            {geofences.map(geo => (
                                <div key={geo.id} className="bg-gray-50 p-2 rounded text-sm flex justify-between items-center border-l-4" style={{ borderColor: geo.type === 'danger' ? '#ef4444' : '#22c55e' }}>
                                    <div>
                                        <p className="font-bold">{geo.name || "Unnamed Zone"}</p>
                                        <p className="text-xs text-gray-500 capitalize">{geo.type}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                if (geo.points && geo.points.length > 0) {
                                                    setMapCenter(geo.points[0]);
                                                    setMapZoom(16);
                                                }
                                            }}
                                            className="text-blue-600 hover:text-blue-800 text-xs"
                                        >
                                            View
                                        </button>
                                        <button
                                            onClick={() => deleteGeofence(geo.id)}
                                            className="text-red-600 hover:text-red-800 text-xs font-bold"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center">
                    <div className="bg-white p-6 rounded-lg w-96 shadow-xl">
                        <h2 className="text-xl font-bold mb-4">Save Geofence</h2>

                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Zone Name</label>
                            <input
                                type="text"
                                className="w-full border p-2 rounded"
                                value={zoneName}
                                onChange={(e) => setZoneName(e.target.value)}
                                placeholder="e.g. Central Park"
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Zone Type</label>
                            <select
                                className="w-full border p-2 rounded"
                                value={zoneType}
                                onChange={(e) => setZoneType(e.target.value)}
                            >
                                <option value="safe">Safe Zone (Green)</option>
                                <option value="danger">Danger Zone (Red)</option>
                            </select>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Coordinates (Lat, Lng)</label>
                            <textarea
                                className="w-full border p-2 rounded h-32 text-xs font-mono"
                                value={manualCoords}
                                onChange={(e) => setManualCoords(e.target.value)}
                                placeholder="12.34, 56.78&#10;12.35, 56.79&#10;..."
                            />
                            <p className="text-xs text-gray-500 mt-1">Enter one coordinate pair per line.</p>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveGeofence}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                                Save Zone
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Map Area */}
            <div className="flex-1 relative">
                <Map onClick={handleMapClick} center={mapCenter} zoom={mapZoom}>
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
                            <Popup>
                                <div className="text-center">
                                    <p className="font-bold">{geo.name}</p>
                                    <p className="text-xs uppercase mb-2">{geo.type}</p>
                                    <button
                                        onClick={() => deleteGeofence(geo.id)}
                                        className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
                                    >
                                        Delete Zone
                                    </button>
                                </div>
                            </Popup>
                        </Polygon>
                    ))}

                    {/* Render Drawing Polygon */}
                    {newGeofencePoints.length > 0 && (
                        <Polygon
                            positions={newGeofencePoints}
                            pathOptions={{ color: 'blue', dashArray: '5, 5' }}
                        />
                    )}

                    {/* Render Users as Dots */}
                    {users.map(user => {
                        if (!user.location) return null;
                        const status = getUserStatus(user.location);
                        let color = '#3b82f6'; // Blue (Neutral)
                        if (status === 'danger') color = '#ef4444'; // Red
                        if (status === 'safe') color = '#22c55e'; // Green

                        return (
                            <CircleMarker
                                key={user.id}
                                center={[user.location.lat, user.location.lng]}
                                radius={8}
                                pathOptions={{
                                    color: 'white',
                                    weight: 2,
                                    fillColor: color,
                                    fillOpacity: 1
                                }}
                            >
                                <Popup>
                                    <div className="text-center">
                                        <p className="font-bold text-lg">{user.name || "Unknown User"}</p>
                                        <p className="text-sm text-gray-600">{user.phone}</p>
                                        <p className="text-xs font-bold uppercase mt-1" style={{ color }}>
                                            Status: {status}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            Last Seen: {new Date(user.lastSeen).toLocaleTimeString()}
                                        </p>
                                    </div>
                                </Popup>
                            </CircleMarker>
                        );
                    })}
                </Map>
            </div>
        </div>
    );
};

export default AdminDashboard;
