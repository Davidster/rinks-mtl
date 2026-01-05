import { env } from "../env.js";
import { getTranslations, type Language, type Translations } from "./translations.js";

/**
 * Generates the filter HTML (search, checkboxes, type filter).
 * @param prefix - Prefix for element IDs (empty for desktop, "modal-" for mobile)
 * @param t - Translations object
 */
function generateFiltersHtml(prefix: string, t: Translations): string {
  const idPrefix = prefix ? `${prefix}-` : "";
  const searchInputId = `${idPrefix}search-input`;
  const clearButtonId = `${idPrefix}search-clear`;
  const openCheckboxId = `${idPrefix}show-open-only`;
  const multipleCheckboxId = `${idPrefix}show-multiple-rinks`;
  const typeSelectId = `${idPrefix}type-filter`;
  const lastUpdatedSelectId = `${idPrefix}last-updated-filter`;

  return `
        <div class="search-box">
          <input type="text" id="${searchInputId}" placeholder="${t.searchPlaceholder}" />
          <button type="button" class="search-box-clear hidden" id="${clearButtonId}" aria-label="${t.clearSearch}">×</button>
        </div>
        <div class="filter-controls">
          <label>
            <input type="checkbox" id="${openCheckboxId}" />
            <span>${t.showOpenOnly}</span>
          </label>
          <label>
            <input type="checkbox" id="${multipleCheckboxId}" />
            <span>${t.showMultipleRinks}</span>
          </label>
        </div>
        <div class="type-filter">
          <label>${t.rinkType}</label>
          <div id="${typeSelectId}" class="type-checkboxes">
            <!-- Type checkboxes will be populated by JavaScript -->
          </div>
        </div>
        <div class="type-filter">
          <label for="${lastUpdatedSelectId}">${t.recentMaintenance}</label>
          <select id="${lastUpdatedSelectId}">
            <option value="all">${t.allTime}</option>
            <option value="4h">${t.last4Hours}</option>
            <option value="12h">${t.last12Hours}</option>
            <option value="24h">${t.last24Hours}</option>
            <option value="7d">${t.last7Days}</option>
          </select>
        </div>
  `;
}

