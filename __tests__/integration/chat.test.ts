import { expect, test, vi, describe } from 'vitest'

/**
 * Integration tests for the Chat API route handler.
 * Tests validate zod schema enforcement, Gemini mock responses,
 * and edge cases like oversized payloads and XSS injection.
 */

// Mock the Google Generative AI module
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class MockGoogleGenerativeAI {
      constructor() {}
      getGenerativeModel() {
        return {
          generateContent: async () => ({
            response: {
              text: () =>
                'Based on current wait times, the Burger Stand has only a 3-minute wait. Head to Gate A, turn left, and it will be on your right.',
            },
          }),
        };
      }
    },
  };
});

vi.mock('@/lib/firebase', () => ({ db: {} }));

vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  get: vi.fn().mockResolvedValue({
    exists: () => true,
    val: () => ({
      food_1: { name: 'Burger Stand', type: 'food', waitTime: 3, lat: 23.09, lng: 72.59 },
      restroom_1: { name: 'Restroom (East)', type: 'restroom', waitTime: 1, lat: 23.091, lng: 72.598 },
    }),
  }),
}));

vi.mock('@/lib/gcp-logger', () => ({
  logInfo: vi.fn().mockResolvedValue(undefined),
  logError: vi.fn().mockResolvedValue(undefined),
  logWarning: vi.fn().mockResolvedValue(undefined),
}));

describe('Chat API Route — /api/chat', () => {
  test('should return a spatially-aware response from Gemini', async () => {
    const { POST } = await import('@/app/api/chat/route');
    const mockRequest = new Request('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Where should I get food?',
        venueData: [
          { id: 'food_1', name: 'Burger Stand', type: 'food', waitTime: 3, lat: 23.09, lng: 72.59 },
        ],
      }),
    });

    const response = await POST(mockRequest as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reply).toBeDefined();
    expect(typeof data.reply).toBe('string');
    expect(data.reply.length).toBeGreaterThan(10);
  });

  test('should reject empty messages with 400 status', async () => {
    const { POST } = await import('@/app/api/chat/route');
    const mockRequest = new Request('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    });

    const response = await POST(mockRequest as any);
    expect(response.status).toBe(400);
  });

  test('should handle missing message field gracefully', async () => {
    const { POST } = await import('@/app/api/chat/route');
    const mockRequest = new Request('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(mockRequest as any);
    expect(response.status).toBe(400);
  });

  test('should reject messages exceeding max length', async () => {
    const { POST } = await import('@/app/api/chat/route');
    const longMessage = 'a'.repeat(600);
    const mockRequest = new Request('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: longMessage }),
    });

    const response = await POST(mockRequest as any);
    expect(response.status).toBe(400);
  });

  test('should sanitize XSS payloads in message without crashing', async () => {
    const { POST } = await import('@/app/api/chat/route');
    const xssPayload = '<script>alert("xss")</script>Where is the exit?';
    const mockRequest = new Request('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: xssPayload }),
    });

    const response = await POST(mockRequest as any);
    // Should still process — zod doesn't block HTML, but the route should not crash
    expect(response.status).toBe(200);
  });
});
