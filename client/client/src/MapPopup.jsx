import React from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import './MapPopup.css';

export default function MapPopup({ lat, lng, onClose }) {
  const mapStyles = {
    height: '400px',
    width: '100%',
  };

  return (
    <div className="map-popup-overlay">
      <div className="map-popup-box">
        <button onClick={onClose} className="close-btn">
          Đóng
        </button>
        <LoadScript googleMapsApiKey="YOUR_GOOGLE_MAPS_API_KEY">
          <GoogleMap
            mapContainerStyle={mapStyles}
            zoom={13}
            center={{ lat, lng }}
          >
            <Marker position={{ lat, lng }} />
          </GoogleMap>
        </LoadScript>
      </div>
    </div>
  );
}