export function homePage(lang: Language = "fr"): string {
  const errorHtml = "";
  const t = getTranslations(lang);
  const siteUrl = env.SITE_URL;
  const currentUrl = `${siteUrl}/${lang}`;
  const alternateLang: Language = lang === "fr" ? "en" : "fr";
  const alternateUrl = `${siteUrl}/${alternateLang}`;

  // Generate structured data (JSON-LD)
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name:
      lang === "fr"
        ? "Carte des patinoires extérieures de Montréal"
        : "Montreal Outdoor Hockey Rinks Map",
    description: t.metaDescription,
    url: currentUrl,
    applicationCategory: "MapApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "CAD",
    },
    provider: {
      "@type": "Organization",
      name: lang === "fr" ? "Patinoires Montréal" : "Montreal Outdoor Rinks",
    },
    about: {
      "@type": "SportsActivityLocation",
      name:
        lang === "fr" ? "Patinoires extérieures à Montréal" : "Outdoor Hockey Rinks in Montreal",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Montreal",
        addressRegion: "QC",
        addressCountry: "CA",
      },
    },
  };

  return `
<!DOCTYPE html>
<html lang="${t.htmlLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="alternate icon" href="/favicon.svg">
  
  <!-- Primary SEO Meta Tags -->
  <title>${t.siteTitle}</title>
  <meta name="title" content="${t.siteTitle}">
  <meta name="description" content="${t.metaDescription}">
  <meta name="author" content="${lang === "fr" ? "Patinoires Montréal" : "Montreal Outdoor Rinks"}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${currentUrl}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${currentUrl}">
  <meta property="og:title" content="${t.siteTitle}">
  <meta property="og:description" content="${t.metaDescription}">
  <meta property="og:locale" content="${lang === "fr" ? "fr_CA" : "en_CA"}">
  <meta property="og:locale:alternate" content="${lang === "fr" ? "en_CA" : "fr_CA"}">
  
  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${currentUrl}">
  <meta property="twitter:title" content="${t.siteTitle}">
  <meta property="twitter:description" content="${t.metaDescription}">
  
  <!-- Bilingual Support -->
  <link rel="alternate" hreflang="${lang}" href="${currentUrl}">
  <link rel="alternate" hreflang="${alternateLang}" href="${alternateUrl}">
  <link rel="alternate" hreflang="x-default" href="${siteUrl}/fr">
  
  <!-- Structured Data -->
  <script type="application/ld+json">
    ${JSON.stringify(structuredData, null, 2)}
  </script>
  
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
    html, body {
      height: 100%;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background-color: #f5f5f5;
    }
    .main-container {
      display: flex;
      height: 100vh;
    }
    .main-content {
      flex: 1;
      padding: 20px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 0;
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
      flex-shrink: 0;
    }
    .intro-text {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      font-size: 0.95em;
      line-height: 1.6;
      color: #555;
      position: relative;
      flex-shrink: 0;
    }
    .intro-close {
      display: none;
      position: absolute;
      top: 10px;
      right: 10px;
      background: none;
      border: none;
      font-size: 20px;
      color: #999;
      cursor: pointer;
      padding: 4px 8px;
      line-height: 1;
      border-radius: 4px;
      transition: background-color 0.2s, color 0.2s;
    }
    .intro-close:hover {
      background-color: #f0f0f0;
      color: #333;
    }
    .intro-text p {
      margin: 0 0 12px 0;
    }
    .intro-text p:last-child {
      margin-bottom: 0;
    }
    .language-picker {
      margin-bottom: 10px;
      font-size: 0.75em;
      color: #999;
    }
    .language-picker a {
      color: #999;
      text-decoration: none;
      margin-right: 4px;
      transition: color 0.2s;
    }
    .language-picker a:hover {
      color: #555;
    }
    .language-picker a.active {
      color: #3498db;
      font-weight: 500;
    }
    .language-picker .separator {
      color: #ddd;
      margin: 0 2px;
    }
    .data-source {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #eee;
      color: #777;
    }
    .data-source a {
      color: #3498db;
      text-decoration: none;
    }
    .data-source a:hover {
      text-decoration: underline;
    }
    .stats {
      background: white;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .map-container {
      flex: 1;
      min-height: 0;
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
    .type-checkboxes {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 120px;
      overflow-y: auto;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background-color: white;
    }
    .type-checkboxes label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 0.9em;
      color: #555;
      margin: 0;
    }
    .type-checkboxes input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
      margin: 0;
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
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s, transform 0.2s;
    }
    .floating-filter-btn::before {
      content: '';
      display: block;
      width: 20px;
      height: 20px;
      position: relative;
      background: white;
      mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M22 3H2l8 9.46V19l4 2v-8.54L22 3z'/%3E%3C/svg%3E");
      -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M22 3H2l8 9.46V19l4 2v-8.54L22 3z'/%3E%3C/svg%3E");
      mask-size: contain;
      -webkit-mask-size: contain;
      mask-repeat: no-repeat;
      -webkit-mask-repeat: no-repeat;
      mask-position: center;
      -webkit-mask-position: center;
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
      height: 90vh;
      height: 90dvh; /* Use dynamic viewport height for mobile browsers */
      display: flex;
      flex-direction: column;
      transform: translateY(100%);
      transition: transform 0.3s ease;
      z-index: 2001;
      overflow: hidden;
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
      overflow-x: hidden;
    }
    .modal-body .rinks-list-container {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      min-height: 0;
    }
    /* Mobile responsive styles */
    @media (max-width: 768px) {
      html, body {
        overflow: hidden;
        height: 100vh;
        height: 100dvh; /* Use dynamic viewport height for mobile browsers */
      }
      .sidebar {
        display: none;
      }
      .floating-filter-btn {
        display: flex;
      }
      .main-container {
        flex-direction: column;
        height: 100vh;
        height: 100dvh; /* Use dynamic viewport height for mobile browsers */
        overflow: hidden;
      }
      .main-content {
        padding: 10px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        flex: 1;
        min-height: 0;
      }
      .map-container {
        flex: 1;
        min-height: 0;
        height: 0; /* Force flexbox to calculate height */
      }
      h1 {
        font-size: 1.3em;
        margin-bottom: 10px;
        flex-shrink: 0;
      }
      .intro-text {
        padding: 15px 40px 15px 15px;
        margin-bottom: 15px;
        font-size: 0.9em;
        flex-shrink: 0;
      }
      .intro-text.dismissed {
        display: none;
      }
      .intro-close {
        display: block;
      }
      .stats {
        padding: 10px;
        margin-bottom: 10px;
        font-size: 0.9em;
        flex-shrink: 0;
      }
      .error {
        flex-shrink: 0;
      }
    }
  </style>
</head>
<body>
  <div class="main-container">
    <div class="main-content">
      <div class="language-picker">
        <a href="/fr" class="language-link ${lang === "fr" ? "active" : ""}" data-lang="fr">FR</a>
        <span class="separator">|</span>
        <a href="/en" class="language-link ${lang === "en" ? "active" : ""}" data-lang="en">EN</a>
      </div>
      <div class="intro-text" id="intro-text">
        <button class="intro-close" id="intro-close" aria-label="${t.closeIntro}">×</button>
        <p>
          ${t.introText}
        </p>
        <p class="data-source">
          <small>
            ${t.dataSourceText} <a href="https://montreal.ca/${lang === "fr" ? "conditions-des-patinoires-exterieures" : "en/outdoor-skating-rinks-conditions"}" target="_blank" rel="noopener noreferrer">${t.dataSourceLink}</a> ${lang === "fr" ? "et mises à jour régulièrement." : "and updated regularly."}
          </small>
        </p>
      </div>
      ${errorHtml}
      <div class="map-container">
        <div id="map"></div>
      </div>
    </div>
    <div class="sidebar">
      <div class="sidebar-header">
        ${generateFiltersHtml("", t)}
      </div>
      <div class="rinks-list-container">
        <div class="rinks-list" id="rinks-list">
          <!-- Rinks list will be populated by JavaScript -->
        </div>
      </div>
    </div>
  </div>
  <!-- Floating filter button for mobile -->
  <button class="floating-filter-btn" id="floating-filter-btn" aria-label="Open filters"></button>
  <!-- Modal for mobile filters and results -->
  <div class="modal-overlay" id="modal-overlay">
    <div class="modal-content">
      <div class="modal-header">
        <button class="modal-close" id="modal-close" aria-label="Close modal">×</button>
      </div>
      <div class="modal-body">
        <div class="modal-filters">
          ${generateFiltersHtml("modal", t)}
        </div>
        <div class="rinks-list-container">
          <div class="rinks-list" id="modal-rinks-list">
            <!-- Rinks list will be populated by JavaScript -->
          </div>
        </div>
      </div>
    </div>
  </div>
  <script type="module">
    // Pass language to client-side code
    window.__LANG__ = "${lang}";
  </script>
  <script type="module" src="/public/home.js"></script>
  <script type="module" src="/public/map.js"></script>
</body>
</html>
`;
}
