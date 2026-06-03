import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "fluent-ffmpeg", "@ffmpeg-installer/ffmpeg"],
  turbopack: {},
};

export default nextConfig;
