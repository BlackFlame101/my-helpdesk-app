"use client";

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext'; // Adjust path
import { useRouter } from 'next/navigation'; 
import { Button } from "@/components/ui/button"; 
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { signUp, loading } = useAuth(); // Added loading from useAuth
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      // Corrected: The result of `signUp` is the Supabase data object ({ user, session })
      // Errors from `signUp` (like network errors or Supabase errors) are thrown and caught by the catch block.
      const signUpResponse = await signUp(email, password, fullName);

      // Check the structure of signUpResponse which is { user, session }
      // A user object is returned upon successful signup, even if email confirmation is pending.
      // If email confirmation is pending, session will be null.
      // If identities is empty, it often means the primary identity (email) is not yet verified.
      if (signUpResponse && signUpResponse.user && signUpResponse.user.identities && signUpResponse.user.identities.length === 0) {
         setMessage("Signup successful! Please check your email to verify your account before logging in.");
      } else if (signUpResponse && signUpResponse.session) { // User signed up and is immediately logged in (e.g., email confirmation disabled)
        setMessage("Signup successful! Redirecting to dashboard...");
        router.push('/dashboard'); 
      } else if (signUpResponse && signUpResponse.user) { // User object exists, but no session (email confirmation likely required and pending)
         setMessage("Signup successful! Please check your email to verify your account.");
      } else {
        // This is an unlikely scenario if signUp was successful but returned no user/session.
        // Could indicate an issue with Supabase config or an unexpected response.
        setMessage("Signup processed. Please check your email or try logging in.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during sign up.");
      console.error("Sign up error in component:", err);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
          <CardDescription>Enter your details to get started with HelpDesk.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6} // Supabase default minimum password length
                disabled={loading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col items-stretch">
            {error && <p className="text-red-500 text-sm mb-2 text-center">{error}</p>}
            {message && <p className="text-green-500 text-sm mb-2 text-center">{message}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing up...' : 'Sign Up'}
            </Button>
            <p className="mt-4 text-center text-sm">
              Already have an account?{' '}
              <a href="/login" className="font-medium text-primary hover:underline">
                Log in
              </a>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}