import * as cheerio from "cheerio";
import type { Rink } from "../types/rink.js";

const MONTREAL_RINKS_URL_EN =
  "https://montreal.ca/en/outdoor-skating-rinks-conditions?shownResults=1000";
const MONTREAL_RINKS_URL_FR =
  "https://montreal.ca/conditions-des-patinoires-exterieures?shownResults=1000";

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  readonly rinksEn: readonly Rink[];
  readonly rinksFr: readonly Rink[];
  readonly timestamp: number;
}

let cache: CacheEntry | null = null;

/**
 * Month name to number mapping (English).
 */
const MONTH_NAMES_EN: ReadonlyMap<string, number> = new Map([
  ["january", 0],
  ["february", 1],
  ["march", 2],
  ["april", 3],
  ["may", 4],
  ["june", 5],
  ["july", 6],
  ["august", 7],
  ["september", 8],
  ["october", 9],
  ["november", 10],
  ["december", 11],
]);

/**
 * Month name to number mapping (French).
 */
const MONTH_NAMES_FR: ReadonlyMap<string, number> = new Map([
  ["janvier", 0],
  ["février", 1],
  ["mars", 2],
  ["avril", 3],
  ["mai", 4],
  ["juin", 5],
  ["juillet", 6],
  ["août", 7],
  ["septembre", 8],
  ["octobre", 9],
  ["novembre", 10],
  ["décembre", 11],
]);

/**
 * Parses the last updated timestamp string into a Date object.
 * Handles formats like "January 4 - 10:10 am" (English) or "4 janvier à 13 h 05" (French)
 * Year logic: if month is after September, use previous year; otherwise use current year.
 * Times are interpreted as Montreal time (America/Montreal, Eastern Time).
 */
function parseLastUpdated(timestampText: string, isFrench: boolean): Date | null {
  const trimmed = timestampText.trim();
  if (!trimmed) {
    return null; // Return null if empty
  }

  let year: number;
  let monthNum: number;
  let day: number;
  let hour: number;
  let minute: number;

  if (isFrench) {
    // French format: "4 janvier à 13 h 05" or "30 décembre à 6 h 03"
    const match = trimmed.match(/^(\d+)\s+([a-zéèêàùûôîç]+)\s+à\s+(\d+)\s+h\s+(\d+)$/i);
    if (!match) {
      return null; // Fallback if parsing fails
    }

    const [, dayStr, monthName, hourStr, minuteStr] = match;
    const foundMonthNum = MONTH_NAMES_FR.get(monthName.toLowerCase());
    if (foundMonthNum === undefined) {
      return null; // Fallback if month not recognized
    }

    day = Number.parseInt(dayStr, 10);
    hour = Number.parseInt(hourStr, 10);
    minute = Number.parseInt(minuteStr, 10);
    monthNum = foundMonthNum;
  } else {
    // English format: "January 4 - 10:10 am" or "December 31 - 12:06 pm"
    const match = trimmed.match(/^(\w+)\s+(\d+)\s*-\s*(\d+):(\d+)\s*(am|pm)$/i);
    if (!match) {
      return null; // Fallback if parsing fails
    }

    const [, monthName, dayStr, hourStr, minuteStr, amPm] = match;
    const foundMonthNum = MONTH_NAMES_EN.get(monthName.toLowerCase());
    if (foundMonthNum === undefined) {
      return null; // Fallback if month not recognized
    }

    day = Number.parseInt(dayStr, 10);
    hour = Number.parseInt(hourStr, 10);
    minute = Number.parseInt(minuteStr, 10);
    monthNum = foundMonthNum;

    // Convert to 24-hour format
    if (amPm.toLowerCase() === "pm" && hour !== 12) {
      hour += 12;
    } else if (amPm.toLowerCase() === "am" && hour === 12) {
      hour = 0;
    }
  }

  // Determine year: if month is after September (October, November, December), use previous year
  const currentYear = new Date().getFullYear();
  year = monthNum > 8 ? currentYear - 1 : currentYear;

  // Create date string in ISO format with Montreal timezone (EST, UTC-5)
  // Skating rinks are only relevant in winter, so we always use EST offset
  const dateStr = `${year}-${String(monthNum + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-05:00`;

  // Create date with explicit timezone offset (EST, UTC-5)
  return new Date(dateStr);
}

/**
 * Determines if a rink is open based on the badge text.
 */
function determineIsOpen(badgeText: string, isFrench: boolean): boolean {
  const lowerBadge = badgeText.toLowerCase();

  if (isFrench) {
    // French badge text: "Fermé" or "Ouvert"
    return lowerBadge === "ouvert";
  } else {
    // English badge text: "Closed" or "Open"
    return lowerBadge === "open";
  }
}

