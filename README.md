# Venue Copilot

## Chosen Vertical
**Physical Event Experience:** An intelligent, real-time stadium assistant designed to improve crowd movement, waiting times, and spatial coordination at large-scale sporting venues.

## Approach and Logic
The application utilizes a Next.js frontend with a FastAPI-inspired route structure. It leverages Firebase Realtime Database as the single source of truth for venue hotspots (restrooms, food, exits). User geolocation calculates dynamic proximity to these hotspots. The Gemini 2.5 Flash model acts as the reasoning engine, ingesting the live Firebase data to provide context-aware, spatial navigation advice.

## How the Solution Works
1. **Live State:** Firebase continuously syncs wait times and coordinate data for venue facilities.
2. **Spatial Awareness:** The Google Maps API (`AdvancedMarkerElement` and `DirectionsService`) dynamically renders the user's location and calculates walking routes to facilities.
3. **AI Navigation:** The chatbot does not give generic advice; it reads the live database to recommend the fastest exits or shortest food lines based on the user's explicit location.

## Assumptions Made
* Attendees have access to a mobile browser with geolocation permissions enabled.
* Venue management has an active system (or IoT sensors) pushing live queue times to the Firebase database.
