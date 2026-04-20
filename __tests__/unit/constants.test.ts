import { expect, test, describe } from 'vitest'
import { FIREBASE_HOTSPOTS_PATH, API_ROUTES, GEMINI_MODEL, MAP_CONFIG, FACILITY_TYPES, CHAT_LIMITS, VENUE_COPILOT_SYSTEM_PROMPT } from '@/lib/constants'

/**
 * Unit tests for application constants and utility functions.
 * Validates that configuration values are correctly defined
 * and the system prompt generator produces expected output.
 */
describe('Application Constants', () => {
  test('Firebase hotspots path should be defined', () => {
    expect(FIREBASE_HOTSPOTS_PATH).toBe('venue/hotspots');
  });

  test('API routes should contain chat endpoint', () => {
    expect(API_ROUTES.CHAT).toBe('/api/chat');
  });

  test('Gemini model should be gemini-2.5-flash', () => {
    expect(GEMINI_MODEL).toBe('gemini-2.5-flash');
  });

  test('Map config should have valid default center coordinates', () => {
    expect(MAP_CONFIG.DEFAULT_CENTER.lat).toBeGreaterThan(0);
    expect(MAP_CONFIG.DEFAULT_CENTER.lng).toBeGreaterThan(0);
    expect(MAP_CONFIG.DEFAULT_ZOOM).toBe(16);
  });

  test('Facility types should include food, restroom, exit', () => {
    expect(FACILITY_TYPES.FOOD).toBe('food');
    expect(FACILITY_TYPES.RESTROOM).toBe('restroom');
    expect(FACILITY_TYPES.EXIT).toBe('exit');
  });

  test('Chat limits should enforce min and max message length', () => {
    expect(CHAT_LIMITS.MIN_MESSAGE_LENGTH).toBe(1);
    expect(CHAT_LIMITS.MAX_MESSAGE_LENGTH).toBe(500);
  });
});

describe('System Prompt Generator', () => {
  test('should include Venue Copilot identity in prompt', () => {
    const prompt = VENUE_COPILOT_SYSTEM_PROMPT('Burger Stand (food): Wait time 3 mins');
    expect(prompt).toContain('Venue Copilot');
    expect(prompt).toContain('navigate large event venues');
    expect(prompt).toContain('Burger Stand');
  });

  test('should include wait times data when provided', () => {
    const prompt = VENUE_COPILOT_SYSTEM_PROMPT('Exit A (exit): Wait time 10 mins');
    expect(prompt).toContain('Exit A');
    expect(prompt).toContain('10 mins');
  });

  test('should handle empty wait times string', () => {
    const prompt = VENUE_COPILOT_SYSTEM_PROMPT('');
    expect(prompt).toContain('Venue Copilot');
    expect(prompt).toContain('[]');
  });
});
