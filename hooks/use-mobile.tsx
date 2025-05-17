// Add a custom hook for detecting mobile and tablet screens

"use client"

import { useEffect, useState } from "react"

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Check if window is defined (browser environment)
    if (typeof window !== "undefined") {
      const checkIfMobile = () => {
        setIsMobile(window.innerWidth < 768)
      }

      // Initial check
      checkIfMobile()

      // Add event listener for resize
      window.addEventListener("resize", checkIfMobile)

      // Cleanup
      return () => window.removeEventListener("resize", checkIfMobile)
    }
  }, [])

  return isMobile
}

export function useIsTablet(): boolean {
  const [isTablet, setIsTablet] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const checkIfTablet = () => {
        const width = window.innerWidth
        setIsTablet(width >= 768 && width < 1024)
      }

      checkIfTablet()
      window.addEventListener("resize", checkIfTablet)

      return () => window.removeEventListener("resize", checkIfTablet)
    }
  }, [])

  return isTablet
}

