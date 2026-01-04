import { getGeocodedRinks } from "../services/rinkGeocoding.js";
import type { Rink } from "../types/rink.js";

interface RinksResponse {
  readonly allRinks: readonly Rink[];
  readonly geocodedRinks: readonly Rink[];
}

/**
 * Handles the /api/rinks endpoint request.
 * @returns JSON response with all rinks and geocoded rinks
 */
export async function handleRinksRequest(): Promise<RinksResponse> {
  const allRinks = await getGeocodedRinks();
  const geocodedRinks = allRinks.filter((rink) => rink.lat !== undefined && rink.lng !== undefined);

  return {
    allRinks,
    geocodedRinks,
  };
}
