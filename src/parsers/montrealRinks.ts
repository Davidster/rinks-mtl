import * as cheerio from "cheerio";
import type { Rink } from "../types/rink.js";

const MONTREAL_RINKS_URL =
  "https://montreal.ca/en/outdoor-skating-rinks-conditions?shownResults=1000";

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  readonly rinks: readonly Rink[];
  readonly timestamp: number;
}

let cache: CacheEntry | null = null;

/**
 * Parses the last updated timestamp string.
 * Handles formats like "January 4 - 11:14 am" or "December 16 - 11:38 am"
 */
function parseLastUpdated(timestampText: string): string {
  return timestampText.trim();
}

/**
 * Determines if a rink is open based on facility status text.
 */
function determineIsOpen(statusText: string): boolean {
  const lowerStatus = statusText.toLowerCase();
  const closedIndicators = ["closed", "out of order", "off-season", "work in progress"];

  return !closedIndicators.some((indicator) => lowerStatus.includes(indicator));
}

/**
 * Fetches and parses the Montreal skating rinks page.
 * Uses an in-memory cache to avoid scraping more than once every 5 minutes.
 * @returns An array of parsed rink data
 */
export async function parseMontrealRinks(): Promise<readonly Rink[]> {
  // Check cache
  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_DURATION_MS) {
    return cache.rinks;
  }

  // Cache expired or doesn't exist, fetch fresh data
  const response = await fetch(MONTREAL_RINKS_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch rinks page: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const rinks: Rink[] = [];

  // Each rink is in a li.list-element
  $("li.list-element").each((_index, element) => {
    const $element = $(element);

    // Type: strong.h4.mb-2
    const $typeElement = $element.find("strong.h4.mb-2");
    const type = $typeElement.text().trim();

    if (!type) {
      return;
    }

    // Status: First .list-group-info-item > .list-item-content > div (the div after "Facility status" label)
    // The status div is the first div without a class, or we can get the second div child
    const $firstInfoItem = $element.find(".list-group-info-item").first();
    const $statusDiv = $firstInfoItem
      .find(".list-item-content > div")
      .not(".list-item-label")
      .not(".mt-1")
      .first();
    let iceStatus = $statusDiv.text().trim();

    // If status is empty, it might be missing - check if there's text directly after the label
    if (!iceStatus) {
      const $allDivs = $firstInfoItem.find(".list-item-content > div");
      if ($allDivs.length > 1) {
        iceStatus = $($allDivs[1]).text().trim();
      }
    }

    // Last updated: Extract from .list-item-content text after "Last updated"
    // Format: "Last updated<!-- --><!-- -->November 7 - 5:19 pm" (cheerio converts &nbsp; to spaces)
    const $listItemContent = $firstInfoItem.find(".list-item-content");
    const contentText = $listItemContent.text();
    // Match pattern like "Last updated November 7 - 5:19 pm" or "Last updated December 16 - 11:38 am"
    const lastUpdatedMatch = contentText.match(
      /Last updated\s+(\w+\s+\d+\s*-\s*\d+:\d+\s*(?:am|pm))/i
    );
    let lastUpdatedRaw = "";
    if (lastUpdatedMatch) {
      lastUpdatedRaw = parseLastUpdated(lastUpdatedMatch[1] || "");
    }

    // Name and hyperlink: Second .list-group-info-item > .list-item-action > a
    const $secondInfoItem = $element.find(".list-group-info-item").last();
    const $nameLink = $secondInfoItem.find(".list-item-action a");
    const name = $nameLink.find(".link-icon-label").text().trim() || $nameLink.text().trim();
    const href = $nameLink.attr("href") || "";
    const hyperlink = href.startsWith("http") ? href : `https://montreal.ca${href}`;

    // Address: Second .list-group-info-item > .list-item > div (after the link)
    const $addressDiv = $secondInfoItem.find(".list-item > div").last();
    const address = $addressDiv.text().trim();

    // Only add if we have the minimum required fields
    if (type && iceStatus && lastUpdatedRaw) {
      rinks.push({
        type,
        iceStatus,
        lastUpdatedRaw: lastUpdatedRaw,
        isOpen: determineIsOpen(iceStatus),
        name: name || "Unknown",
        hyperlink: hyperlink || MONTREAL_RINKS_URL,
        address: address || "Unknown",
      });
    }
  });

  // Update cache with fresh data
  cache = {
    rinks,
    timestamp: Date.now(),
  };

  return rinks;
}
