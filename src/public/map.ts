import Fuse from "fuse.js";
import type { FuseResultMatch, FuseResult } from "fuse.js";
import { MarkerClusterer, GridAlgorithm } from "@googlemaps/markerclusterer";

// Client-side type definitions (can't import from server-side types)
interface Rink {
  readonly type: string;
  readonly iceStatus: string;
  readonly lastUpdatedRaw: string;
  readonly isOpen: boolean;
  readonly name: string;
  readonly hyperlink: string;
  readonly address: string;
  readonly lat?: number;
  readonly lng?: number;
}

interface RinksResponse {
  readonly rinks: readonly Rink[];
}

interface MarkerWithData extends google.maps.Marker {
  rinkData: Rink[];
  filteredRinkData: Rink[]; // Rinks that match current filters
  locationKey: string;
}

let markers: MarkerWithData[] = [];
let infoWindows: google.maps.InfoWindow[] = [];
let map: google.maps.Map | null = null;
// MarkerClusterer is imported from CDN, types may not be fully available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let clusterer: any = null;
let rinks: readonly Rink[] = [];
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
let fuse: Fuse<Rink> | null = null;
let allTypes: readonly string[] = [];
// Map for fast rink lookup: key is "name|address|type"
const rinkIndexMap = new Map<string, number>();

/**
 * Initializes the Google Map.
 */
function initMap(): void {
  if (!map) {
    // Center map on Montreal
    const montreal = { lat: 45.5017, lng: -73.5673 };
    map = new google.maps.Map(document.getElementById("map") as HTMLElement, {
      zoom: 11,
      center: montreal,
      mapTypeControl: false,
      streetViewControl: false,
      styles: [
        {
          featureType: "poi",
          stylers: [{ visibility: "off" }],
        },
        {
          featureType: "poi.business",
          stylers: [{ visibility: "off" }],
        },
        {
          featureType: "poi.park",
          stylers: [{ visibility: "on" }],
        },
        {
          featureType: "transit",
          stylers: [{ visibility: "simplified" }],
        },
      ],
    });
  }

  // Render everything (filters rinks and creates markers)
  render();
}

/**
 * Formats a single rink for the sidebar list.
 */
function formatRink(
  rink: Rink,
  index: number,
  searchTerm: string,
  searchResult?: FuseResult<Rink>
): string {
  const statusClass = rink.isOpen ? "open" : "closed";

  // Get highlighted name and address if there's a search term
  let nameHtml = rink.name;
  let addressHtml = rink.address;

  if (searchTerm && searchResult) {
    const nameMatch = searchResult.matches?.find((m: FuseResultMatch) => m.key === "name");
    const addressMatch = searchResult.matches?.find((m: FuseResultMatch) => m.key === "address");

    if (nameMatch) {
      nameHtml = highlightText(rink.name, nameMatch);
    }
    if (addressMatch) {
      addressHtml = highlightText(rink.address, addressMatch);
    }
  }

  return `
    <div class="rink ${statusClass}" data-rink-index="${index}" data-is-open="${rink.isOpen}">
      <h3><a href="${rink.hyperlink}" target="_blank">${nameHtml}</a></h3>
      <p><strong>Type:</strong> ${rink.type}</p>
      <p><strong>Status:</strong> ${rink.iceStatus}</p>
      <p><strong>Last Updated:</strong> ${rink.lastUpdatedRaw}</p>
      <p><strong>Address:</strong> ${addressHtml}</p>
    </div>
  `;
}

/**
 * Formats a single rink's details (type, status, etc.) for display.
 */
function formatRinkDetails(rink: Rink, rinkNumber: number | null): string {
  const label = rinkNumber !== null ? `<strong>Rink ${rinkNumber}:</strong><br>` : "";
  return `
    <div style="margin-top: 8px;">
      ${label}
      <p style="margin: 4px 0; font-size: 0.9em;"><strong>Type:</strong> ${rink.type}</p>
      <p style="margin: 4px 0; font-size: 0.9em;"><strong>Status:</strong> ${rink.iceStatus}</p>
      <p style="margin: 4px 0; font-size: 0.9em;"><strong>Last Updated:</strong> ${rink.lastUpdatedRaw}</p>
      <p style="margin: 4px 0; font-size: 0.9em;">
        <strong>Open:</strong> 
        <span style="color: ${rink.isOpen ? "#27ae60" : "#e74c3c"};">
          ${rink.isOpen ? "Yes" : "No"}
        </span>
      </p>
    </div>
  `;
}

/**
 * Creates info window content for multiple rinks at the same location.
 */
