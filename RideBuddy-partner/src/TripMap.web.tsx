// Web fallback — react-native-maps has no web implementation, so the schematic
// route card stands in. Native builds use TripMap.tsx.
import React from 'react';
import { Placeholder, TripMapProps } from './TripMapShared';

export type { TripMapProps };

export default function TripMap({ pickupLabel, dropLabel, height = 230 }: TripMapProps) {
  return <Placeholder pickupLabel={pickupLabel} dropLabel={dropLabel} height={height} />;
}
