import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  fallbacks: {
    document: "/offline",
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/*": ["./node_modules/.prisma/**/*", "./node_modules/@prisma/client/**/*"],
  },
};

export default withPWA(nextConfig);