function createInfoWindowContent(rinks: readonly Rink[]): string {
  if (rinks.length === 0) {
    return `<div style="padding: 10px;">No rink information available.</div>`;
  }

  const firstRink = rinks[0];
  const name = firstRink.name;
  const address = firstRink.address || "Unknown";

  if (rinks.length === 1) {
    // Single rink format: name, underline, address, type, status, etc.
    return `
      <div style="padding: 8px 10px 10px 10px; max-width: 350px;">
        <h3 style="margin: 0 0 6px 0; color: #2c3e50; font-size: 1.2em;">
          <a href="${firstRink.hyperlink}" target="_blank" style="color: #3498db; text-decoration: none;">
            ${name}
          </a>
        </h3>
        <hr style="margin: 6px 0; border: none; border-top: 1px solid #ddd;">
        <p style="margin: 6px 0; font-size: 0.9em;"><strong>Address:</strong> ${address}</p>
        <p style="margin: 4px 0; font-size: 0.9em;"><strong>Type:</strong> ${firstRink.type}</p>
        <p style="margin: 4px 0; font-size: 0.9em;"><strong>Status:</strong> ${firstRink.iceStatus}</p>
        <p style="margin: 4px 0; font-size: 0.9em;"><strong>Last Updated:</strong> ${firstRink.lastUpdatedRaw}</p>
        <p style="margin: 4px 0; font-size: 0.9em;">
          <strong>Open:</strong> 
          <span style="color: ${firstRink.isOpen ? "#27ae60" : "#e74c3c"};">
            ${firstRink.isOpen ? "Yes" : "No"}
          </span>
        </p>
      </div>
    `;
  }

  // Multiple rinks format: name, underline, address, then Rink 1, Rink 2, etc.
  const rinksDetails = rinks.map((rink, index) => formatRinkDetails(rink, index + 1)).join("");

  return `
    <div style="padding: 8px 10px 10px 10px; max-width: 350px; max-height: 400px; overflow-y: auto;">
      <h3 style="margin: 0 0 6px 0; color: #2c3e50; font-size: 1.2em;">
        <a href="${firstRink.hyperlink}" target="_blank" style="color: #3498db; text-decoration: none;">
          ${name}
        </a>
      </h3>
      <hr style="margin: 6px 0; border: none; border-top: 1px solid #ddd;">
      <p style="margin: 6px 0; font-size: 0.9em;"><strong>Address:</strong> ${address}</p>
      ${rinksDetails}
    </div>
  `;
}

interface PuckIconResult {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly anchorX: number;
  readonly anchorY: number;
}

/**
 * Creates a hockey puck SVG icon - 3D cylinder view.
 * Uses a "background puck" technique with blur for colored glow.
 * @param colors - Single color string or [leftColor, rightColor] for mixed glow
 * @param size - Size of the puck
 * @param uniqueId - Unique ID suffix for SVG defs (to avoid conflicts)
 */
