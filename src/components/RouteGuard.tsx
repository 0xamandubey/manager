import React, { useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { AuthView } from '../views/AuthView';
import { OnboardingView } from '../views/OnboardingView';
import { syncService } from '../services/syncService';

interface RouteGuardProps {
  children: React.ReactNode;
}

export function RouteGuard({ children }: RouteGuardProps) {
  const { isLoaded, isSignedIn, user } = useAuth();

  // Query local IndexedDB user profile by Supabase User ID (googleId index)
  const localProfile = useLiveQuery(
    async () => {
      if (!user?.id) return undefined;
      const profile = await db.users.get(user.id);
      return profile || null; // Return null if record is not found in database
    },
    [user?.id]
  );

  // Initialize and run the synchronization service when authenticated
  useEffect(() => {
    if (isSignedIn) {
      syncService.start();
      return () => {
        syncService.stop();
      };
    }
  }, [isSignedIn]);

  // Seed local user profile record if missing
  useEffect(() => {
    async function seedLocalProfile() {
      if (isSignedIn && user && localProfile === null) {
        try {
          await db.users.put({
            googleId: user.id,
            fullName: user.name,
            email: user.email,
            profilePhoto: user.picture,
            authProvider: user.authProvider,
            createdDate: Date.now(),
            lastLogin: Date.now(),
            businessId: '',
            branchId: ''
          });
        } catch (err) {
          console.warn('Failed to seed local user profile:', err);
        }
      }
    }
    seedLocalProfile();
  }, [isSignedIn, user, localProfile]);

  // Update last login timestamp in local DB if needed
  useEffect(() => {
    async function updateLastLogin() {
      if (!user?.id || !localProfile) return;
      const oneHour = 60 * 60 * 1000;
      if (Date.now() - localProfile.lastLogin > oneHour) {
        try {
          await db.users.update(user.id, { lastLogin: Date.now() });
        } catch (err) {
          console.warn('Failed to update last login timestamp:', err);
        }
      }
    }
    updateLastLogin();
  }, [user?.id, localProfile]);

  // 1. Loading state (Supabase SDK or IndexedDB query)
  if (!isLoaded) {
    return <SkeletonDashboard />;
  }

  // 2. Unauthenticated state (redirect immediately to login)
  if (!isSignedIn) {
    return <AuthView />;
  }

  // 3. Authenticated, but waiting for IndexedDB profile query to finish
  if (localProfile === undefined) {
    return <SkeletonDashboard />;
  }

  // 4. Authenticated, but has not completed onboarding
  if (localProfile === null || !localProfile.businessId) {
    return <OnboardingView />;
  }

  // 5. Fully authenticated and onboarded
  return <>{children}</>;
}

// Beautiful skeleton screen mimicking the premium dashboard structure
function SkeletonDashboard() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F6F2EB] dark:bg-[#121110] transition-colors duration-200 w-screen overflow-hidden">
      
      {/* Sidebar Placeholder */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[#ECE8E1] dark:border-[#3C3A39]/30 bg-white/20 dark:bg-[#1C1A19]/25 backdrop-blur-md p-6 gap-6 shrink-0">
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-stone-300 dark:bg-stone-850" />
          <div className="h-4 bg-stone-300 dark:bg-stone-850 rounded w-24" />
        </div>
        <div className="flex flex-col gap-5 mt-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-4 h-4 rounded bg-stone-250 dark:bg-stone-900" />
              <div className="h-3 bg-stone-250 dark:bg-stone-900 rounded w-20" />
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col min-h-screen">
        
        {/* Header Placeholder */}
        <header className="h-16 border-b border-[#ECE8E1] dark:border-[#3C3A39]/30 bg-white/20 dark:bg-[#1C1A19]/25 backdrop-blur-md px-6 flex items-center justify-between shrink-0 animate-pulse">
          <div className="h-4 bg-stone-300 dark:bg-stone-850 rounded w-32" />
          <div className="flex items-center gap-4">
            <div className="w-24 h-8 rounded-xl bg-stone-300 dark:bg-stone-850" />
            <div className="w-8 h-8 rounded-full bg-stone-300 dark:bg-stone-850" />
          </div>
        </header>

        {/* Content Placeholder Grid */}
        <main className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
          {/* Top row: 3 stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card rounded-2xl p-5 border border-[#ECE8E1] dark:border-[#3C3A39]/30 bg-white/10 dark:bg-[#1C1A19]/15 backdrop-blur-md flex flex-col gap-3 animate-pulse">
                <div className="h-3 bg-stone-250 dark:bg-stone-900 rounded w-16" />
                <div className="h-6 bg-stone-300 dark:bg-stone-850 rounded w-24" />
              </div>
            ))}
          </div>

          {/* Main Area: Split cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow">
            <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-[#ECE8E1] dark:border-[#3C3A39]/30 bg-white/10 dark:bg-[#1C1A19]/15 backdrop-blur-md flex flex-col gap-4 animate-pulse min-h-[300px]">
              <div className="h-4 bg-stone-300 dark:bg-stone-850 rounded w-36" />
              <div className="flex-grow flex flex-col gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 bg-stone-250 dark:bg-stone-900 rounded-xl w-full" />
                ))}
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-[#ECE8E1] dark:border-[#3C3A39]/30 bg-white/10 dark:bg-[#1C1A19]/15 backdrop-blur-md flex flex-col gap-4 animate-pulse min-h-[300px]">
              <div className="h-4 bg-stone-300 dark:bg-stone-850 rounded w-28" />
              <div className="flex-grow flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-stone-250 dark:bg-stone-900 rounded-xl w-full" />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
