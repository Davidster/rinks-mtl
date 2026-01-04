import Fuse from "fuse.js";
import type { FuseResultMatch, FuseResult } from "fuse.js";

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
  readonly allRinks: readonly Rink[];
  readonly geocodedRinks: readonly Rink[];
}

interface MarkerWithData extends google.maps.Marker {
  rinkData: Rink[];
  locationKey: string;
}

let markers: MarkerWithData[] = [];
let infoWindows: google.maps.InfoWindow[] = [];
let map: google.maps.Map | null = null;
let geocodedRinks: readonly Rink[] = [];
let allRinks: readonly Rink[] = [];
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

  createMarkers();
  
  // Apply filters after markers are created
  applyFilter();
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

/**
 * Creates markers for all geocoded rinks, grouping by location.
 */
function createMarkers(): void {
  if (!map || geocodedRinks.length === 0) {
    return;
  }

  // Clear existing markers
  markers.forEach((marker) => marker.setMap(null));
  markers = [];
  infoWindows = [];

  // Group rinks by location (lat, lng)
  const locationGroups = new Map<string, Rink[]>();
  for (const rink of geocodedRinks) {
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
  for (const [locationKey, rinks] of locationGroups) {
    const firstRink = rinks[0];
    if (!firstRink || firstRink.lat === undefined || firstRink.lng === undefined) {
      continue;
    }

    // Determine marker color based on rinks (green if any open, red if all closed)
    const hasOpenRink = rinks.some((r) => r.isOpen);
    const markerColor = hasOpenRink ? "#27ae60" : "#e74c3c";

    // Create title with all rink names
    const title =
      rinks.length > 1
        ? `${rinks.length} rinks: ${rinks.map((r) => r.name).join(", ")}`
        : firstRink.name;

    // Don't create info window content upfront - create it lazily on click
    const marker = new google.maps.Marker({
      position: { lat: firstRink.lat, lng: firstRink.lng },
      map: null, // Don't add to map yet, we'll filter
      title,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: rinks.length > 1 ? 10 : 8, // Slightly larger if multiple rinks
        fillColor: markerColor,
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
      optimized: true, // Use optimized rendering for better performance
    }) as MarkerWithData;

    // Store all rinks at this location
    marker.rinkData = rinks;
    marker.locationKey = locationKey;

    // Create info window lazily on click
    marker.addListener("click", () => {
      // Close all existing info windows
      infoWindows.forEach((iw) => iw.close());

      // Create info window content only when needed
      const content = createInfoWindowContent(rinks);
      const infoWindow = new google.maps.InfoWindow({ content });
      infoWindow.open(map, marker);

      // Store reference to close later
      infoWindows.push(infoWindow);
    });

    markers.push(marker);
  }

  // Apply initial filter
  applyFilter();
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
  const selectedTypes = typesParam
    ? typesParam.split(",").filter((t) => t.trim().length > 0)
    : [];
  return {
    showOpenOnly: params.get("open") === "true",
    showMultipleRinks: params.get("multiple") === "true",
    selectedTypes,
    searchTerm: params.get("search") || "",
  };
}

/**
 * Applies the filter to both sidebar list and map markers.
 */
function applyFilter(): void {
  const checkbox = document.getElementById("show-open-only") as HTMLInputElement;
  const multipleRinksCheckbox = document.getElementById("show-multiple-rinks") as HTMLInputElement;
  const searchInput = document.getElementById("search-input") as HTMLInputElement;

  const typeSelect = document.getElementById("type-filter") as HTMLSelectElement;
  if (!checkbox || !multipleRinksCheckbox || !typeSelect || allRinks.length === 0) {
    // If no rinks data yet, show all markers (no filtering)
    markers.forEach((marker) => {
      marker.setMap(map);
    });
    return;
  }

  const showOpenOnly = checkbox.checked;
  const showMultipleRinks = multipleRinksCheckbox.checked;
  const selectedTypes = Array.from(typeSelect.selectedOptions)
    .map((option: HTMLOptionElement) => option.value)
    .filter((value) => value !== ""); // Filter out empty "All types" option
  const searchTerm = searchInput?.value.trim() || "";

  // Update URL with current filter state
  updateUrlParams(showOpenOnly, showMultipleRinks, selectedTypes, searchTerm);

  // Perform fuzzy search if there's a search term
  let searchResults: Array<FuseResult<Rink>> = [];
  let matchedRinks: Set<number> = new Set();
  let rinkScores: Map<number, number> = new Map();

  if (searchTerm) {
    if (!fuse) {
      // If fuse not ready, show all markers
      markers.forEach((marker) => {
        if (showMultipleRinks && marker.rinkData.length <= 1) {
          marker.setMap(null);
          return;
        }
        if (selectedTypes.length > 0) {
          const hasMatchingType = marker.rinkData.some((r) =>
            selectedTypes.includes(r.type)
          );
          if (!hasMatchingType) {
            marker.setMap(null);
            return;
          }
        }
        const hasOpenRink = marker.rinkData.some((r) => r.isOpen);
        const shouldShow = !showOpenOnly || hasOpenRink;
        if (shouldShow) {
          marker.setMap(map);
        } else {
          marker.setMap(null);
        }
      });
      return;
    }
    searchResults = fuse.search(searchTerm);
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

  // Get rinks list container for sorting
  const rinksListContainer = document.querySelector(".rinks-list");
  if (!rinksListContainer) {
    return;
  }

  // Filter and sort sidebar list
  const rinkElements = Array.from(document.querySelectorAll(".rink"));
  const visibleElements: Array<{ element: Element; index: number; score: number }> = [];

  rinkElements.forEach((element) => {
    const rinkIndex = Number.parseInt(element.getAttribute("data-rink-index") || "0", 10);
    const rink = allRinks[rinkIndex];

    if (!rink) {
      return;
    }

    const isOpen = element.getAttribute("data-is-open") === "true";
    const matches = matchedRinks.has(rinkIndex);
    const matchesType =
      selectedTypes.length === 0 || selectedTypes.includes(rink.type);
    const shouldShow = (!showOpenOnly || isOpen) && matches && matchesType;

    if (shouldShow) {
      const score = rinkScores.get(rinkIndex) ?? 1;
      visibleElements.push({ element, index: rinkIndex, score });
    } else {
      element.classList.add("hidden");
    }
  });

  // Sort by relevance score (lower is better) and then by index for stable sorting
  visibleElements.sort((a, b) => {
    if (a.score !== b.score) {
      return a.score - b.score;
    }
    return a.index - b.index;
  });

  // Reorder DOM elements and update highlights
  for (const { element, index } of visibleElements) {
    element.classList.remove("hidden");
    rinksListContainer.appendChild(element);

    const rink = allRinks[index];
    if (!rink) {
      continue;
    }

    // Update highlights based on search results
    if (searchTerm) {
      const result = searchResults.find((r) => r.item === rink);
      if (result) {
        // Find name matches
        const nameMatch = result.matches?.find((m: FuseResultMatch) => m.key === "name");
        const nameLink = element.querySelector("h3 a");
        if (nameLink) {
          nameLink.innerHTML = highlightText(rink.name, nameMatch);
        }

        // Find address matches
        const addressMatch = result.matches?.find((m: FuseResultMatch) => m.key === "address");
        const paragraphs = Array.from(element.querySelectorAll("p"));
        const addressP = paragraphs.find((p) => (p.textContent || "").includes("Address:"));
        if (addressP) {
          const strong = addressP.querySelector("strong");
          if (strong) {
            addressP.innerHTML = `${strong.outerHTML} ${highlightText(rink.address, addressMatch)}`;
          }
        }
      }
    } else {
      // Remove highlights when search is cleared
      const nameLink = element.querySelector("h3 a");
      if (nameLink) {
        nameLink.innerHTML = rink.name;
      }

      const paragraphs = Array.from(element.querySelectorAll("p"));
      const addressP = paragraphs.find((p) => p.textContent?.includes("Address:") ?? false);
      if (addressP) {
        const strong = addressP.querySelector("strong");
        if (strong) {
          addressP.innerHTML = `${strong.outerHTML} ${rink.address}`;
        }
      }
    }
  }

  // Filter map markers - optimized to avoid unnecessary setMap calls
  markers.forEach((marker) => {
    // Check multiple rinks filter first (fast check)
    if (showMultipleRinks && marker.rinkData.length <= 1) {
      const isCurrentlyVisible = marker.getMap() !== null;
      if (isCurrentlyVisible) {
        marker.setMap(null);
      }
      return;
    }

    // Check type filter
    if (selectedTypes.length > 0) {
      const hasMatchingType = marker.rinkData.some((rink) =>
        selectedTypes.includes(rink.type)
      );
      if (!hasMatchingType) {
        const isCurrentlyVisible = marker.getMap() !== null;
        if (isCurrentlyVisible) {
          marker.setMap(null);
        }
        return;
      }
    }

    // Check if any rink at this location matches the filters
    // Use the pre-built index map for O(1) lookup instead of O(n) findIndex
    let hasMatchingRink = false;
    let hasOpenRink = false;

    for (const rink of marker.rinkData) {
      const rinkKey = `${rink.name}|${rink.address}|${rink.type}`;
      const rinkIndex = rinkIndexMap.get(rinkKey);

      if (rinkIndex !== undefined && matchedRinks.has(rinkIndex)) {
        hasMatchingRink = true;
        if (rink.isOpen) {
          hasOpenRink = true;
          break; // Early exit if we found an open rink
        }
      }
    }

    const shouldShow = hasMatchingRink && (!showOpenOnly || hasOpenRink);
    const isCurrentlyVisible = marker.getMap() !== null;

    // Only call setMap if visibility state changed
    if (shouldShow && !isCurrentlyVisible) {
      marker.setMap(map);
    } else if (!shouldShow && isCurrentlyVisible) {
      marker.setMap(null);
    }
  });
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
  const clearButton = document.getElementById("search-clear");

  if (searchInput && clearButton) {
    if (searchInput.value.trim()) {
      clearButton.classList.remove("hidden");
    } else {
      clearButton.classList.add("hidden");
    }
  }
}

/**
 * Clears the search input and applies the filter.
 */
function clearSearch(): void {
  const searchInput = document.getElementById("search-input") as HTMLInputElement;
  if (searchInput) {
    searchInput.value = "";
    updateClearButton();
    applyFilter();
  }
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
    allRinks = data.allRinks;
    geocodedRinks = data.geocodedRinks;

    // Extract unique types and sort them
    const typeSet = new Set<string>();
    allRinks.forEach((rink) => {
      typeSet.add(rink.type);
    });
    allTypes = Array.from(typeSet).sort();

    // Build index map for fast rink lookups (O(1) instead of O(n))
    rinkIndexMap.clear();
    allRinks.forEach((rink, index) => {
      const key = `${rink.name}|${rink.address}|${rink.type}`;
      rinkIndexMap.set(key, index);
    });

    // Initialize Fuse.js for fuzzy search
    fuse = new Fuse(Array.from(allRinks), {
      keys: ["name", "address", "type", "iceStatus"],
      threshold: 0.4, // 0.0 = perfect match, 1.0 = match anything
      includeMatches: true,
      minMatchCharLength: 2,
    });

    // Update geocoded count in stats
    const geocodedCountElement = document.getElementById("geocoded-count");
    if (geocodedCountElement) {
      geocodedCountElement.textContent = geocodedRinks.length.toString();
    }

    // Read filter state from URL
    const urlParams = readUrlParams();

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