function createHockeyPuckIcon(
  colors: string | readonly [string, string],
  size: number,
  uniqueId?: string
): PuckIconResult {
  const isMixed = Array.isArray(colors);
  const leftColor = isMixed ? colors[0] : colors;
  const rightColor = isMixed ? colors[1] : colors;
  const idSuffix =
    uniqueId ?? (isMixed ? `${leftColor}-${rightColor}` : leftColor).replace(/#/g, "");

  const radius = size / 2 - 4;
  const cx = size / 2;
  const puckHeight = radius * 0.6; // Height of the cylinder side
  const topY = size / 2 - 2; // Top ellipse center
  const ry = radius * 0.45; // Ellipse y-radius (perspective)
  const bottomY = topY + puckHeight; // Bottom ellipse center
  const glowSize = Math.max(2, size / 14); // Glow thickness

  // Inner puck is slightly smaller
  const innerRadius = radius - glowSize * 0.5;
  const innerRy = ry - glowSize * 0.25;
  const innerHeight = puckHeight - glowSize * 0.2;

  const svgWidth = size + glowSize * 2;
  const svgHeight = size + puckHeight + glowSize * 2;

  // Build clip paths for mixed mode
  const clipPathDefs = isMixed
    ? `
        <clipPath id="half-left-${idSuffix}">
          <rect x="0" y="0" width="${cx + glowSize}" height="${svgHeight}"/>
        </clipPath>
        <clipPath id="half-right-${idSuffix}">
          <rect x="${cx + glowSize}" y="0" width="${cx + glowSize}" height="${svgHeight}"/>
        </clipPath>`
    : "";

  // Build glow elements
  const glowElements = isMixed
    ? `
      <!-- OUTER (colored) puck with blur - half left -->
      <g filter="url(#glow-${idSuffix})" clip-path="url(#half-left-${idSuffix})">
        <rect x="${cx - radius + glowSize}" y="${topY + glowSize}" width="${radius * 2}" height="${puckHeight}" fill="${leftColor}"/>
        <ellipse cx="${cx + glowSize}" cy="${bottomY + glowSize}" rx="${radius}" ry="${ry}" fill="${leftColor}"/>
        <ellipse cx="${cx + glowSize}" cy="${topY + glowSize}" rx="${radius}" ry="${ry}" fill="${leftColor}"/>
      </g>
      
      <!-- OUTER (colored) puck with blur - half right -->
      <g filter="url(#glow-${idSuffix})" clip-path="url(#half-right-${idSuffix})">
        <rect x="${cx - radius + glowSize}" y="${topY + glowSize}" width="${radius * 2}" height="${puckHeight}" fill="${rightColor}"/>
        <ellipse cx="${cx + glowSize}" cy="${bottomY + glowSize}" rx="${radius}" ry="${ry}" fill="${rightColor}"/>
        <ellipse cx="${cx + glowSize}" cy="${topY + glowSize}" rx="${radius}" ry="${ry}" fill="${rightColor}"/>
      </g>`
    : `
      <!-- OUTER (colored) puck with blur - creates the glow -->
      <g filter="url(#glow-${idSuffix})">
        <rect x="${cx - radius + glowSize}" y="${topY + glowSize}" width="${radius * 2}" height="${puckHeight}" fill="${leftColor}"/>
        <ellipse cx="${cx + glowSize}" cy="${bottomY + glowSize}" rx="${radius}" ry="${ry}" fill="${leftColor}"/>
        <ellipse cx="${cx + glowSize}" cy="${topY + glowSize}" rx="${radius}" ry="${ry}" fill="${leftColor}"/>
      </g>`;

  // Create SVG with 3D hockey puck appearance
  const svg = `
    <svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        ${clipPathDefs}
        <linearGradient id="side-gradient-${idSuffix}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#3a3a3a;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1a1a1a;stop-opacity:1" />
        </linearGradient>
        <filter id="glow-${idSuffix}" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="${glowSize * 0.6}" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
          </feMerge>
        </filter>
      </defs>
      
      ${glowElements}
      
      <!-- INNER (dark) puck - on top -->
      <rect x="${cx - innerRadius + glowSize}" y="${topY + glowSize}" width="${innerRadius * 2}" height="${innerHeight}" fill="url(#side-gradient-${idSuffix})"/>
      <ellipse cx="${cx + glowSize}" cy="${topY + innerHeight + glowSize}" rx="${innerRadius}" ry="${innerRy}" fill="#1a1a1a"/>
      <ellipse cx="${cx + glowSize}" cy="${topY + glowSize}" rx="${innerRadius}" ry="${innerRy}" fill="#2a2a2a"/>
      
      <!-- Shine - tapered arc following near edge of ellipse, ~150 degrees -->
      <path d="M ${cx - innerRadius * 0.96 + glowSize},${topY + innerRy * 0.26 + glowSize} 
               A ${innerRadius},${innerRy} 0 0,0 ${cx + innerRadius * 0.96 + glowSize},${topY + innerRy * 0.26 + glowSize}
               A ${innerRadius * 0.85},${innerRy * 0.75} 0 0,1 ${cx - innerRadius * 0.96 + glowSize},${topY + innerRy * 0.26 + glowSize}
               Z" 
            fill="rgba(255,255,255,0.45)"/>
    </svg>
  `;

  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    width: svgWidth,
    height: svgHeight,
    anchorX: svgWidth / 2,
    anchorY: topY + glowSize, // Anchor at top of puck
  };
}

/**
 * Renders markers from filtered rinks, grouping by location.
 */
