/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@meditory/shared'],
  reactStrictMode: true,
  async rewrites() {
    const apiEndpoint = process.env.API_ENDPOINT || 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${apiEndpoint}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
