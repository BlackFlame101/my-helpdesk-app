"use client";

import React, { useState, useEffect, ChangeEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from '@/lib/supabaseClient'; 
import { updateUserProfile, uploadAvatar, getAvatarPublicUrl, UserProfile } from '@/lib/dataService'; 
import { Home, User as UserIcon, Edit3, UploadCloud, Save, LogOut, Clock } from 'lucide-react'; 
import LogoutButton from '@/components/auth/LogoutButton'; 

export default function ProfilePage() {
  const { user, profile, session, loading: authLoading, fetchUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url || null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      
      if (profile.avatar_url) {
          if (profile.avatar_url.startsWith('http')) {
            setAvatarPreview(profile.avatar_url);
          } else {
            const publicUrl = getAvatarPublicUrl(profile.avatar_url);
            setAvatarPreview(publicUrl);
          }
      } else {
          setAvatarPreview(null);
      }
    }
  }, [profile]);


  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) { 
        toast({ title: "File too large", description: "Avatar image must be less than 2MB.", variant: "destructive" });
        return;
      }
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        toast({ title: "Invalid file type", description: "Please select a PNG, JPG, or WEBP image.", variant: "destructive" });
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Not authenticated", description: "You must be logged in to update your profile.", variant: "destructive" });
      return;
    }

    setIsUpdating(true);
    setError(null);
    let newAvatarPath: string | undefined = undefined;

    try {
      
      if (avatarFile) {
        newAvatarPath = await uploadAvatar(user.id, avatarFile);
      }

      
      const updates: { full_name?: string; avatar_url?: string } = {};
      if (fullName !== (profile?.full_name || '')) {
        updates.full_name = fullName;
      }
      if (newAvatarPath) {
        updates.avatar_url = newAvatarPath; 
      }

      
      if (Object.keys(updates).length > 0) {
        const updatedProfile = await updateUserProfile(user.id, updates);
        if (updatedProfile) {
          toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
          
          if (fetchUserProfile) { 
             await fetchUserProfile(user.id);
          }
          
          if (newAvatarPath) {
            const publicUrl = getAvatarPublicUrl(newAvatarPath);
            setAvatarPreview(publicUrl);
            setAvatarFile(null); 
          }
        }
      } else if (avatarFile && !newAvatarPath) {
        
        
      }
      else {
        toast({ description: "No changes to save." });
      }
    } catch (err: any) {
      console.error("Profile update error:", err);
      setError(err.message || "Failed to update profile.");
      toast({ title: "Update Failed", description: err.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  
  useEffect(() => {
    if (!authLoading && !session) {
      router.push('/login');
    }
  }, [session, authLoading, router]);

  if (authLoading || !session || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-sky-100 dark:from-slate-900 dark:to-sky-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Button variant="outline" onClick={() => router.push('/dashboard')} className="mb-6 group">
          <Home size={18} className="mr-2 group-hover:animate-pulse" /> Back to Dashboard
        </Button>

        <Card className="shadow-xl overflow-hidden">
          <CardHeader className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-4">
              <UserIcon size={32} className="text-primary" />
              <div>
                <CardTitle className="text-2xl font-semibold text-slate-800 dark:text-slate-100">User Profile</CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">Manage your personal information and avatar.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="p-6 space-y-6">
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="w-32 h-32 border-4 border-white dark:border-slate-700 shadow-lg">
                  <AvatarImage src={avatarPreview || undefined} alt={profile.full_name || user?.email || 'User Avatar'} />
                  <AvatarFallback className="text-4xl">
                    {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'U')}
                  </AvatarFallback>
                </Avatar>
                <div className="relative">
                  <Button type="button" variant="outline" size="sm" className="group" onClick={() => document.getElementById('avatarUpload')?.click()}>
                    <UploadCloud size={16} className="mr-2 group-hover:animate-bounce" /> Change Avatar
                  </Button>
                  <Input
                    id="avatarUpload"
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleAvatarChange}
                    className="hidden" 
                  />
                </div>
                {avatarFile && <p className="text-xs text-slate-500 dark:text-slate-400">Selected: {avatarFile.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="font-medium text-slate-700 dark:text-slate-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled 
                  className="bg-slate-100 dark:bg-slate-800 cursor-not-allowed"
                />
                 <p className="text-xs text-slate-500 dark:text-slate-400">Email address cannot be changed here.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName" className="font-medium text-slate-700 dark:text-slate-300">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  disabled={isUpdating}
                  className="dark:bg-slate-800"
                />
              </div>
               <div className="space-y-2">
                <Label htmlFor="role" className="font-medium text-slate-700 dark:text-slate-300">Role</Label>
                <Input
                  id="role"
                  type="text"
                  value={profile.role || 'N/A'}
                  disabled
                  className="bg-slate-100 dark:bg-slate-800 cursor-not-allowed capitalize"
                />
              </div>

            </CardContent>
            <CardFooter className="bg-slate-50 dark:bg-slate-800/50 p-6 border-t border-slate-200 dark:border-slate-700 flex flex-col items-stretch">
              {error && <p className="text-red-500 text-sm mb-3 text-center">{error}</p>}
              <Button type="submit" disabled={isUpdating} className="w-full group">
                {isUpdating ? (
                  <>
                    <Clock size={18} className="mr-2 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} className="mr-2 group-hover:scale-110 transition-transform" /> Save Changes
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
         <div className="mt-8 flex justify-center">
            <LogoutButton />
        </div>
      </div>
    </div>
  );
}