function renderMarkers(filteredRinks: readonly FilteredRink[]): void {
  if (!map) {
    return;
  }

  // Clear existing markers and clusterer
  if (clusterer) {
    clusterer.clearMarkers();
    clusterer = null;
  }
  markers.forEach((marker) => marker.setMap(null));
  markers = [];
  infoWindows = [];

  // Filter out rinks without coordinates
  const geocodedFilteredRinks = filteredRinks.filter(
    ({ rink }) => rink.lat !== undefined && rink.lng !== undefined
  );

  if (geocodedFilteredRinks.length === 0) {
    return;
  }

  // Group filtered rinks by location (lat, lng)
  const locationGroups = new Map<string, Rink[]>();
  for (const { rink } of geocodedFilteredRinks) {
    if (rink.lat !== undefined && rink.lng !== undefined) {
      const locationKey = `${rink.lat.toFixed(6)},${rink.lng.toFixed(6)}`;
      const existing = locationGroups.get(locationKey);
      if (existing) {
        existing.push(rink);
      } else {
        locationGroups.set(locationKey, [rink]);
      }
    }
  }

  // Create one marker per location
  for (const [locationKey, rinksAtLocation] of locationGroups) {
    const firstRink = rinksAtLocation[0];
    if (!firstRink || firstRink.lat === undefined || firstRink.lng === undefined) {
      continue;
    }

    // Determine marker color based on rinks (green if any open, red if all closed)
    const hasOpenRink = rinksAtLocation.some((r) => r.isOpen);
    const markerColor = hasOpenRink ? "#27ae60" : "#a93226"; // Darker red for closed

    // Create title with all rink names
    const title =
      rinksAtLocation.length > 1
        ? `${rinksAtLocation.length} rinks: ${rinksAtLocation.map((r) => r.name).join(", ")}`
        : firstRink.name;

    // Create hockey puck icon
    const iconSize = rinksAtLocation.length > 1 ? 40 : 36; // Slightly larger if multiple rinks
    const puckIcon = createHockeyPuckIcon(markerColor, iconSize);

    // Create marker
    const marker = new google.maps.Marker({
      position: { lat: firstRink.lat, lng: firstRink.lng },
      map,
      title,
      icon: {
        url: puckIcon.url,
        scaledSize: new google.maps.Size(puckIcon.width, puckIcon.height),
        anchor: new google.maps.Point(puckIcon.anchorX, puckIcon.anchorY),
      },
      optimized: true, // Use optimized rendering for better performance
    }) as MarkerWithData;

    // Store all rinks at this location
    marker.rinkData = rinksAtLocation;
    marker.filteredRinkData = rinksAtLocation; // All rinks in marker are already filtered
    marker.locationKey = locationKey;

    // Create info window lazily on click
    marker.addListener("click", () => {
      // Close all existing info windows
      infoWindows.forEach((iw) => iw.close());

      // Create info window content only when needed
      const content = createInfoWindowContent(rinksAtLocation);
      const infoWindow = new google.maps.InfoWindow({ content });
      infoWindow.open(map, marker);

      // Store reference to close later
      infoWindows.push(infoWindow);
    });

    markers.push(marker);
  }

  // Initialize MarkerClusterer with all markers and custom renderer
  if (markers.length > 0 && map) {
    clusterer = new MarkerClusterer({
      map,
      markers,
      algorithm: new GridAlgorithm({
        gridSize: 100, // Larger grid cells for more aggressive clustering
        maxZoom: 14, // Keep markers clustered until zoom level 14 or higher
      }),
      renderer: {
        render: (cluster, _stats, _map) => {
          // Count filtered rinks and determine color using pre-filtered data
          let hasOpenRink = false;
          let hasClosedRink = false;
          let filteredRinkCount = 0;

          for (const marker of cluster.markers) {
            const markerWithData = marker as MarkerWithData;
            if (markerWithData.filteredRinkData) {
              for (const rink of markerWithData.filteredRinkData) {
                filteredRinkCount++;
                if (rink.isOpen) {
                  hasOpenRink = true;
                } else {
                  hasClosedRink = true;
                }
              }
            }
          }

          const isMixed = hasOpenRink && hasClosedRink;
          // Create hockey puck icon for cluster
          const clusterSize = 48;
          const puckColors: string | readonly [string, string] = isMixed
            ? (["#27ae60", "#a93226"] as const) // Green left, red right
            : hasOpenRink
              ? "#27ae60"
              : "#a93226"; // Darker red for closed

          const puckIcon = createHockeyPuckIcon(
            puckColors,
            clusterSize,
            `cluster-${cluster.count}`
          );

          // Get position from cluster - calculate from markers if not available
          let position: google.maps.LatLngLiteral = { lat: 0, lng: 0 };
          if (cluster.position) {
            const pos = cluster.position as google.maps.LatLng | google.maps.LatLngLiteral;
            if (pos instanceof google.maps.LatLng) {
              position = { lat: pos.lat(), lng: pos.lng() };
            } else {
              position = { lat: pos.lat, lng: pos.lng };
            }
          } else if (cluster.markers.length > 0) {
            // Calculate center from markers
            const firstMarker = cluster.markers[0] as MarkerWithData;
            const markerPos = firstMarker.getPosition();
            if (markerPos) {
              position = { lat: markerPos.lat(), lng: markerPos.lng() };
            }
          }

          // Create cluster marker
          const clusterMarker = new google.maps.Marker({
            position: position,
            icon: {
              url: puckIcon.url,
              scaledSize: new google.maps.Size(puckIcon.width, puckIcon.height),
              anchor: new google.maps.Point(puckIcon.anchorX, puckIcon.anchorY),
            },
            label: {
              text: filteredRinkCount.toString(),
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: "bold",
            },
            zIndex: Number(google.maps.Marker.MAX_ZINDEX) + cluster.count,
          });

          return clusterMarker;
        },
      },
    });
  }
}

/**
 * Highlights matching text in a string based on Fuse.js match indices.
 */
