// contexts/AuthContext.tsx
"use client";

import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useRef,
  useCallback
} from 'react';
import { Session, User, RealtimeChannel, AuthResponse } from '@supabase/supabase-js'; // Added AuthResponse
import { supabase } from '@/lib/supabaseClient';
import { fetchUserNotifications, Notification as NotificationType } from '@/lib/dataService'; // Assuming Notification type is exported

export interface UserProfile {
  id: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
  // Add other profile fields as needed
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean; // For initial auth check
  isProfileLoading: boolean; // For subsequent profile fetches
  unreadNotificationsCount: number;
  login: (email: string, password: string) => Promise<AuthResponse['data']>;
  signUp: (email: string, password: string, fullName?: string) => Promise<AuthResponse['data']>;
  logout: () => Promise<void>;
  fetchUserProfile: (userId: string) => Promise<void>; // Changed to fetchUserProfile to match provider
  isAdmin: boolean;
  isAgent: boolean;
  isCustomer: boolean;
  refreshUnreadCount: () => void; // Function to manually refresh count
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true); // For initial auth session check
  const [isProfileLoading, setIsProfileLoading] = useState(false); // For profile/notification fetching
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const notificationChannelRef = useRef<RealtimeChannel | null>(null);

  const fetchUserProfileAndNotifications = useCallback(async (userId: string) => {
    if (!userId) return;
    setIsProfileLoading(true);
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching profile in context:', profileError);
        setProfile(null);
      } else {
        setProfile(profileData as UserProfile);
      }

      // Fetch unread notifications count
      const unreadNotifs = await fetchUserNotifications(userId, 50, true); // Fetch up to 50 unread
      setUnreadNotificationsCount(unreadNotifs.length);

    } catch (error) {
      console.error('Error in fetchUserProfileAndNotifications:', error);
      setProfile(null);
      setUnreadNotificationsCount(0);
    } finally {
      setIsProfileLoading(false);
    }
  }, []); // Empty dependency array as it doesn't depend on component state directly

  const refreshUnreadCount = useCallback(async () => {
    if (user?.id) {
        try {
            const unreadNotifs = await fetchUserNotifications(user.id, 100, true); // Fetch many to get accurate count
            setUnreadNotificationsCount(unreadNotifs.length);
        } catch (error) {
            console.error("Failed to refresh unread notifications count:", error);
        }
    }
  }, [user?.id]);


  // Effect for initial session and auth state changes
  useEffect(() => {
    setLoading(true); // Indicate initial auth check is starting

    const getInitialSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        const currentUser = currentSession?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await fetchUserProfileAndNotifications(currentUser.id);
        } else {
          setProfile(null);
          setUnreadNotificationsCount(0);
        }
      } catch (error) {
        console.error("Error getting initial session:", error);
        setProfile(null); // Reset on error
        setUnreadNotificationsCount(0);
      } finally {
        setLoading(false); // Crucial: Always complete initial loading state
      }
    };

    getInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        setSession(currentSession);
        const newCurrentUser = currentSession?.user ?? null;
        setUser(newCurrentUser);

        if (newCurrentUser) {
          // If user changes (e.g., login) or if profile is not yet loaded for current user
          if (newCurrentUser.id !== profile?.id || !profile) {
             await fetchUserProfileAndNotifications(newCurrentUser.id);
          }
        } else {
          // User signed out
          setProfile(null);
          setUnreadNotificationsCount(0);
        }
        // Ensure loading is false after initial auth state is processed, especially if no user.
        if (_event === 'INITIAL_SESSION' && !newCurrentUser) {
          setLoading(false);
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [fetchUserProfileAndNotifications]); // fetchUserProfileAndNotifications is stable due to useCallback

  // Effect for Realtime Notification Subscription
  useEffect(() => {
    const currentUserId = user?.id;

    // Cleanup previous channel if user changes or component unmounts
    if (notificationChannelRef.current) {
        supabase.removeChannel(notificationChannelRef.current)
            .then(status => console.log('Previous notification channel removed:', status))
            .catch(err => console.error('Error removing previous channel:', err));
        notificationChannelRef.current = null;
    }

    if (currentUserId) {
      console.log(`Attempting to subscribe to notifications for user ${currentUserId}`);
      const channel = supabase
        .channel(`public:notifications:user_id=eq.${currentUserId}`) // More specific channel name
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` },
          (payload) => {
            console.log('New notification event received via RT:', payload);
            // Optimistically increment or re-fetch full count
            // setUnreadNotificationsCount(prev => prev + 1); // Replaced with refreshUnreadCount for accuracy
            // Or, for more accuracy if other clients might mark as read:
            refreshUnreadCount();
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log(`RT Subscribed to notifications for user ${currentUserId}`);
          } else if (err) {
            console.error(`RT Notification subscription error for user ${currentUserId}:`, err);
          } else {
             console.log(`RT Notification channel status for ${currentUserId}: ${status}`);
          }
        });
      notificationChannelRef.current = channel;
    }

    return () => {
      if (notificationChannelRef.current) {
        console.log('Notification effect cleanup, removing channel:', notificationChannelRef.current.topic);
        supabase.removeChannel(notificationChannelRef.current)
            .then(status => console.log('Channel removal status on effect cleanup:', status))
            .catch(err => console.error('Error removing channel on cleanup:', err));
        notificationChannelRef.current = null;
      }
    };
  }, [user?.id, refreshUnreadCount]); // Re-subscribe if user.id changes

  const login = async (email: string, password: string) => {
    // setLoading(true); // Don't set main loading here, onAuthStateChange will handle user/profile loading
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    // setLoading(true); // Don't set main loading here
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName } }
    });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    // State resets (profile, unreadCount) are handled by onAuthStateChange
  };

  const isAdmin = profile?.role === 'admin';
  const isAgent = profile?.role === 'agent';
  const isCustomer = profile?.role === 'customer';

  return (
    <AuthContext.Provider value={{
        session, user, profile, loading, isProfileLoading, unreadNotificationsCount,
        login, signUp, logout, fetchUserProfile: fetchUserProfileAndNotifications, // Expose the combined fetcher
        isAdmin, isAgent, isCustomer, refreshUnreadCount
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
