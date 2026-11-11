import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  // A stray package-lock.json in the parent directory makes Turbopack guess the
  // wrong workspace root. Pin it to this project.
  turbopack: { root: here },
  // Pages visited in the last minute open from the browser's cache when you
  // come back to them, instead of waiting for the server again.
  experimental: {
    staleTimes: { dynamic: 60, static: 300 },
  },
};

export default nextConfig;
