"use client";

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button"; 

export default function LogoutButton() {
  const { logout, loading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <Button 
      onClick={handleLogout} 
      disabled={loading}
      variant="outline"
      size="sm"
    >
      {loading ? 'Logging out...' : 'Log Out'}
    </Button>
  );
}