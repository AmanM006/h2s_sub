import React from 'react';
import { expect, test, vi, describe } from 'vitest';
import { render, screen } from '@testing-library/react';
import StadiumMap from '@/components/StadiumMap';

// Mock the Google Maps API loader
vi.mock('@react-google-maps/api', () => ({
  useJsApiLoader: vi.fn(() => ({ isLoaded: true })),
  GoogleMap: ({ children }: { children: React.ReactNode }) => <div data-testid="google-map">{children}</div>,
  DirectionsRenderer: () => <div data-testid="directions-renderer" />,
}));

// Mock Firebase
vi.mock('@/lib/firebase', () => ({
  db: {},
}));

vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
}));

describe('StadiumMap Component', () => {
  const mockLocations = [
    { id: '1', name: 'Burger Stand', type: 'food', waitTime: 5, lat: 10, lng: 20 },
    { id: '2', name: 'Main Exit', type: 'exit', waitTime: 12, lat: 11, lng: 21 },
  ];

  test('renders the map and its core elements correctly', () => {
    render(<StadiumMap locationsList={mockLocations} />);

    // Assert that the Google Map mock wrapper is rendered
    const mapElement = screen.getByTestId('google-map');
    expect(mapElement).toBeDefined();

    // Assert that the "Use My Location" floating button renders
    const locateButton = screen.getByRole('button', { name: /Use my location/i });
    expect(locateButton).toBeDefined();
    expect(locateButton.textContent).toContain('Use My Location');
  });

  test('renders location details card when a location is active', () => {
    const activeLoc = mockLocations[0];
    render(<StadiumMap locationsList={mockLocations} activeLocation={activeLoc} />);

    // The component should render the details for the active location
    const heading = screen.getByText('Burger Stand');
    expect(heading).toBeDefined();

    // Should display the wait time
    const waitTimeText = screen.getByText(/5 min wait/i);
    expect(waitTimeText).toBeDefined();

    // Should render the Get Directions button
    const dirButton = screen.getByRole('button', { name: /Get walking directions/i });
    expect(dirButton).toBeDefined();
  });
});
