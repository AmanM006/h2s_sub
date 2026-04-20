/**
 * Application-wide constants for the Venue Copilot application.
 * Centralizes magic strings, API paths, and configuration values
 * to improve maintainability and prevent typos.
 */

/** Firebase Realtime Database path for venue hotspot data */
export const FIREBASE_HOTSPOTS_PATH = 'venue/hotspots';

/** API route paths */
export const API_ROUTES = {
  CHAT: '/api/chat',
} as const;

/** Gemini model identifier */
export const GEMINI_MODEL = 'gemini-2.5-flash';

/** Google Maps configuration */
export const MAP_CONFIG = {
  DEFAULT_CENTER: { lat: 23.0919, lng: 72.5975 },
  DEFAULT_ZOOM: 16,
  MAP_ID: 'DEMO_MAP_ID',
  MARKER_RADIUS: 0.005,
} as const;

/** Facility type identifiers */
export const FACILITY_TYPES = {
  FOOD: 'food',
  RESTROOM: 'restroom',
  EXIT: 'exit',
} as const;

/** Facility type to emoji mapping */
export const FACILITY_EMOJI: Record<string, string> = {
  food: '🍔',
  restroom: '🚻',
  exit: '🚪',
} as const;

/** Sort order identifiers */
export const SORT_OPTIONS = {
  WAIT_ASC: 'wait_asc',
  WAIT_DESC: 'wait_desc',
} as const;

/** Filter value for showing all facility types */
export const FILTER_ALL = 'all';

/** Chat input constraints for zod validation */
export const CHAT_LIMITS = {
  MIN_MESSAGE_LENGTH: 1,
  MAX_MESSAGE_LENGTH: 500,
} as const;

/** System prompt for the Gemini AI assistant */
export const VENUE_COPILOT_SYSTEM_PROMPT = (waitTimesString: string): string =>
  `You are Venue Copilot, an AI assistant dedicated to helping users navigate large event venues, find accessible routes, locate amenities, and track real-time crowd hotspots. You have access to the following live facilities and wait times: [${waitTimesString}]. If a user asks where to go, you MUST calculate the best option based on wait times. Give explicit directions based on the data. Never give generic answers like 'sounds good'. Always mention specific facility names and wait times.`;
