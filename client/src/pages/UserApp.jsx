import React, { useState, useEffect } from 'react';
import Map from '../components/Map';
import { socket } from '../services/socket';
import { Marker, Popup, Polygon, Circle } from 'react-leaflet';
import { AlertTriangle, ShieldCheck, ShieldAlert, Loader } from 'lucide-react';

const UserApp = () => {
    const [location, setLocation] = useState(null);
    const [geofences, setGeofences] = useState([]);
    const [safetyStatus, setSafetyStatus] = useState({ status: 'Unknown', message: 'Waiting for analysis...' });
    const [loadingSafety, setLoadingSafety] = useState(false);
    const [userData, setUserData] = useState(null);
    const [formData, setFormData] = useState({ name: '', phone: '' });

    useEffect(() => {
        // Check for existing registration
        const savedUser = localStorage.getItem('tourist_user');
        if (savedUser) {
            setUserData(JSON.parse(savedUser));
        }

        // Initial fetch
        fetch('http://localhost:3000/api/geofences')
            .then(res => res.json())
            .then(data => setGeofences(data));
    }, []);

    useEffect(() => {
        if (userData) {
            socket.emit('register-user', { ...userData, type: 'tourist' });

            // Watch Location only after registration
            if (navigator.geolocation) {
                const watchId = navigator.geolocation.watchPosition(
                    (pos) => {
                        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        setLocation(newLoc);
                        socket.emit('location-update', newLoc);
                    },
                    (err) => console.error(err),
                    { enableHighAccuracy: true }
                );
                return () => navigator.geolocation.clearWatch(watchId);
            }
        }
    }, [userData]);

    const handleRegister = (e) => {
        e.preventDefault();
        if (!formData.name || !formData.phone) return alert("Please fill in all fields");

        const user = {
            name: formData.name,
            phone: formData.phone,
            id: Date.now().toString() // Simple ID generation
        };

        localStorage.setItem('tourist_user', JSON.stringify(user));
        setUserData(user);
    };

    const sendSOS = () => {
        if (!location) return alert("Location not available yet!");
        socket.emit('sos-alert', { location, type: 'SOS' });
        alert("SOS Sent to Admin!");
    };

    const checkSafety = async () => {
        if (!location) return;
        setLoadingSafety(true);
        try {
            const res = await fetch('http://localhost:3000/api/predict-safety', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ location, context: "Tourist checking safety" })
            });
            const data = await res.json();
            setSafetyStatus(data);
        } catch (err) {
            console.error(err);
            setSafetyStatus({ status: 'Error', message: 'Failed to check safety.' });
        } finally {
            setLoadingSafety(false);
        }
    };

    if (!userData) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-900 p-4">
                <div className="bg-white p-8 rounded-xl w-full max-w-md shadow-2xl">
                    <h1 className="text-2xl font-bold mb-6 text-center text-blue-600">Tourist Registration</h1>
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Full Name</label>
                            <input
                                type="text"
                                className="w-full border p-3 rounded-lg"
                                placeholder="John Doe"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Phone Number</label>
                            <input
                                type="tel"
                                className="w-full border p-3 rounded-lg"
                                placeholder="+1 234 567 8900"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition"
                        >
                            Start Exploring
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col relative">
            {/* Map Background */}
            <div className="absolute inset-0 z-0">
                <Map center={location ? [location.lat, location.lng] : null} zoom={15}>
                    {/* Geofences */}
                    {geofences.map(geo => (
                        <Polygon
                            key={geo.id}
                            positions={geo.points}
                            pathOptions={{
                                color: geo.type === 'danger' ? 'red' : 'green',
                                fillColor: geo.type === 'danger' ? '#fca5a5' : '#86efac',
                                fillOpacity: 0.3
                            }}
                        />
                    ))}

                    {/* User Location */}
                    {location && (
                        <Circle
                            center={[location.lat, location.lng]}
                            radius={20}
                            pathOptions={{ color: 'blue', fillColor: '#3b82f6', fillOpacity: 0.8 }}
                        />
                    )}
                </Map>
            </div>

            {/* UI Overlay */}
            <div className="z-10 mt-auto p-4 bg-gradient-to-t from-black/80 to-transparent text-white pb-8">
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 mb-4 border border-white/20">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                {safetyStatus.status === 'Safe' && <ShieldCheck className="text-green-400" />}
                                {safetyStatus.status === 'Caution' && <ShieldAlert className="text-yellow-400" />}
                                {safetyStatus.status === 'Danger' && <AlertTriangle className="text-red-500" />}
                                {safetyStatus.status === 'Unknown' && <ShieldCheck className="text-gray-400" />}
                                Safety Status: {safetyStatus.status}
                            </h2>
                            <p className="text-sm text-gray-200 mt-1">{safetyStatus.message}</p>
                        </div>
                        <button
                            onClick={checkSafety}
                            disabled={loadingSafety}
                            className="bg-blue-600 p-2 rounded-full hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loadingSafety ? <Loader className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                        </button>
                    </div>
                </div>

                <button
                    onClick={sendSOS}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 text-xl animate-pulse"
                >
                    <AlertTriangle size={28} /> SOS ALERT
                </button>
            </div>
        </div>
    );
};

export default UserApp;
