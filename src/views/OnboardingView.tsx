import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { db } from '../db/db';
import { supabase } from '../supabaseClient';
import { Building, User, Phone, MapPin, Briefcase, GitBranch, ArrowRight } from 'lucide-react';

export function OnboardingView() {
  const { user } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState(user?.name || '');
  const [mobileNumber, setMobileNumber] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessType, setBusinessType] = useState('Retail');
  const [branchName, setBranchName] = useState('Main Branch');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setErrorMsg('');
    setIsLoading(true);

    if (!businessName.trim() || !ownerName.trim() || !branchName.trim()) {
      setErrorMsg('Business Name, Owner Name, and Branch Name are required.');
      setIsLoading(false);
      return;
    }

    try {
      const businessId = crypto.randomUUID();
      const branchId = crypto.randomUUID();

      // 1. Write Business to Supabase
      const { error: busError } = await supabase.from('businesses').insert({
        id: businessId,
        name: businessName.trim(),
        owner_id: user.id,
        settings: {
          business_name: businessName.trim(),
          currency: '$',
          week_start: 1,
          theme: 'system'
        }
      });
      if (busError) throw busError;

      // 2. Write default Branch to Supabase
      const { error: branchError } = await supabase.from('branches').insert({
        id: branchId,
        business_id: businessId,
        owner_id: user.id,
        name: branchName.trim()
      });
      if (branchError) throw branchError;

      // 3. Write User details to Dexie
      await db.users.put({
        googleId: user.id,
        fullName: ownerName.trim(),
        email: user.email,
        profilePhoto: user.picture,
        authProvider: user.authProvider,
        createdDate: Date.now(),
        lastLogin: Date.now(),
        businessId,
        branchId,
        mobileNumber: mobileNumber.trim(),
        businessAddress: businessAddress.trim(),
        businessType,
      });

      // 4. Save default branch and settings in Dexie locally (bypass sync logging)
      db.syncing = true;
      try {
        await db.branches.put({
          id: branchId,
          name: branchName.trim()
        });

        await db.settings.put({
          key: 'general',
          businessName: businessName.trim(),
          currency: '$',
          weekStart: 1,
          theme: 'system'
        });
      } finally {
        db.syncing = false;
      }

      // 5. Save settings to localStorage
      localStorage.setItem('activeBranchId', branchId);
      localStorage.setItem('last_synced_at', new Date().toISOString());

      // Reload to activate session and sync subscriptions
      window.location.reload();
    } catch (err: any) {
      console.error('Onboarding cloud initialization failed:', err);
      setErrorMsg(err.message || 'Failed to initialize business in cloud database.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F2EB] dark:bg-[#121110] p-4 sm:p-6 transition-colors duration-200">
      <div className="glass-card max-w-xl w-full p-6 sm:p-8 rounded-2xl border border-[#ECE8E1] dark:border-[#3C3A39]/30 shadow-xl animate-fade-in flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3A281C] dark:bg-[#B08A4A] flex items-center justify-center text-white font-bold text-lg">
              M
            </div>
            <div className="flex flex-col">
              <h2 className="text-lg font-bold text-[#3A281C] dark:text-[#F5F5F5] tracking-tight">
                Complete Business Onboarding
              </h2>
              <p className="text-4xs text-stone-500 dark:text-stone-400 font-semibold uppercase tracking-wider">
                Setup your cloud workspace to start managing attendance
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* Business & Owner Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide flex items-center gap-1.5">
                <Building size={12} className="text-[#B08A4A]" />
                Business Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Royal Oak Furnitures"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                disabled={isLoading}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-850 bg-white dark:bg-[#1C1A19] text-xs text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-[#B08A4A] dark:focus:border-[#B08A4A] transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide flex items-center gap-1.5">
                <User size={12} className="text-[#B08A4A]" />
                Owner/Admin Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. John Doe"
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
                disabled={isLoading}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-850 bg-white dark:bg-[#1C1A19] text-xs text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-[#B08A4A] dark:focus:border-[#B08A4A] transition-colors"
              />
            </div>
          </div>

          {/* Contact Mobile & Business Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide flex items-center gap-1.5">
                <Phone size={12} className="text-[#B08A4A]" />
                Mobile Number
              </label>
              <input
                type="tel"
                placeholder="e.g. +1 555-0199 (Optional)"
                value={mobileNumber}
                onChange={e => setMobileNumber(e.target.value)}
                disabled={isLoading}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-850 bg-white dark:bg-[#1C1A19] text-xs text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-[#B08A4A] dark:focus:border-[#B08A4A] transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide flex items-center gap-1.5">
                <Briefcase size={12} className="text-[#B08A4A]" />
                Business Type
              </label>
              <select
                value={businessType}
                onChange={e => setBusinessType(e.target.value)}
                disabled={isLoading}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#ECE8E1] dark:border-[#3C3A39]/30 bg-white dark:bg-[#1C1A19] text-xs text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-[#B08A4A] dark:focus:border-[#B08A4A] transition-colors"
              >
                <option value="Retail">Retail Store</option>
                <option value="Wholesale">Wholesale Trading</option>
                <option value="Manufacturing">Manufacturing / Workshop</option>
                <option value="Services">Services Business</option>
                <option value="Other">Other / General</option>
              </select>
            </div>
          </div>

          {/* Address & Branch */}
          <div className="flex flex-col gap-1.5">
            <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide flex items-center gap-1.5">
              <MapPin size={12} className="text-[#B08A4A]" />
              Business Address
            </label>
            <textarea
              rows={2}
              placeholder="Enter complete business/store address... (Optional)"
              value={businessAddress}
              onChange={e => setBusinessAddress(e.target.value)}
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-850 bg-white dark:bg-[#1C1A19] text-xs text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-[#B08A4A] dark:focus:border-[#B08A4A] transition-colors resize-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide flex items-center gap-1.5">
              <GitBranch size={12} className="text-[#B08A4A]" />
              Initial Branch Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Main Branch, Warehouse"
              value={branchName}
              onChange={e => setBranchName(e.target.value)}
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-850 bg-white dark:bg-[#1C1A19] text-xs text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-[#B08A4A] dark:focus:border-[#B08A4A] transition-colors"
            />
          </div>

          {errorMsg && (
            <p className="text-3xs text-red-500 font-semibold bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 p-2.5 rounded-xl">
              {errorMsg}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full py-3 rounded-xl bg-[#3A281C] hover:bg-[#2A1D14] dark:bg-[#B08A4A] dark:hover:bg-[#9B773E] text-white text-xs font-bold shadow-md shadow-accent/10 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            {isLoading ? 'Creating Workspace...' : 'Create Workspace'}
            {!isLoading && <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />}
          </button>
        </form>
      </div>
    </div>
  );
}
