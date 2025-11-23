import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const Map = ({ center, zoom, children, onClick }) => {
    return (
        <MapContainer
            center={center || [51.505, -0.09]}
            zoom={zoom || 13}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapEvents onClick={onClick} />
            {children}
        </MapContainer>
    );
};

const MapEvents = ({ onClick }) => {
    const map = useMap();
    useEffect(() => {
        if (!onClick) return;
        map.on('click', onClick);
        return () => {
            map.off('click', onClick);
        };
    }, [map, onClick]);
    return null;
};

export default Map;
