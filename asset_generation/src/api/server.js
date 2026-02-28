/**
 * HTTP server for the asset generation API.
 * Load dotenv in index.js before requiring this.
 * CORS is enabled so the UI (e.g. Vite dev server on another port) can call this API.
 */

import express from "express";
import cors from "cors";
import { getSvg, getPreload } from "./routes.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.get("/svg/preload", getPreload);
  app.get("/svg", getSvg);
  return app;
}

export function startServer(port = process.env.PORT || 3001) {
  const app = createApp();
  return app.listen(port, () => {
    console.log(`Asset generation API listening on http://localhost:${port}`);
  });
}