/**
 * Parses a single Montreal rinks page (English or French).
 */
function parseRinksPage(html: string, isFrench: boolean, baseUrl: string): Rink[] {
  const $ = cheerio.load(html);
  const rinks: Rink[] = [];

  // Each rink is in a li.list-element
  $("li.list-element").each((_index, element) => {
    const $element = $(element);

    // Type: strong.h4.mb-2
    const $typeElement = $element.find("strong.h4.mb-2");
    const type = $typeElement.text().trim();

    if (!type) {
      console.warn("Failed to parse rink: No type found");
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

    // Extract badge text to determine open/closed status
    const $badge = $firstInfoItem.find(".badge");
    const badgeText = $badge.text().trim();

    // Last updated: Extract from .list-item-content text after "Last updated" or "Mis à jour le"
    const $listItemContent = $firstInfoItem.find(".list-item-content");
    const contentText = $listItemContent.text();
    // Match pattern like "Last updated November 7 - 5:19 pm" or "Mis à jour le 4 janvier à 13 h 05" or "Mis à jour le 30 décembre à 6 h 03"
    const lastUpdatedPattern = isFrench
      ? /Mis à jour le\s+(\d+\s+[a-zéèêàùûôîç]+\s+à\s+\d+\s+h\s+\d+)/i
      : /Last updated\s+(\w+\s+\d+\s*-\s*\d+:\d+\s*(?:am|pm))/i;
    const lastUpdatedMatch = contentText.match(lastUpdatedPattern);
    let lastUpdatedRaw = "";
    let lastUpdated: Date | null = null;
    if (lastUpdatedMatch) {
      lastUpdatedRaw = lastUpdatedMatch[1]?.trim() || "";
      if (lastUpdatedRaw) {
        lastUpdated = parseLastUpdated(lastUpdatedRaw, isFrench);
      }
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
        lastUpdated,
        isOpen: determineIsOpen(badgeText, isFrench),
        name: name || "Unknown",
        hyperlink: hyperlink || baseUrl,
        address: address || "Unknown",
      });
    } else {
      console.warn("Failed to parse rink:");
      console.warn("address", address);
      console.warn("name", name);
      console.warn("hyperlink", hyperlink);
      console.warn("lastUpdatedRaw", lastUpdatedRaw);
      console.warn("lastUpdated", lastUpdated);
      console.warn("badgeText", badgeText);
      console.warn("isOpen", determineIsOpen(badgeText, isFrench));
      console.warn("type", type);
      console.warn("iceStatus", iceStatus);
      console.warn("name", name);
      console.warn("hyperlink", hyperlink);
    }
  });

  return rinks;
}

/**
 * Fetches and parses the Montreal skating rinks pages (both English and French).
 * Uses an in-memory cache to avoid scraping more than once every 5 minutes.
 * @returns Object with separate arrays for English and French rinks
 */
export async function parseMontrealRinks(): Promise<{
  readonly rinksEn: readonly Rink[];
  readonly rinksFr: readonly Rink[];
}> {
  // Check cache
  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_DURATION_MS) {
    return {
      rinksEn: cache.rinksEn,
      rinksFr: cache.rinksFr,
    };
  }

  // Cache expired or doesn't exist, fetch fresh data from both pages
  console.info(`[FETCH] Re-fetching Montreal rinks site (EN): ${MONTREAL_RINKS_URL_EN}`);
  console.info(`[FETCH] Re-fetching Montreal rinks site (FR): ${MONTREAL_RINKS_URL_FR}`);

  const [responseEn, responseFr] = await Promise.all([
    fetch(MONTREAL_RINKS_URL_EN),
    fetch(MONTREAL_RINKS_URL_FR),
  ]);

  if (!responseEn.ok) {
    throw new Error(
      `Failed to fetch English rinks page: ${responseEn.status} ${responseEn.statusText}`
    );
  }

  if (!responseFr.ok) {
    throw new Error(
      `Failed to fetch French rinks page: ${responseFr.status} ${responseFr.statusText}`
    );
  }

  const [htmlEn, htmlFr] = await Promise.all([responseEn.text(), responseFr.text()]);

  const rinksEn = parseRinksPage(htmlEn, false, MONTREAL_RINKS_URL_EN);
  const rinksFr = parseRinksPage(htmlFr, true, MONTREAL_RINKS_URL_FR);

  // Update cache with fresh data
  cache = {
    rinksEn,
    rinksFr,
    timestamp: Date.now(),
  };

  console.info(
    `[FETCH] Successfully parsed ${rinksEn.length} English rinks and ${rinksFr.length} French rinks from Montreal site`
  );
  return {
    rinksEn,
    rinksFr,
  };
}
