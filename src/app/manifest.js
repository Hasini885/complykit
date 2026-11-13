import { site } from "@/config/site";

/**
 * Web app manifest: lets Chrome, Edge and phones install CA Compliance Tool as
 * an app (own window, own icon). Served at /manifest.webmanifest, which the
 * sign-in check skips, so the browser can read it before anyone signs in.
 */
export default function manifest() {
  return {
    id: "/dashboard",
    name: site.name,
    short_name: "CA Compliance",
    description: "GST, MCA, bank statements, documents and tasks for CA practices, in one place.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#12131f",
    theme_color: "#12131f",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "GST Client Register", url: "/gst", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "MCA Dashboard", url: "/mca", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Task Manager", url: "/tasks", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
