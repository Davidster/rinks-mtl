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
import { isValidLanguage } from "./pages/translations.js";

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

    // SEO: robots.txt
    if (pathname === "/robots.txt") {
      const robotsTxt = `User-agent: *
Allow: /
Sitemap: ${env.SITE_URL}/sitemap.xml
`;
      res.writeHead(200, { "Content-Type": "text/plain" }).end(robotsTxt);
      return;
    }

    // SEO: sitemap.xml
    if (pathname === "/sitemap.xml") {
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${env.SITE_URL}/fr</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="fr" href="${env.SITE_URL}/fr"/>
    <xhtml:link rel="alternate" hreflang="en" href="${env.SITE_URL}/en"/>
  </url>
  <url>
    <loc>${env.SITE_URL}/en</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${env.SITE_URL}/en"/>
    <xhtml:link rel="alternate" hreflang="fr" href="${env.SITE_URL}/fr"/>
  </url>
</urlset>
`;
      res.writeHead(200, { "Content-Type": "application/xml" }).end(sitemap);
      return;
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

    // Redirect root to default language (French), preserving query params
    if (pathname === "" || pathname === "/") {
      const queryString = parsedUrl.query ? `?${new URLSearchParams(parsedUrl.query as Record<string, string>).toString()}` : "";
      res.writeHead(302, { Location: `/fr${queryString}` }).end();
      return;
    }

    // Language-specific home pages
    if (pathname === "/fr" || pathname === "/en") {
      try {
        const lang = pathname.slice(1); // Remove leading slash
        if (!isValidLanguage(lang)) {
          res.writeHead(404).end("Not Found");
          return;
        }
        const html = homePage(lang);
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
