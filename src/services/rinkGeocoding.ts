import { parseMontrealRinks } from "../parsers/montrealRinks.js";
import { geocodeAddresses } from "./geocoding.js";
import type { Rink } from "../types/rink.js";

/**
 * Fetches rinks and geocodes their addresses.
 * @returns Object with separate arrays for English and French rinks, both with geocoding data
 */
export async function getGeocodedRinks(): Promise<{
  readonly rinksEn: readonly Rink[];
  readonly rinksFr: readonly Rink[];
}> {
  // Parse rinks from Montreal pages (both languages)
  const { rinksEn, rinksFr } = await parseMontrealRinks();

  // Get unique addresses from both language versions
  const addressesEn = [...new Set(rinksEn.map((rink) => rink.address))];
  const addressesFr = [...new Set(rinksFr.map((rink) => rink.address))];
  const allAddresses = [...new Set([...addressesFr, ...addressesEn])];

  // Geocode addresses
  const geocodingMap = await geocodeAddresses(allAddresses);

  // Merge rinks with geocoding data
  const geocodeRinks = (rinks: readonly Rink[]): Rink[] => {
    return rinks.map((rink) => {
      const geocoding = geocodingMap.get(rink.address);
      return {
        ...rink,
        lat: geocoding?.lat,
        lng: geocoding?.lng,
      };
    });
  };

  return {
    rinksEn: geocodeRinks(rinksEn),
    rinksFr: geocodeRinks(rinksFr),
  };
}
