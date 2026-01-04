import "dotenv/config";
import http from "http";
import url from "url";
import open from "open";
import { homePage } from "./pages/home.js";
import { env } from "./env.js";

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url ?? "", true);
  const pathname = parsedUrl.pathname;

  const handleRequest = async () => {
    switch (pathname) {
      case "":
      case "/":
        try {
          const html = await homePage();
          res.writeHead(200, { "Content-Type": "text/html" }).end(html);
        } catch (error) {
          console.error("Error generating home page:", error);
          res.writeHead(500).end("Internal Server Error");
        }
        break;

      // Unknown route
      default:
        console.error(`Unexpected path: ${pathname}`);
        res.writeHead(404).end("Not Found");
    }
  };

  void handleRequest();
});

server.listen(env.PORT, () => {
  console.info(`Server running at port ${env.PORT}`);
  // Open browser automatically in dev mode
  if (process.env.NODE_ENV !== "production") {
    const url = `http://localhost:${env.PORT}`;
    void open(url);
  }
});
