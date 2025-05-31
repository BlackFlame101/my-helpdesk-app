/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable strict mode for better development experience
  reactStrictMode: true,
  
  // Enable image optimization for production
  images: {
    domains: ['localhost'], // Add your image domains here
    unoptimized: process.env.NODE_ENV === 'development',
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
