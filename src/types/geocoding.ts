export interface GeocodingData {
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
}

export interface GeocodingCache {
  [address: string]: GeocodingData;
}