function highlightText(text: string, match: FuseResultMatch | undefined): string {
  if (!match || !match.indices || match.indices.length === 0) {
    return text;
  }

  // Collect all match ranges and sort by start position
  // Fuse.js indices are [start, end] where end is inclusive
  const ranges: Array<{ start: number; end: number }> = [];
  for (const [start, end] of match.indices) {
    ranges.push({ start, end: end + 1 }); // end + 1 because slice is exclusive
  }

  // Sort by start position
  ranges.sort((a, b) => a.start - b.start);

  // Merge overlapping ranges
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of ranges) {
    if (merged.length === 0 || (merged[merged.length - 1]?.end ?? 0) < range.start) {
      merged.push(range);
    } else {
      const last = merged[merged.length - 1];
      if (last) {
        last.end = Math.max(last.end, range.end);
      }
    }
  }

  // Build highlighted string by working backwards to avoid index shifting
  // This ensures we don't create gaps when inserting HTML
  const parts: Array<{ text: string; highlight: boolean }> = [];
  let lastIndex = 0;

  for (const range of merged) {
    // Add text before the highlight
    if (range.start > lastIndex) {
      parts.push({ text: text.slice(lastIndex, range.start), highlight: false });
    }
    // Add highlighted text
    parts.push({ text: text.slice(range.start, range.end), highlight: true });
    lastIndex = range.end;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlight: false });
  }

  // Build final string
  return parts
    .map((part) => (part.highlight ? `<span class="highlight">${part.text}</span>` : part.text))
    .join("");
}

/**
 * Updates URL query parameters with current filter state.
 */
function updateUrlParams(
  showOpenOnly: boolean,
  showMultipleRinks: boolean,
  selectedTypes: readonly string[],
  searchTerm: string
): void {
  const params = new URLSearchParams();

  if (showOpenOnly) {
    params.set("open", "true");
  }

  if (showMultipleRinks) {
    params.set("multiple", "true");
  }

  if (selectedTypes.length > 0 && selectedTypes.length < allTypes.length) {
    params.set("types", selectedTypes.join(","));
  }

  if (searchTerm) {
    params.set("search", searchTerm);
  }

  const newUrl = params.toString()
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;

  window.history.replaceState({}, "", newUrl);
}

/**
 * Reads filter state from URL query parameters.
 */
function readUrlParams(): {
  showOpenOnly: boolean;
  showMultipleRinks: boolean;
  selectedTypes: readonly string[];
  searchTerm: string;
} {
  const params = new URLSearchParams(window.location.search);
  const typesParam = params.get("types");
  const selectedTypes = typesParam ? typesParam.split(",").filter((t) => t.trim().length > 0) : [];
  return {
    showOpenOnly: params.get("open") === "true",
    showMultipleRinks: params.get("multiple") === "true",
    selectedTypes,
    searchTerm: params.get("search") || "",
  };
}

interface FilterState {
  readonly showOpenOnly: boolean;
  readonly showMultipleRinks: boolean;
  readonly selectedTypes: readonly string[];
  readonly searchTerm: string;
}

interface FilteredRink {
  readonly rink: Rink;
  readonly index: number;
  readonly searchScore: number;
  readonly searchResult?: FuseResult<Rink>;
}

/**
 * Pure function: Filters rinks based on filter state.
 * Returns filtered rinks with search scores and results.
 */
function filterRinks(
  allRinks: readonly Rink[],
  filterState: FilterState,
  fuseInstance: Fuse<Rink> | null
): readonly FilteredRink[] {
  const { showOpenOnly, selectedTypes, searchTerm } = filterState;

  // Step 1: Apply search filter
  let matchedRinks: Set<number> = new Set();
  let rinkScores: Map<number, number> = new Map();
  let searchResults: Array<FuseResult<Rink>> = [];

  if (searchTerm && fuseInstance) {
    searchResults = fuseInstance.search(searchTerm);
    for (const result of searchResults) {
      const index = allRinks.indexOf(result.item);
      if (index !== -1) {
        matchedRinks.add(index);
        rinkScores.set(index, result.score ?? 1);
      }
    }
  } else {
    // If no search term, all rinks match
    allRinks.forEach((_rink, index) => {
      matchedRinks.add(index);
      rinkScores.set(index, 0);
    });
  }

  // Step 2: Apply all filters
  const filtered: FilteredRink[] = [];

  allRinks.forEach((rink, index) => {
    // Check if rink matches search
    if (!matchedRinks.has(index)) {
      return;
    }

    // Check type filter
    if (selectedTypes.length > 0 && !selectedTypes.includes(rink.type)) {
      return;
    }

    // Check open filter
    if (showOpenOnly && !rink.isOpen) {
      return;
    }

    // Rink passes all filters
    const searchResult = searchTerm ? searchResults.find((r) => r.item === rink) : undefined;
    filtered.push({
      rink,
      index,
      searchScore: rinkScores.get(index) ?? 1,
      searchResult,
    });
  });

  // Step 3: Sort by relevance score (lower is better) and then by index for stable sorting
  filtered.sort((a, b) => {
    if (a.searchScore !== b.searchScore) {
      return a.searchScore - b.searchScore;
    }
    return a.index - b.index;
  });

  return filtered;
}

/**
 * Generates HTML for the rinks list based on filtered rinks.
 */
