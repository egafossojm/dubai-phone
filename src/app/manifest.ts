import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dubai Phone",
    short_name: "Dubai Phone",
    description:
      "Application de gestion retail pour magasin d'électronique au Cameroun.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f8",
    theme_color: "#0b5fff",
    lang: "fr",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
