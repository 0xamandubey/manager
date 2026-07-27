import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { db } from '../db/db';
import { syncService } from '../services/syncService';

export interface AuthUser {
  id: string; // Supabase UID
  email: string;
  name: string;
  picture?: string;
  authProvider: 'google' | 'email';
}

interface AuthContextType {
  user: AuthUser | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: any }>;
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // 1. Fetch initial session on startup
    async function initSession() {
      if (!isSupabaseConfigured()) {
        setIsLoaded(true);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const userMeta = session.user.user_metadata;
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            name: userMeta?.full_name || userMeta?.name || 'Owner/Admin',
            picture: userMeta?.avatar_url || userMeta?.picture || undefined,
            authProvider: session.user.app_metadata.provider === 'google' ? 'google' : 'email'
          });
        }
      } catch (err) {
        console.error('Failed to load initial Supabase session:', err);
      } finally {
        setIsLoaded(true);
      }
    }

    initSession();

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const userMeta = session.user.user_metadata;
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          name: userMeta?.full_name || userMeta?.name || 'Owner/Admin',
          picture: userMeta?.avatar_url || userMeta?.picture || undefined,
          authProvider: session.user.app_metadata.provider === 'google' ? 'google' : 'email'
        });
      } else {
        setUser(null);
      }
      setIsLoaded(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    // Redirects to Google login
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    return { error };
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
    return { error };
  };

  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName.trim()
        }
      }
    });
    return { error };
  };

  const signOut = async () => {
    // Try to perform a final sync push before signing out to prevent data loss
    try {
      if (navigator.onLine) {
        await syncService.triggerSync();
      }
    } catch (syncErr) {
      console.warn('Final sync before sign-out failed:', syncErr);
    }

    // 1. Trigger Supabase Sign Out
    await supabase.auth.signOut();
    
    // 2. Reset sync tracking timestamps
    localStorage.removeItem('last_synced_at');
    localStorage.removeItem('activeBranchId');

    // 3. Clear all cached business data in IndexedDB (except outbox logs)
    db.syncing = true;
    try {
      await db.transaction('rw', db.tables, async () => {
        for (const table of db.tables) {
          if (table.name !== 'syncOutbox') {
            await table.clear();
          }
        }
      });
    } catch (err) {
      console.warn('Failed to clear IndexedDB tables on sign-out:', err);
    } finally {
      db.syncing = false;
    }

    setUser(null);
    window.location.reload();
  };

  // If Supabase keys are not set, display setup details
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F2EB] dark:bg-[#121110] px-4">
        <div className="glass-card max-w-md w-full p-8 rounded-2xl border border-[#ECE8E1] dark:border-[#3C3A39] shadow-xl text-center flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#3A281C] dark:bg-[#B08A4A] flex items-center justify-center text-white font-bold text-lg">
            A
          </div>
          <h2 className="text-lg font-bold text-[#3A281C] dark:text-[#F5F5F5] tracking-tight">
            Supabase Configuration Required
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
            Please configure your Supabase URL and Anon Key in the <code className="bg-stone-200 dark:bg-stone-850 px-1.5 py-0.5 rounded font-mono">.env</code> file:
          </p>
          <pre className="bg-stone-100 dark:bg-stone-900/60 p-3 rounded-xl border border-stone-200 dark:border-stone-850/60 font-mono text-5xs text-left w-full text-stone-650 dark:text-stone-300 overflow-x-auto">
            VITE_SUPABASE_URL=https://your-ref.supabase.co{"\n"}
            VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
          </pre>
          <p className="text-3xs text-stone-400 dark:text-stone-500">
            Obtain your API credentials from your Supabase Console, add them to your environment variables, and restart the server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoaded,
        isSignedIn: !!user,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
