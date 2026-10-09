/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "meta-llm.vercel.app" }],
        destination: "https://postcogs.com/:path*",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
