import { readFileSync, writeFileSync, existsSync } from "fs";
import { env } from "../env.js";
import type { GeocodingCache, GeocodingData } from "../types/geocoding.js";

const GEOCODING_CACHE_FILE = "rinks_geocoding.json";

/**
 * Loads the geocoding cache from the JSON file.
 */
function loadCache(): GeocodingCache {
  if (!existsSync(GEOCODING_CACHE_FILE)) {
    return {};
  }

  try {
    const fileContent = readFileSync(GEOCODING_CACHE_FILE, "utf-8");
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return JSON.parse(fileContent) as GeocodingCache;
  } catch (error) {
    console.error("Error loading geocoding cache:", error);
    return {};
  }
}

/**
 * Saves the geocoding cache to the JSON file, sorted by address.
 */
function saveCache(cache: GeocodingCache): void {
  // Sort by address alphabetically
  const sortedEntries = Object.entries(cache).sort(([a], [b]) => a.localeCompare(b));
  const sortedCache: GeocodingCache = {};
  for (const [address, data] of sortedEntries) {
    sortedCache[address] = data;
  }

  try {
    writeFileSync(GEOCODING_CACHE_FILE, JSON.stringify(sortedCache, null, 2), "utf-8");
  } catch (error) {
    console.error("Error saving geocoding cache:", error);
    throw error;
  }
}

/**
 * Geocodes an address using Google Geocoding API.
 */
async function geocodeAddress(address: string): Promise<GeocodingData | null> {
  if (!env.GOOGLE_MAPS_BACKEND_API_KEY) {
    throw new Error("GOOGLE_MAPS_BACKEND_API_KEY is not set");
  }

  // Add "Montreal, QC, Canada" to help with geocoding accuracy
  const fullAddress = `${address}, Montreal, QC, Canada`;
  const encodedAddress = encodeURIComponent(fullAddress);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${env.GOOGLE_MAPS_BACKEND_API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status} ${response.statusText}`);
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const data = (await response.json()) as {
      status: string;
      results?: Array<{
        geometry: {
          location: {
            lat: number;
            lng: number;
          };
        };
      }>;
    };

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      console.warn(`Geocoding failed for address: ${address} (status: ${data.status})`);
      return null;
    }

    const location = data.results[0]?.geometry?.location;
    if (!location) {
      return null;
    }

    return {
      address,
      lat: location.lat,
      lng: location.lng,
    };
  } catch (error) {
    console.error(`Error geocoding address "${address}":`, error);
    return null;
  }
}

/**
 * Geocodes an address, using cache if available.
 * @param address - The address to geocode
 * @returns Geocoding data or null if geocoding failed
 */
export async function getGeocodingData(address: string): Promise<GeocodingData | null> {
  const cache = loadCache();

  // Check if we already have this address cached
  if (cache[address]) {
    return cache[address] || null;
  }

  // Geocode the address
  const geocodingData = await geocodeAddress(address);
  if (!geocodingData) {
    return null;
  }

  // Update cache and save
  cache[address] = geocodingData;
  saveCache(cache);

  return geocodingData;
}

/**
 * Geocodes multiple addresses, using cache when available.
 * @param addresses - Array of addresses to geocode
 * @returns Map of address to geocoding data
 */
export async function geocodeAddresses(
  addresses: readonly string[]
): Promise<Map<string, GeocodingData>> {
  const cache = loadCache();
  const result = new Map<string, GeocodingData>();
  const addressesToGeocode: string[] = [];
  const updatedCache: GeocodingCache = { ...cache };

  // Check cache first
  for (const address of addresses) {
    if (cache[address]) {
      result.set(address, cache[address]);
    } else {
      addressesToGeocode.push(address);
    }
  }

  // Geocode addresses not in cache (with a small delay to respect rate limits)
  for (const address of addressesToGeocode) {
    console.info(`[GEOCODE] Geocoding new address: ${address}`);
    const geocodingData = await geocodeAddress(address);
    if (geocodingData) {
      result.set(address, geocodingData);
      updatedCache[address] = geocodingData;
      console.info(`[GEOCODE] Successfully geocoded: ${address} -> (${geocodingData.lat}, ${geocodingData.lng})`);
    } else {
      console.warn(`[GEOCODE] Failed to geocode address: ${address}`);
    }

    // Small delay to avoid hitting rate limits
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Save updated cache if we geocoded any new addresses
  if (addressesToGeocode.length > 0) {
    saveCache(updatedCache);
  }

  return result;
}
