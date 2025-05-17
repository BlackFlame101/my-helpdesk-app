"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const { session, loading: authLoading, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait until authentication status is determined
    if (!authLoading) {
      if (session) {
        // User is authenticated
        // Check if profile is loaded and has a role to decide if it's a full login
        // For simplicity, we'll assume if session exists, redirect to dashboard.
        // More complex logic could check profile.role before redirecting.
        router.replace('/dashboard');
      } else {
        // User is not authenticated
        router.replace('/login');
      }
    }
  }, [session, authLoading, router, profile]);

  // Display a loading indicator while determining auth state and redirecting
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg text-muted-foreground">Loading application...</p>
    </div>
  );
}
