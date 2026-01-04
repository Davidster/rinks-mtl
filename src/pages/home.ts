import { getGeocodedRinks } from "../services/rinkGeocoding.js";
import { env } from "../env.js";
import type { Rink } from "../types/rink.js";

function formatRink(rink: Rink, index: number): string {
  const statusClass = rink.isOpen ? "open" : "closed";
  return `
    <div class="rink ${statusClass}" data-rink-index="${index}" data-is-open="${rink.isOpen}">
      <h3><a href="${rink.hyperlink}" target="_blank">${rink.name}</a></h3>
      <p><strong>Type:</strong> ${rink.type}</p>
      <p><strong>Status:</strong> ${rink.iceStatus}</p>
      <p><strong>Last Updated:</strong> ${rink.lastUpdatedRaw}</p>
      <p><strong>Address:</strong> ${rink.address}</p>
    </div>
  `;
}

export async function homePage(): Promise<string> {
  let rinks: readonly Rink[] = [];
  let error: string | null = null;

  try {
    rinks = await getGeocodedRinks();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to fetch rinks data";
    console.error("Error parsing rinks:", err);
  }

  const errorHtml = error ? `<div class="error">Error: ${error}</div>` : "";

  // Generate rinks HTML for the sidebar
  const rinksHtml =
    rinks.length > 0
      ? rinks.map((rink, index) => formatRink(rink, index)).join("")
      : "<p>No rinks found.</p>";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Montreal Skating Rinks</title>
  <script src="https://maps.googleapis.com/maps/api/js?key=${env.GOOGLE_MAPS_FRONTEND_API_KEY}"></script>
  <script type="importmap">
    {
      "imports": {
        "fuse.js": "https://esm.sh/fuse.js@7"
      }
    }
  </script>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .main-container {
      display: flex;
      height: 100vh;
    }
    .main-content {
      flex: 1;
      padding: 20px;
      overflow-y: auto;
    }
    .sidebar {
      width: 350px;
      background: white;
      border-left: 1px solid #ddd;
      padding: 0;
      overflow: hidden;
      box-shadow: -2px 0 4px rgba(0,0,0,0.1);
      display: flex;
      flex-direction: column;
    }
    .sidebar-header {
      padding: 20px;
      background: white;
      border-bottom: 1px solid #eee;
      position: sticky;
      top: 0;
      z-index: 10;
      flex-shrink: 0;
    }
    h1 {
      color: #2c3e50;
      border-bottom: 3px solid #3498db;
      padding-bottom: 10px;
      margin-top: 0;
    }
    .error {
      background-color: #e74c3c;
      color: white;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    .stats {
      background: white;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .map-container {
      height: calc(100vh - 200px);
      width: 100%;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    #map {
      height: 100%;
      width: 100%;
    }
    .sidebar h2 {
      margin-top: 0;
      color: #2c3e50;
      font-size: 1.2em;
    }
    .filter-controls {
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .type-filter {
      margin-top: 15px;
    }
    .type-filter label {
      display: block;
      font-size: 0.9em;
      color: #555;
      margin-bottom: 5px;
    }
    .type-filter select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 0.9em;
      box-sizing: border-box;
      background-color: white;
      cursor: pointer;
    }
    .type-filter select:focus {
      outline: none;
      border-color: #3498db;
    }
    .search-box {
      margin-top: 15px;
      position: relative;
    }
    .search-box input {
      width: 100%;
      padding: 8px 32px 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 0.9em;
      box-sizing: border-box;
    }
    .search-box input:focus {
      outline: none;
      border-color: #3498db;
    }
    .search-box-clear {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      font-size: 18px;
      color: #999;
      padding: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    .search-box-clear:hover {
      color: #333;
    }
    .search-box-clear.hidden {
      display: none;
    }
    .rink .highlight {
      background-color: #fff3cd;
      padding: 1px 0;
      border-radius: 2px;
      display: inline;
    }
    .rinks-list-container {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }
    .filter-controls label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      color: #555;
    }
    .filter-controls input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }
    .rinks-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .rink {
      background: #f9f9f9;
      padding: 15px;
      border-radius: 6px;
      border-left: 4px solid #95a5a6;
      font-size: 0.9em;
    }
    .rink.open {
      border-left-color: #27ae60;
    }
    .rink.closed {
      border-left-color: #e74c3c;
    }
    .rink.hidden {
      display: none;
    }
    .rink h3 {
      margin: 0 0 8px 0;
      color: #2c3e50;
      font-size: 1em;
    }
    .rink h3 a {
      color: #3498db;
      text-decoration: none;
    }
    .rink h3 a:hover {
      text-decoration: underline;
    }
    .rink p {
      margin: 4px 0;
      color: #555;
      font-size: 0.85em;
    }
    .rink strong {
      color: #2c3e50;
    }
  </style>
</head>
<body>
  <div class="main-container">
    <div class="main-content">
      <h1>Montreal Outdoor Skating Rinks</h1>
      ${errorHtml}
      <div class="map-container">
        <div id="map"></div>
      </div>
    </div>
    <div class="sidebar">
      <div class="sidebar-header">
        <h2>Rinks</h2>
        <div class="filter-controls">
          <label>
            <input type="checkbox" id="show-open-only" />
            <span>Show only open rinks</span>
          </label>
          <label>
            <input type="checkbox" id="show-multiple-rinks" />
            <span>Show only locations with multiple rinks</span>
          </label>
        </div>
        <div class="type-filter">
          <label for="type-filter">Filter by type:</label>
          <select id="type-filter" multiple size="4">
            <option value="">All types</option>
          </select>
        </div>
        <div class="search-box">
          <input type="text" id="search-input" placeholder="Search rinks..." />
          <button type="button" class="search-box-clear hidden" id="search-clear" aria-label="Clear search">×</button>
        </div>
      </div>
      <div class="rinks-list-container">
        <div class="rinks-list" id="rinks-list">
          ${rinksHtml}
        </div>
      </div>
    </div>
  </div>
  <script type="module" src="/public/map.js"></script>
</body>
</html>
`;
}
