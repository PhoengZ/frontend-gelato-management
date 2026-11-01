import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emits .next/standalone so the Docker image ships only the server and its traced deps.
  output: "standalone",
  turbopack: {
    root: projectRoot
  }
};

export default nextConfig;
