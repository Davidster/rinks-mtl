import { parseMontrealRinks } from "../parsers/montrealRinks.js";
import { geocodeAddresses } from "./geocoding.js";
import type { Rink } from "../types/rink.js";

/**
 * Fetches rinks and geocodes their addresses.
 * @returns Array of rinks with geocoding data
 */
export async function getGeocodedRinks(): Promise<readonly Rink[]> {
  // Parse rinks from Montreal page
  const rinks = await parseMontrealRinks();

  // Get unique addresses
  const addresses = [...new Set(rinks.map((rink) => rink.address))];

  // Geocode addresses
  const geocodingMap = await geocodeAddresses(addresses);

  // Merge rinks with geocoding data
  return rinks.map((rink) => {
    const geocoding = geocodingMap.get(rink.address);
    return {
      ...rink,
      lat: geocoding?.lat,
      lng: geocoding?.lng,
    };
  });
}
