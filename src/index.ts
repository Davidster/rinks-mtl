import "dotenv/config";
import http from "http";
import url from "url";
import { homePage } from "./pages/home.js";
import { env } from "./env.js";

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url ?? "", true);
  const pathname = parsedUrl.pathname;

  const handleRequest = () => {
    switch (pathname) {
      case "":
      case "/":
        res.writeHead(200, { "Content-Type": "text/html" }).end(homePage());
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
});