function generateRinksListHtml(filteredRinks: readonly FilteredRink[], searchTerm: string): string {
  const rinkHtmls = filteredRinks.map(({ rink, index, searchResult }) => {
    return formatRink(rink, index, searchTerm, searchResult);
  });

  return rinkHtmls.join("");
}

/**
 * Gets current filter state from the DOM.
 */
function getFilterState(): FilterState | null {
  const checkbox = document.getElementById("show-open-only") as HTMLInputElement;
  const multipleRinksCheckbox = document.getElementById("show-multiple-rinks") as HTMLInputElement;
  const searchInput = document.getElementById("search-input") as HTMLInputElement;
  const typeSelect = document.getElementById("type-filter") as HTMLSelectElement;

  if (!checkbox || !multipleRinksCheckbox || !typeSelect || rinks.length === 0) {
    return null;
  }

  const selectedTypes = Array.from(typeSelect.selectedOptions)
    .map((option: HTMLOptionElement) => option.value)
    .filter((value) => value !== ""); // Filter out empty "All types" option

  return {
    showOpenOnly: checkbox.checked,
    showMultipleRinks: multipleRinksCheckbox.checked,
    selectedTypes,
    searchTerm: searchInput?.value.trim() || "",
  };
}

/**
 * Renders the entire page: filters rinks and updates both list and markers.
 */
function render(): void {
  const filterState = getFilterState();
  if (!filterState) {
    return;
  }

  // Update URL with current filter state
  updateUrlParams(
    filterState.showOpenOnly,
    filterState.showMultipleRinks,
    filterState.selectedTypes,
    filterState.searchTerm
  );

  // Step 1: Filter rinks (pure function)
  let filteredRinks = filterRinks(rinks, filterState, fuse);

  // Step 2: Apply "show multiple rinks" filter
  if (filterState.showMultipleRinks) {
    // Group filtered rinks by location to count how many are at each location
    const locationGroups = new Map<string, FilteredRink[]>();
    for (const filteredRink of filteredRinks) {
      const { rink } = filteredRink;
      if (rink.lat !== undefined && rink.lng !== undefined) {
        const locationKey = `${rink.lat.toFixed(6)},${rink.lng.toFixed(6)}`;
        const existing = locationGroups.get(locationKey);
        if (existing) {
          existing.push(filteredRink);
        } else {
          locationGroups.set(locationKey, [filteredRink]);
        }
      }
    }

    // Only keep rinks at locations with multiple rinks
    filteredRinks = filteredRinks.filter(({ rink }) => {
      if (rink.lat === undefined || rink.lng === undefined) {
        return false;
      }
      const locationKey = `${rink.lat.toFixed(6)},${rink.lng.toFixed(6)}`;
      const group = locationGroups.get(locationKey);
      return group !== undefined && group.length > 1;
    });
  }

  // Step 3: Render rinks list
  const rinksListHtml = generateRinksListHtml(filteredRinks, filterState.searchTerm);

  // Update desktop list
  const rinksListContainer = document.querySelector(".rinks-list");
  if (rinksListContainer) {
    rinksListContainer.innerHTML = rinksListHtml;
  }

  // Update modal list
  const modalRinksListContainer = document.getElementById("modal-rinks-list");
  if (modalRinksListContainer) {
    modalRinksListContainer.innerHTML = rinksListHtml;
  }

  // Step 4: Render markers (only if map is ready)
  if (map) {
    renderMarkers(filteredRinks);
  }
}

/**
 * Applies the filter - triggers a full re-render.
 */
function applyFilter(): void {
  render();
}

/**
 * Debounced search function.
 */
function handleSearch(): void {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  searchTimeout = setTimeout(() => {
    applyFilter();
    updateClearButton();
  }, 300);
}

/**
 * Updates the visibility of the clear button based on search input value.
 */
function updateClearButton(): void {
  const searchInput = document.getElementById("search-input") as HTMLInputElement;
  const modalSearchInput = document.getElementById("modal-search-input") as HTMLInputElement;
  const clearButton = document.getElementById("search-clear");
  const modalClearButton = document.getElementById("modal-search-clear");

  if (searchInput && clearButton) {
    if (searchInput.value.trim()) {
      clearButton.classList.remove("hidden");
    } else {
      clearButton.classList.add("hidden");
    }
  }

  if (modalSearchInput && modalClearButton) {
    if (modalSearchInput.value.trim()) {
      modalClearButton.classList.remove("hidden");
    } else {
      modalClearButton.classList.add("hidden");
    }
  }
}

/**
 * Clears the search input and applies the filter.
 */
function clearSearch(): void {
  const searchInput = document.getElementById("search-input") as HTMLInputElement;
  const modalSearchInput = document.getElementById("modal-search-input") as HTMLInputElement;
  if (searchInput) {
    searchInput.value = "";
  }
  if (modalSearchInput) {
    modalSearchInput.value = "";
  }
  updateClearButton();
  applyFilter();
}

