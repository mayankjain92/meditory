/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@meditory/shared'],
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
};

export default nextConfig;
