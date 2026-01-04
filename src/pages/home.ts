import { parseMontrealRinks } from "../parsers/montrealRinks.js";
import type { Rink } from "../types/rink.js";

function formatRink(rink: Rink): string {
  const statusClass = rink.isOpen ? "open" : "closed";
  return `
    <div class="rink ${statusClass}">
      <h3><a href="${rink.hyperlink}" target="_blank">${rink.name}</a></h3>
      <p><strong>Type:</strong> ${rink.type}</p>
      <p><strong>Status:</strong> ${rink.iceStatus}</p>
      <p><strong>Last Updated:</strong> ${rink.lastUpdatedRaw}</p>
      <p><strong>Open:</strong> ${rink.isOpen ? "Yes" : "No"}</p>
      <p><strong>Address:</strong> ${rink.address}</p>
    </div>
  `;
}

export async function homePage(): Promise<string> {
  let rinks: readonly Rink[] = [];
  let error: string | null = null;

  try {
    rinks = await parseMontrealRinks();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to fetch rinks data";
    console.error("Error parsing rinks:", err);
  }

  console.log("rinks", rinks.slice(0, 10));
  console.log(
    "rink with empty lastUpdatedRaw",
    rinks.filter((r) => r.lastUpdatedRaw === "")
  );

  const rinksHtml = rinks.length > 0 ? rinks.map(formatRink).join("") : "<p>No rinks found.</p>";

  const errorHtml = error ? `<div class="error">Error: ${error}</div>` : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Montreal Skating Rinks</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    h1 {
      color: #2c3e50;
      border-bottom: 3px solid #3498db;
      padding-bottom: 10px;
    }
    .error {
      background-color: #e74c3c;
      color: white;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    .rinks-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    .rink {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      border-left: 4px solid #95a5a6;
    }
    .rink.open {
      border-left-color: #27ae60;
    }
    .rink.closed {
      border-left-color: #e74c3c;
    }
    .rink h3 {
      margin-top: 0;
      color: #2c3e50;
    }
    .rink h3 a {
      color: #3498db;
      text-decoration: none;
    }
    .rink h3 a:hover {
      text-decoration: underline;
    }
    .rink p {
      margin: 8px 0;
      color: #555;
    }
    .rink strong {
      color: #2c3e50;
    }
    .stats {
      background: white;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <h1>Montreal Outdoor Skating Rinks</h1>
  ${errorHtml}
  <div class="stats">
    <p><strong>Total Rinks:</strong> ${rinks.length}</p>
    <p><strong>Open:</strong> ${rinks.filter((r) => r.isOpen).length}</p>
    <p><strong>Closed:</strong> ${rinks.filter((r) => !r.isOpen).length}</p>
  </div>
  <div class="rinks-container">
    ${rinksHtml}
  </div>
</body>
</html>
`;
}
