/**
 * Entry point: load env from repo root, then start the API server.
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import { startServer } from "./src/api/server.js";

const port = process.env.PORT || 3001;
startServer(port);
