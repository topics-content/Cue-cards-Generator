/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [{ source: "/admin", destination: "/cost-observatory", permanent: false }];
  },
  experimental: {
    // The SOP and examples are read from disk at runtime; make sure Vercel bundles them.
    outputFileTracingIncludes: { "/api/**/*": ["./lib/sop/**/*"] },
  },
};

export default nextConfig;
