import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { AuthView } from '../views/AuthView';
import { OnboardingView } from '../views/OnboardingView';
import { syncService } from '../services/syncService';
import { supabase } from '../supabaseClient';

interface RouteGuardProps {
  children: React.ReactNode;
}

export function RouteGuard({ children }: RouteGuardProps) {
  const { isLoaded, isSignedIn, user } = useAuth();
  const [isSeeding, setIsSeeding] = useState(false);
  const [hasCheckedSupabase, setHasCheckedSupabase] = useState(false);

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

  // Seed local user profile record if missing, fetching existing business details if they exist in Supabase
  useEffect(() => {
    async function seedLocalProfile() {
      if (isSignedIn && user && !hasCheckedSupabase) {
        // Wait for IndexedDB profile to load first
        if (localProfile === undefined) return;

        // Check if profile is missing OR exists but doesn't have a businessId
        if (localProfile === null || !localProfile.businessId) {
          setIsSeeding(true);
          try {
            // Check if user already has a business registered in Supabase
            const { data: businesses, error: busError } = await supabase
              .from('businesses')
              .select('id, name, settings')
              .eq('owner_id', user.id);

            if (busError) throw busError;

            if (businesses && businesses.length > 0) {
              // Existing business found, restore it
              const existingBusiness = businesses[0];
              const businessId = existingBusiness.id;

              // Fetch branches for this business
              const { data: branches, error: branchError } = await supabase
                .from('branches')
                .select('id, name')
                .eq('business_id', businessId);

              if (branchError) throw branchError;

              let branchId = '';
              if (branches && branches.length > 0) {
                branchId = branches[0].id;
              } else {
                // Create a default branch in Supabase if missing
                branchId = crypto.randomUUID();
                await supabase.from('branches').insert({
                  id: branchId,
                  business_id: businessId,
                  owner_id: user.id,
                  name: 'Main Branch'
                });
              }

              // Put user profile details with businessId and branchId in local Dexie
              await db.users.put({
                googleId: user.id,
                fullName: user.name,
                email: user.email,
                profilePhoto: user.picture,
                authProvider: user.authProvider,
                createdDate: localProfile?.createdDate || Date.now(),
                lastLogin: Date.now(),
                businessId,
                branchId
              });

              // Set active branch in localStorage
              localStorage.setItem('activeBranchId', branchId);

              // Populate local settings and branches tables
              db.syncing = true;
              try {
                if (branches && branches.length > 0) {
                  for (const b of branches) {
                    await db.branches.put({
                      id: b.id,
                      name: b.name
                    });
                  }
                } else {
                  await db.branches.put({
                    id: branchId,
                    name: 'Main Branch'
                  });
                }

                const settingsObj = existingBusiness.settings || {};
                await db.settings.put({
                  key: 'general',
                  businessName: existingBusiness.name || 'My Business',
                  currency: settingsObj.currency || '$',
                  weekStart: settingsObj.week_start !== undefined ? settingsObj.week_start : 1,
                  theme: settingsObj.theme || 'system'
                });
              } finally {
                db.syncing = false;
              }

              // Trigger data pull immediately
              syncService.triggerSync();
            } else {
              // New user, seed empty IDs to trigger onboarding view if not already seeded
              if (localProfile === null) {
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
              }
            }
          } catch (err) {
            console.warn('Failed to seed local user profile or fetch existing business:', err);
            // Fallback seed so user doesn't get stuck loading
            if (localProfile === null) {
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
              } catch (innerErr) {
                console.error('Critical fallback user profile seeding failed:', innerErr);
              }
            }
          } finally {
            setIsSeeding(false);
            setHasCheckedSupabase(true);
          }
        } else {
          // Profile exists and has a businessId, mark as checked
          setHasCheckedSupabase(true);
        }
      }
    }
    seedLocalProfile();
  }, [isSignedIn, user, localProfile, hasCheckedSupabase]);

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
    if (isSeeding) {
      return <SkeletonDashboard />;
    }
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