/**
 * Opens the mobile filter modal.
 */
function openModal(): void {
  const overlay = document.getElementById("modal-overlay");
  if (overlay) {
    overlay.classList.add("open");
    document.body.style.overflow = "hidden"; // Prevent body scroll
    syncFiltersToModal();
  }
}

/**
 * Closes the mobile filter modal.
 */
function closeModal(): void {
  const overlay = document.getElementById("modal-overlay");
  if (overlay) {
    overlay.classList.remove("open");
    document.body.style.overflow = ""; // Restore body scroll
  }
}

/**
 * Syncs desktop filter values to modal filters.
 */
function syncFiltersToModal(): void {
  const desktopCheckbox = document.getElementById("show-open-only") as HTMLInputElement;
  const desktopMultipleCheckbox = document.getElementById(
    "show-multiple-rinks"
  ) as HTMLInputElement;
  const desktopTypeSelect = document.getElementById("type-filter") as HTMLSelectElement;
  const desktopSearchInput = document.getElementById("search-input") as HTMLInputElement;

  const modalCheckbox = document.getElementById("modal-show-open-only") as HTMLInputElement;
  const modalMultipleCheckbox = document.getElementById(
    "modal-show-multiple-rinks"
  ) as HTMLInputElement;
  const modalTypeSelect = document.getElementById("modal-type-filter") as HTMLSelectElement;
  const modalSearchInput = document.getElementById("modal-search-input") as HTMLInputElement;

  if (desktopCheckbox && modalCheckbox) {
    modalCheckbox.checked = desktopCheckbox.checked;
  }
  if (desktopMultipleCheckbox && modalMultipleCheckbox) {
    modalMultipleCheckbox.checked = desktopMultipleCheckbox.checked;
  }
  if (desktopTypeSelect && modalTypeSelect) {
    // Sync type selections
    Array.from(desktopTypeSelect.options).forEach((option, index) => {
      if (modalTypeSelect.options[index]) {
        modalTypeSelect.options[index].selected = option.selected;
      }
    });
  }
  if (desktopSearchInput && modalSearchInput) {
    modalSearchInput.value = desktopSearchInput.value;
  }

  // Apply filter to update both desktop and modal lists
  applyFilter();
}

/**
 * Syncs modal filter values to desktop filters and applies them.
 */
function syncFiltersFromModal(): void {
  const desktopCheckbox = document.getElementById("show-open-only") as HTMLInputElement;
  const desktopMultipleCheckbox = document.getElementById(
    "show-multiple-rinks"
  ) as HTMLInputElement;
  const desktopTypeSelect = document.getElementById("type-filter") as HTMLSelectElement;
  const desktopSearchInput = document.getElementById("search-input") as HTMLInputElement;

  const modalCheckbox = document.getElementById("modal-show-open-only") as HTMLInputElement;
  const modalMultipleCheckbox = document.getElementById(
    "modal-show-multiple-rinks"
  ) as HTMLInputElement;
  const modalTypeSelect = document.getElementById("modal-type-filter") as HTMLSelectElement;
  const modalSearchInput = document.getElementById("modal-search-input") as HTMLInputElement;

  if (modalCheckbox && desktopCheckbox) {
    desktopCheckbox.checked = modalCheckbox.checked;
  }
  if (modalMultipleCheckbox && desktopMultipleCheckbox) {
    desktopMultipleCheckbox.checked = modalMultipleCheckbox.checked;
  }
  if (modalTypeSelect && desktopTypeSelect) {
    // Sync type selections
    Array.from(modalTypeSelect.options).forEach((option, index) => {
      if (desktopTypeSelect.options[index]) {
        desktopTypeSelect.options[index].selected = option.selected;
      }
    });
  }
  if (modalSearchInput && desktopSearchInput) {
    desktopSearchInput.value = modalSearchInput.value;
  }
  applyFilter();
}

/**
 * Initializes the application by fetching rinks data and setting up the map.
 */
