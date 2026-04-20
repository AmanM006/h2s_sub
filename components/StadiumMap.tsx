"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';

const containerStyle = {
  width: '100%',
  height: '100%'
};

const center = {
  lat: 23.0919,
  lng: 72.5975
};

export type MarkerData = {
  id: string;
  name: string;
  type: string;
  waitTime: number;
  lat: number;
  lng: number;
};

export const dummyData: Record<string, Omit<MarkerData, 'id'>> = {
  "hotdogs_a": { name: "Hotdogs (Gate A)", type: "food", waitTime: 5, lat: 23.0925, lng: 72.5980 },
  "burgers_b": { name: "Burgers (Gate B)", type: "food", waitTime: 20, lat: 23.0915, lng: 72.5970 },
  "restroom_n": { name: "Restroom (North)", type: "restroom", waitTime: 2, lat: 23.0930, lng: 72.5975 },
  "exit_e": { name: "East Exit", type: "exit", waitTime: 15, lat: 23.0919, lng: 72.5990 }
};

const libraries: ("marker")[] = ["marker"];

function AdvancedMarker({ 
  map, 
  data, 
  onClick 
}: { 
  map: google.maps.Map; 
  data: MarkerData;
  onClick: (data: MarkerData) => void;
}) {
  const [marker, setMarker] = useState<google.maps.marker.AdvancedMarkerElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!map || !contentRef.current) return;
    
    // Create the advanced marker
    const m = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: { lat: data.lat, lng: data.lng },
      title: data.name,
      content: contentRef.current,
    });

    // Add click listener using gmp-click to avoid warnings with AdvancedMarkers
    m.addListener('gmp-click', () => {
      onClick(data);
    });

    setMarker(m);

    return () => {
      m.map = null;
      google.maps.event.clearInstanceListeners(m);
    };
  }, [map, data, onClick]);

  // The custom HTML for the marker (glassmorphism UI matching the dark theme)
  return (
    <div ref={contentRef} className="cursor-pointer group flex flex-col items-center">
      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-transparent group-hover:border-indigo-500 transition-all overflow-hidden relative">
        <span className="text-xl font-bold text-gray-800">
          {data.type === 'food' ? '🍔' : data.type === 'restroom' ? '🚻' : '🚪'}
        </span>
      </div>
      <div className={`mt-1 px-3 py-1 rounded-full text-xs font-bold text-white shadow-md border border-white/20 backdrop-blur-md flex items-center gap-1 ${
        data.waitTime < 5 ? 'bg-green-600' : data.waitTime > 15 ? 'bg-red-600' : 'bg-yellow-600 text-gray-900'
      }`}>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        {data.waitTime}
      </div>
    </div>
  );
}

export default function StadiumMap({
  activeLocation,
  onLocationSelect
}: {
  activeLocation?: MarkerData | null,
  onLocationSelect?: (location: MarkerData) => void
}) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<MarkerData[]>(
    Object.entries(dummyData).map(([id, data]) => ({ id, ...data }))
  );
  
  // Track selected marker internally if not provided via props
  const [internalActiveMarker, setInternalActiveMarker] = useState<MarkerData | null>(null);
  const currentActiveMarker = activeLocation !== undefined ? activeLocation : internalActiveMarker;

  useEffect(() => {
    try {
      const stadiumRef = ref(db, 'stadium');
      const unsubscribe = onValue(stadiumRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const parsedMarkers = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
          }));
          setMarkers(parsedMarkers);
        }
      }, (error) => {
        console.log("Firebase fetch error, using dummy data:", error);
      });
      return () => unsubscribe();
    } catch (error) {
      console.log("Firebase not initialized correctly, using dummy data:", error);
    }
  }, []);

  useEffect(() => {
    if (map && currentActiveMarker) {
      map.panTo({ lat: currentActiveMarker.lat, lng: currentActiveMarker.lng });
      // Remove zoom setting here to allow user to pan around freely without snapping zoom constantly
    }
  }, [map, currentActiveMarker]);

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback(map: google.maps.Map) {
    setMap(null);
  }, []);

  const handleMarkerClick = useCallback((data: MarkerData) => {
    if (onLocationSelect) {
      onLocationSelect(data);
    } else {
      setInternalActiveMarker(data);
    }
  }, [onLocationSelect]);

  return isLoaded ? (
    <div className="w-full h-full relative z-0">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={16}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          mapId: "DEMO_MAP_ID",
          disableDefaultUI: true,
        }}
      >
        {map && markers.map((marker) => (
          <AdvancedMarker
            key={marker.id}
            map={map}
            data={marker}
            onClick={handleMarkerClick}
          />
        ))}
      </GoogleMap>
    </div>
  ) : (
    <div className="w-full h-full flex items-center justify-center bg-[#111111] text-white">
      <div className="flex flex-col items-center gap-2">
        <span className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Loading Map...</span>
      </div>
    </div>
  );
}
