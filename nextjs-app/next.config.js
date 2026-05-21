const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@prisma/client'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // 直接綁定 @ alias，避免依賴 tsconfig paths 在不同 build 環境的解析差異。
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
    }
    return config
  },
}

module.exports = nextConfig
