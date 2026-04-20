"use client";

import { useEffect, useState, useCallback, useRef, memo } from 'react';
import { GoogleMap, useJsApiLoader, DirectionsRenderer } from '@react-google-maps/api';
import { db } from '@/lib/firebase';
import { ref, set } from 'firebase/database';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Navigation } from 'lucide-react';

const containerStyle = {
  width: '100%',
  height: '100%'
};

export type MarkerData = {
  id: string;
  name: string;
  type: string;
  waitTime: number;
  lat: number;
  lng: number;
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
    
    const m = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: { lat: data.lat, lng: data.lng },
      title: data.name,
      content: contentRef.current,
    });

    m.addListener('gmp-click', () => {
      onClick(data);
    });

    setMarker(m);

    return () => {
      m.map = null;
      google.maps.event.clearInstanceListeners(m);
    };
  }, [map, data, onClick]);

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

function StadiumMapComponent({
  activeLocation,
  onLocationSelect,
  locationsList
}: {
  activeLocation?: MarkerData | null,
  onLocationSelect?: (location: MarkerData | null) => void,
  locationsList: MarkerData[]
}) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [center, setCenter] = useState({ lat: 23.0919, lng: 72.5975 });
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  
  const currentActiveMarker = activeLocation !== undefined ? activeLocation : null;

  useEffect(() => {
    if (map && currentActiveMarker) {
      map.panTo({ lat: currentActiveMarker.lat, lng: currentActiveMarker.lng });
    } else if (directionsResponse) {
       // Clear directions if marker is deselected
       setDirectionsResponse(null);
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
    }
    setDirectionsResponse(null); // Reset directions on new selection
  }, [onLocationSelect]);

  const generateDummyMarkers = (lat: number, lng: number) => {
    const newMarkers = {
      "food_1": { name: "Burger Stand", type: "food", waitTime: Math.floor(Math.random() * 20) + 1, lat: lat + (Math.random() - 0.5) * 0.005, lng: lng + (Math.random() - 0.5) * 0.005 },
      "food_2": { name: "Pizza Corner", type: "food", waitTime: Math.floor(Math.random() * 15) + 1, lat: lat + (Math.random() - 0.5) * 0.005, lng: lng + (Math.random() - 0.5) * 0.005 },
      "restroom_1": { name: "Restroom (East)", type: "restroom", waitTime: Math.floor(Math.random() * 5) + 1, lat: lat + (Math.random() - 0.5) * 0.005, lng: lng + (Math.random() - 0.5) * 0.005 },
      "restroom_2": { name: "Restroom (West)", type: "restroom", waitTime: Math.floor(Math.random() * 5) + 1, lat: lat + (Math.random() - 0.5) * 0.005, lng: lng + (Math.random() - 0.5) * 0.005 },
      "exit_1": { name: "Main Exit", type: "exit", waitTime: Math.floor(Math.random() * 10) + 1, lat: lat + (Math.random() - 0.5) * 0.005, lng: lng + (Math.random() - 0.5) * 0.005 },
    };
  
    const hotspotsRef = ref(db, 'venue/hotspots');
    set(hotspotsRef, newMarkers).then(() => {
      console.log("Updated dummy markers in Firebase.");
    }).catch(err => console.error("Error setting markers:", err));
  };

  const locateMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const newCenter = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setCenter(newCenter);
        if (map) {
          map.panTo(newCenter);
          map.setZoom(16);
        }
        generateDummyMarkers(newCenter.lat, newCenter.lng);
        setDirectionsResponse(null); // Clear directions
        if (onLocationSelect) onLocationSelect(null); // Deselect active location
      }, (err) => {
        console.error("Geolocation error:", err);
        alert("Failed to get your location. Please check browser permissions.");
      });
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const calculateRoute = () => {
    if (!currentActiveMarker) return;
    
    // Use the map's current center as the origin for directions
    // Ideally we would track user location, but map center is a good proxy since Locate Me centers the map
    const origin = center; 
    
    const directionsService = new window.google.maps.DirectionsService();
    
    directionsService.route(
      {
        origin: origin,
        destination: { lat: currentActiveMarker.lat, lng: currentActiveMarker.lng },
        travelMode: window.google.maps.TravelMode.WALKING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          setDirectionsResponse(result);
        } else {
          console.error(`Error fetching directions: ${status}`);
          alert("Could not calculate walking directions to this facility.");
        }
      }
    );
  };

  return isLoaded ? (
    <div className="w-full h-full relative z-0" aria-label="Stadium interactive map" role="region">
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
        {map && locationsList.map((marker) => (
          <AdvancedMarker
            key={marker.id}
            map={map}
            data={marker}
            onClick={handleMarkerClick}
          />
        ))}

        {directionsResponse && (
          <DirectionsRenderer 
            directions={directionsResponse} 
            options={{ 
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: '#6366f1',
                strokeWeight: 6,
                strokeOpacity: 0.8
              }
            }} 
          />
        )}
      </GoogleMap>

      {/* Floating Locate Me Button */}
      <Button 
        onClick={locateMe}
        aria-label="Use my location to find nearby facilities"
        className="absolute top-4 left-4 bg-[#1C1C1C]/90 backdrop-blur-md text-white border border-white/10 shadow-lg hover:bg-[#2C2C2C] rounded-full px-4 h-12 flex items-center gap-2 z-10"
      >
        <Navigation className="w-5 h-5" aria-hidden="true" />
        <span className="font-medium">Use My Location</span>
      </Button>

      {/* Floating Card Detail View on Map */}
      {currentActiveMarker && (
        <Card className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-[#1C1C1C]/90 backdrop-blur-xl border border-white/10 text-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-20">
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shrink-0">
                <span className="text-xl">{currentActiveMarker.type === 'food' ? '🍔' : currentActiveMarker.type === 'restroom' ? '🚻' : '🚪'}</span>
              </div>
              <div>
                <h3 className="font-bold text-lg">{currentActiveMarker.name}</h3>
                <p className="text-sm text-gray-400">Walking • Open now</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/5 border border-white/10 text-xs font-medium">
              <div className="flex items-center gap-2"><span className="text-lg">🕒</span> {currentActiveMarker.waitTime} min wait</div>
              <div className="w-px h-4 bg-white/20"></div>
              <div className="text-green-400 font-bold">Fastest</div>
            </div>
            
            <div className="text-sm text-gray-300">
              This is the nearest {currentActiveMarker.type} facility to your current location. Based on live data, the line moves quickly.
            </div>
            
            <Button 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl mt-2"
              onClick={calculateRoute}
              aria-label={`Get walking directions to ${currentActiveMarker.name}`}
            >
              Get Directions
            </Button>
          </div>
          <button 
            onClick={() => {
              if (onLocationSelect) onLocationSelect(null);
            }}
            className="absolute top-4 right-4 text-gray-400 hover:text-white"
            aria-label="Close details"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </Card>
      )}
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

const StadiumMap = memo(StadiumMapComponent);
export default StadiumMap;
