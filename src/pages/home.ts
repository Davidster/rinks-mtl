import { env } from "../env.js";

/**
 * Generates the filter HTML (search, checkboxes, type filter).
 * @param prefix - Prefix for element IDs (empty for desktop, "modal-" for mobile)
 */
function generateFiltersHtml(prefix: string): string {
  const idPrefix = prefix ? `${prefix}-` : "";
  const searchInputId = `${idPrefix}search-input`;
  const clearButtonId = `${idPrefix}search-clear`;
  const openCheckboxId = `${idPrefix}show-open-only`;
  const multipleCheckboxId = `${idPrefix}show-multiple-rinks`;
  const typeSelectId = `${idPrefix}type-filter`;

  return `
        <div class="search-box">
          <input type="text" id="${searchInputId}" placeholder="Search rinks..." />
          <button type="button" class="search-box-clear hidden" id="${clearButtonId}" aria-label="Clear search">×</button>
        </div>
        <div class="filter-controls">
          <label>
            <input type="checkbox" id="${openCheckboxId}" />
            <span>Show only open rinks</span>
          </label>
          <label>
            <input type="checkbox" id="${multipleCheckboxId}" />
            <span>Show only locations with multiple rinks</span>
          </label>
        </div>
        <div class="type-filter">
          <label for="${typeSelectId}">Filter by type (hold Ctrl/Cmd to select multiple):</label>
          <select id="${typeSelectId}" multiple size="4">
          </select>
        </div>
  `;
}

export function homePage(): string {
  const errorHtml = "";

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
        "fuse.js": "https://esm.sh/fuse.js@7",
        "@googlemaps/markerclusterer": "https://esm.sh/@googlemaps/markerclusterer@2"
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
      margin-top: 15px;
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
    /* Floating filter button - hidden on desktop */
    .floating-filter-btn {
      display: none;
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 56px;
      height: 56px;
      background-color: #3498db;
      color: white;
      border: none;
      border-radius: 50%;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      cursor: pointer;
      z-index: 1000;
      font-size: 24px;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s, transform 0.2s;
    }
    .floating-filter-btn:hover {
      background-color: #2980b9;
      transform: scale(1.05);
    }
    .floating-filter-btn:active {
      transform: scale(0.95);
    }
    /* Modal overlay */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 2000;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .modal-overlay.open {
      display: block;
      opacity: 1;
    }
    /* Modal content */
    .modal-content {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: white;
      border-radius: 20px 20px 0 0;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      transform: translateY(100%);
      transition: transform 0.3s ease;
      z-index: 2001;
    }
    .modal-overlay.open .modal-content {
      transform: translateY(0);
    }
    .modal-header {
      padding: 12px 20px 0px 20px;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      flex-shrink: 0;
    }
    .modal-header h2 {
      margin: 0;
      color: #2c3e50;
      font-size: 1.2em;
    }
    .modal-close {
      background: none;
      border: none;
      font-size: 24px;
      color: #999;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background-color 0.2s;
    }
    .modal-close:hover {
      background-color: #f0f0f0;
    }
    .modal-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 0;
    }
    .modal-filters {
      flex-shrink: 0;
      padding: 0px 20px 20px 20px;
      background: white;
      border-bottom: 1px solid #eee;
      overflow-y: auto;
      max-height: 40vh;
    }
    .modal-body .rinks-list-container {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      min-height: 0;
    }
    /* Mobile responsive styles */
    @media (max-width: 768px) {
      .sidebar {
        display: none;
      }
      .floating-filter-btn {
        display: flex;
      }
      .main-container {
        flex-direction: column;
      }
      .main-content {
        padding: 10px;
      }
      .map-container {
        height: calc(100vh - 60px);
      }
      h1 {
        font-size: 1.3em;
        margin-bottom: 10px;
      }
      .stats {
        padding: 10px;
        margin-bottom: 10px;
        font-size: 0.9em;
      }
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
        ${generateFiltersHtml("")}
      </div>
      <div class="rinks-list-container">
        <div class="rinks-list" id="rinks-list">
          <!-- Rinks list will be populated by JavaScript -->
        </div>
      </div>
    </div>
  </div>
  <!-- Floating filter button for mobile -->
  <button class="floating-filter-btn" id="floating-filter-btn" aria-label="Open filters">
    ☰
  </button>
  <!-- Modal for mobile filters and results -->
  <div class="modal-overlay" id="modal-overlay">
    <div class="modal-content">
      <div class="modal-header">
        <button class="modal-close" id="modal-close" aria-label="Close modal">×</button>
      </div>
      <div class="modal-body">
        <div class="modal-filters">
          ${generateFiltersHtml("modal")}
        </div>
        <div class="rinks-list-container">
          <div class="rinks-list" id="modal-rinks-list">
            <!-- Rinks list will be populated by JavaScript -->
          </div>
        </div>
      </div>
    </div>
  </div>
  <script type="module" src="/public/map.js"></script>
</body>
</html>
`;
}
