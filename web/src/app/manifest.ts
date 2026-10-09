import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PostCogs",
    short_name: "PostCogs",
    description: "Four AIs answer. A blind judge synthesizes and compares.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF9F5",
    theme_color: "#FAF9F5",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
