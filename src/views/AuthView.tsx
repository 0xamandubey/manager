import React, { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { supabase } from '../supabaseClient';
import { AlertCircle } from 'lucide-react';

declare global {
  interface Window {
    google: any;
  }
}

const DISPOSABLE_DOMAINS = [
  'mailinator.com', 'yopmail.com', 'tempmail.com', '10minutemail.com', 
  'dispostable.com', 'guerrillamail.com', 'sharklasers.com', 'getairmail.com'
];

function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase().trim();
  return DISPOSABLE_DOMAINS.includes(domain);
}

export function AuthView() {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [sdkLoaded, setSdkLoaded] = useState(true);

  // Email+Password states
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    let checkInterval: any;
    let timeout: any;

    const initGoogle = () => {
      try {
        if (window.google?.accounts?.id) {
          const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: false,
          });

          const buttonParent = document.getElementById('google-signin-btn');
          if (buttonParent) {
            window.google.accounts.id.renderButton(buttonParent, {
              type: 'standard',
              theme: 'outline',
              size: 'large',
              text: 'continue_with',
              shape: 'pill',
              width: '280',
            });
          }
        } else {
          setSdkLoaded(false);
        }
      } catch (err) {
        console.error('Google SDK init error:', err);
        setSdkLoaded(false);
      }
    };

    if (window.google?.accounts?.id) {
      initGoogle();
    } else {
      checkInterval = setInterval(() => {
        if (window.google?.accounts?.id) {
          setSdkLoaded(true);
          initGoogle();
          clearInterval(checkInterval);
          clearTimeout(timeout);
        }
      }, 100);

      timeout = setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.google?.accounts?.id) {
          setSdkLoaded(false);
        }
      }, 8000);
    }

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
    };
  }, []);

  const handleCredentialResponse = async (response: any) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      if (!response.credential) {
        throw new Error('No credential received.');
      }
      
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.credential
      });

      if (error) throw error;
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setErrorMsg(err.message || 'Google Sign-in failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    const emailClean = email.trim().toLowerCase();

    if (!emailClean || !password) {
      setErrorMsg('Please fill in all fields.');
      setIsLoading(false);
      return;
    }

    try {
      if (authMode === 'signup') {
        if (!fullName.trim()) {
          throw new Error('Please enter your full name.');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        if (isDisposableEmail(emailClean)) {
          throw new Error('Registrations from disposable email domains are blocked.');
        }

        const { error } = await signUpWithEmail(emailClean, password, fullName.trim());
        if (error) throw error;
      } else {
        const { error } = await signInWithEmail(emailClean, password);
        if (error) throw error;
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F2EB] dark:bg-[#121110] transition-colors duration-200 w-screen overflow-hidden auth-bg-grid p-4 sm:p-6">
      
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-[#B08A4A]/5 dark:bg-[#B08A4A]/10 blur-3xl pointer-events-none" />

      {/* Centered Auth Card Panel */}
      <div className="max-w-sm w-full flex flex-col gap-5 animate-scale-up relative z-10">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-xl font-bold text-[#3A281C] dark:text-[#F5F5F5] tracking-tight mt-0.5">
            Welcome to the Manager
          </h1>
        </div>

        {/* Auth Glassmorphic Card */}
        <div className="glass-card rounded-2xl p-6 border border-[#ECE8E1] dark:border-[#3C3A39]/30 bg-white/20 dark:bg-[#1C1A19]/25 backdrop-blur-md shadow-xl flex flex-col gap-4 relative overflow-hidden">
          
          {/* Top colored accent indicator */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#B08A4A]/40 to-transparent" />

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 rounded-xl flex gap-2 items-start animate-fade-in">
              <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <span className="text-3xs font-semibold text-red-650 dark:text-red-400 leading-normal">{errorMsg}</span>
            </div>
          )}

          {/* 1. Google Authentication flow */}
          <div className="flex flex-col items-center justify-center min-h-[50px] w-full">
            {isLoading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-[#B08A4A] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col items-center w-full">
                {sdkLoaded ? (
                  <div 
                    id="google-signin-btn" 
                    className="flex justify-center transition-all duration-300 w-full hover:scale-[1.01]"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="w-full py-2.5 bg-[#3A281C] dark:bg-[#B08A4A] text-white text-xs font-bold rounded-xl transition-all uppercase tracking-wider text-center"
                  >
                    Load Social Login
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Or Divider */}
          <div className="flex items-center gap-3 w-full py-1">
            <div className="h-[1px] bg-stone-200 dark:bg-stone-850 flex-grow" />
            <span className="text-5xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">or</span>
            <div className="h-[1px] bg-stone-200 dark:bg-stone-850 flex-grow" />
          </div>

          {/* 2. Email + Password Credentials Form */}
          <form onSubmit={handleEmailAuthSubmit} className="flex flex-col gap-3">
            
            {authMode === 'signup' && (
              <input
                type="text"
                required
                placeholder="Full Name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                disabled={isLoading}
                className="w-full px-3 py-2 rounded-xl border border-stone-250 dark:border-stone-850 bg-white/60 dark:bg-[#1C1A19]/50 text-xs text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-[#B08A4A] dark:focus:border-[#B08A4A]"
              />
            )}

            <input
              type="email"
              required
              placeholder="Email Address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 rounded-xl border border-stone-250 dark:border-stone-850 bg-white/60 dark:bg-[#1C1A19]/50 text-xs text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-[#B08A4A] dark:focus:border-[#B08A4A]"
            />

            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 rounded-xl border border-stone-250 dark:border-stone-850 bg-white/60 dark:bg-[#1C1A19]/50 text-xs text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-[#B08A4A] dark:focus:border-[#B08A4A]"
            />

            {authMode === 'signup' && (
              <input
                type="password"
                required
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                className="w-full px-3 py-2 rounded-xl border border-stone-250 dark:border-stone-850 bg-white/60 dark:bg-[#1C1A19]/50 text-xs text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-[#B08A4A] dark:focus:border-[#B08A4A]"
              />
            )}

            {/* Action Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full py-2.5 bg-[#3A281C] hover:bg-[#2A1D14] dark:bg-[#B08A4A] dark:hover:bg-[#9B773E] text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-[#B08A4A]/5 uppercase tracking-wider disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : authMode === 'signup' ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          {/* Toggle Modes link */}
          <div className="text-center mt-1">
            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setAuthMode(prev => prev === 'signin' ? 'signup' : 'signin');
              }}
              className="text-4xs text-[#B08A4A] hover:underline font-semibold tracking-wide"
            >
              {authMode === 'signin' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