async function init(): Promise<void> {
  try {
    // Fetch rinks data from API
    const response = await fetch("/api/rinks");
    if (!response.ok) {
      throw new Error(`Failed to fetch rinks: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as RinksResponse;
    rinks = data.rinks;

    // Extract unique types and sort them
    const typeSet = new Set<string>();
    rinks.forEach((rink) => {
      typeSet.add(rink.type);
    });
    allTypes = Array.from(typeSet).sort();

    // Build index map for fast rink lookups (O(1) instead of O(n))
    rinkIndexMap.clear();
    rinks.forEach((rink, index) => {
      const key = `${rink.name}|${rink.address}|${rink.type}`;
      rinkIndexMap.set(key, index);
    });

    // Initialize Fuse.js for fuzzy search
    fuse = new Fuse(Array.from(rinks), {
      keys: ["name", "address", "type", "iceStatus"],
      threshold: 0.4, // 0.0 = perfect match, 1.0 = match anything
      includeMatches: true,
      minMatchCharLength: 2,
    });

    // Update geocoded count in stats
    const geocodedCountElement = document.getElementById("geocoded-count");
    if (geocodedCountElement) {
      geocodedCountElement.textContent = rinks.length.toString();
    }

    // Read filter state from URL
    const urlParams = readUrlParams();

    // Populate the rinks list immediately (before map is ready)
    applyFilter();

    // Populate type filter dropdown
    const typeSelect = document.getElementById("type-filter") as HTMLSelectElement;
    if (typeSelect) {
      // Clear existing options except the first "All types" option
      while (typeSelect.options.length > 1) {
        typeSelect.remove(1);
      }

      // Add type options
      allTypes.forEach((type) => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type;
        typeSelect.appendChild(option);
      });

      // Set selected types from URL
      if (urlParams.selectedTypes.length > 0) {
        Array.from(typeSelect.options).forEach((option) => {
          option.selected = urlParams.selectedTypes.includes(option.value);
        });
      }

      typeSelect.addEventListener("change", applyFilter);
    }

    // Set up other filter controls
    const checkbox = document.getElementById("show-open-only") as HTMLInputElement;
    const multipleRinksCheckbox = document.getElementById(
      "show-multiple-rinks"
    ) as HTMLInputElement;
    const searchInput = document.getElementById("search-input") as HTMLInputElement;

    if (checkbox) {
      checkbox.checked = urlParams.showOpenOnly;
      checkbox.addEventListener("change", applyFilter);
    }

    if (multipleRinksCheckbox) {
      multipleRinksCheckbox.checked = urlParams.showMultipleRinks;
      multipleRinksCheckbox.addEventListener("change", applyFilter);
    }

    if (searchInput) {
      searchInput.value = urlParams.searchTerm;
      searchInput.addEventListener("input", handleSearch);
    }

    // Set up clear button
    const clearButton = document.getElementById("search-clear");
    if (clearButton) {
      clearButton.addEventListener("click", clearSearch);
      updateClearButton();
    }

    // Set up modal handlers
    const floatingFilterBtn = document.getElementById("floating-filter-btn");
    const modalOverlay = document.getElementById("modal-overlay");
    const modalClose = document.getElementById("modal-close");

    if (floatingFilterBtn) {
      floatingFilterBtn.addEventListener("click", openModal);
    }

    if (modalClose) {
      modalClose.addEventListener("click", closeModal);
    }

    if (modalOverlay) {
      modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) {
          closeModal();
        }
      });
    }

    // Set up modal filter controls to sync with desktop
    const modalCheckbox = document.getElementById("modal-show-open-only") as HTMLInputElement;
    const modalMultipleCheckbox = document.getElementById(
      "modal-show-multiple-rinks"
    ) as HTMLInputElement;
    const modalTypeSelect = document.getElementById("modal-type-filter") as HTMLSelectElement;
    const modalSearchInput = document.getElementById("modal-search-input") as HTMLInputElement;
    const modalSearchClear = document.getElementById("modal-search-clear");

    if (modalCheckbox) {
      modalCheckbox.addEventListener("change", () => {
        syncFiltersFromModal();
      });
    }

    if (modalMultipleCheckbox) {
      modalMultipleCheckbox.addEventListener("change", () => {
        syncFiltersFromModal();
      });
    }

    if (modalTypeSelect) {
      // Populate modal type select
      allTypes.forEach((type) => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type;
        modalTypeSelect.appendChild(option);
      });

      modalTypeSelect.addEventListener("change", () => {
        syncFiltersFromModal();
      });
    }

    if (modalSearchInput) {
      modalSearchInput.addEventListener("input", () => {
        syncFiltersFromModal();
        handleSearch();
      });
    }

    if (modalSearchClear) {
      modalSearchClear.addEventListener("click", clearSearch);
    }

    // Handle browser back/forward navigation
    window.addEventListener("popstate", () => {
      const urlParams = readUrlParams();
      if (checkbox) {
        checkbox.checked = urlParams.showOpenOnly;
      }
      if (multipleRinksCheckbox) {
        multipleRinksCheckbox.checked = urlParams.showMultipleRinks;
      }
      if (typeSelect) {
        Array.from(typeSelect.options).forEach((option) => {
          option.selected = urlParams.selectedTypes.includes(option.value);
        });
      }
      if (searchInput) {
        searchInput.value = urlParams.searchTerm;
      }
      updateClearButton();
      applyFilter();
    });

    // Initialize map when Google Maps is ready
    // Filters will be applied automatically after markers are created
    if (typeof google !== "undefined" && google.maps) {
      initMap();
    } else {
      window.addEventListener("load", () => {
        if (typeof google !== "undefined" && google.maps) {
          initMap();
        }
      });
    }
  } catch (error) {
    console.error("Error initializing map:", error);
  }
}

// Start initialization when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  void init();
}
