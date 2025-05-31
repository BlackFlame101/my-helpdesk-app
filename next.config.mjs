/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable strict mode for better development experience
  reactStrictMode: true,
  
  // Enable image optimization for production
  images: {
    domains: ['localhost'], // Add your image domains here
    unoptimized: process.env.NODE_ENV === 'development',
  },
  
  // CSS configuration
  webpack: (config) => {
    config.module.rules.push({
      test: /\.css$/,
      use: ['style-loader', 'css-loader', 'postcss-loader'],
    });
    return config;
  },

  // Temporarily keep these during deployment debugging
  // Remove them once deployment is stable
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
