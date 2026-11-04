export type CurrencyCode = 'UAH';

export type Money = {
  amountMinor: number;
  currency: CurrencyCode;
};

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type RoutePoint = {
  placeId?: string;
  label: string;
  coordinates: Coordinates;
};

export type PassengerRequestStatus =
  | 'draft' | 'searching' | 'matched' | 'in_trip'
  | 'completed' | 'cancelled' | 'expired';

export type DriverTripStatus =
  | 'draft' | 'published' | 'in_progress' | 'completed' | 'cancelled';

export type BookingStatus =
  | 'pending' | 'confirmed' | 'picked_up' | 'completed' | 'cancelled';

export type PassengerFareInput = {
  routeDistanceMeters: number;
  offeredRateMinorPerKm: number;
};

/** Calculates fare from metres and integer minor currency units. */
export function calculatePassengerFare(input: PassengerFareInput): Money {
  if (!Number.isFinite(input.routeDistanceMeters) || input.routeDistanceMeters < 0) {
    throw new Error('routeDistanceMeters must be a non-negative finite number');
  }
  if (!Number.isSafeInteger(input.offeredRateMinorPerKm) || input.offeredRateMinorPerKm < 0) {
    throw new Error('offeredRateMinorPerKm must be a non-negative integer');
  }
  return {
    amountMinor: Math.round(input.routeDistanceMeters * input.offeredRateMinorPerKm / 1000),
    currency: 'UAH',
  };
}
