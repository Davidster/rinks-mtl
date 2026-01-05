import "dotenv/config";
import http from "http";
import url from "url";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
// import open from "open"; // Commented out - uncomment if needed for auto-opening browser
import { homePage } from "./pages/home.js";
import { env } from "./env.js";
import { getGeocodedRinks } from "./services/rinkGeocoding.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url ?? "", true);
  const pathname = parsedUrl.pathname;

  const handleRequest = async () => {
    // API endpoint for rinks data
    if (pathname === "/api/rinks") {
      try {
        const rinks = await getGeocodedRinks();
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ rinks }));
        return;
      } catch (error) {
        console.error("Error handling rinks request:", error);
        res.writeHead(500).end(JSON.stringify({ error: "Internal Server Error" }));
        return;
      }
    }

    // Static file serving for /public/ paths
    if (pathname?.startsWith("/public/")) {
      try {
        const filePath = join(__dirname, "..", "dist", pathname);
        if (!existsSync(filePath)) {
          res.writeHead(404).end("Not Found");
          return;
        }

        const fileContent = readFileSync(filePath);
        const ext = extname(filePath);
        const mimeTypes: Record<string, string> = {
          ".js": "application/javascript",
          ".css": "text/css",
          ".json": "application/json",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".gif": "image/gif",
          ".svg": "image/svg+xml",
        };
        const contentType = mimeTypes[ext] || "application/octet-stream";

        res.writeHead(200, { "Content-Type": contentType }).end(fileContent);
        return;
      } catch (error) {
        console.error("Error serving static file:", error);
        res.writeHead(500).end("Internal Server Error");
        return;
      }
    }

    // Home page
    if (pathname === "" || pathname === "/") {
      try {
        const html = await homePage();
        res.writeHead(200, { "Content-Type": "text/html" }).end(html);
        return;
      } catch (error) {
        console.error("Error generating home page:", error);
        res.writeHead(500).end("Internal Server Error");
        return;
      }
    }

    // Unknown route
    console.error(`Unexpected path: ${pathname}`);
    res.writeHead(404).end("Not Found");
  };

  void handleRequest();
});

server.listen(env.PORT, () => {
  console.info(`Server running at port ${env.PORT}`);
  // Open browser automatically in dev mode
  if (process.env.NODE_ENV !== "production") {
    // const browserUrl = `http://localhost:${env.PORT}`;
    // void open(browserUrl); // Uncomment to enable auto-opening browser
  }
});
