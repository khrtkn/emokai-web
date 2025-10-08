import path from 'path';
import { fileURLToPath } from 'url';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./next-intl.config.ts', {
  publicRoutes: ['/admin/:path*', '/api/gallery/review/:path*']
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp']
  },
  webpack: (config) => {
    if (!config.resolve.alias) {
      config.resolve.alias = {};
    }
    const __dirname_local = path.dirname(fileURLToPath(import.meta.url));
    const srcPath = path.resolve(__dirname_local, 'src');
    config.resolve.alias['@'] = srcPath;
    // Some environments require explicit '@/'' prefix mapping
    config.resolve.alias['@/'] = srcPath + '/';
    return config;
  }
};

export default withNextIntl(nextConfig);
