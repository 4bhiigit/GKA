'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { exchangeGitHubCode } from '../../../lib/api';
import { Loader2, AlertCircle } from 'lucide-react';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const executedRef = useRef(false);

  useEffect(() => {
    const code = searchParams.get('code');

    if (!code) {
      setError('No authorization code provided in URL');
      return;
    }

    // Prevent duplicate exchange in React StrictMode
    if (executedRef.current) return;
    executedRef.current = true;

    exchangeGitHubCode(code)
      .then((data) => {
        if (data.user?.id) {
          localStorage.setItem('gka_user_id', data.user.id);
          localStorage.setItem('gka_user', JSON.stringify(data.user));
        }
        router.replace('/');
      })
      .catch((err) => {
        console.error('OAuth callback error:', err);
        setError(err.message || 'Failed to complete GitHub sign-in');
      });
  }, [searchParams, router]);

  return (
    <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center shadow-2xl">
      {!error ? (
        <div className="space-y-4">
          <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 mx-auto flex items-center justify-center text-white">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <h2 className="text-base font-semibold text-white">
            Authenticating with GitHub
          </h2>
          <p className="text-xs text-zinc-400">
            Connecting your profile and private repositories...
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="w-12 h-12 rounded-xl bg-red-950 border border-red-800 mx-auto flex items-center justify-center text-red-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold text-white">
            Authentication Failed
          </h2>
          <p className="text-xs text-red-300">
            {error}
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-white text-black hover:bg-zinc-200 transition-all"
          >
            Return Home
          </button>
        </div>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-white" />
            <p className="text-xs text-zinc-400 mt-2">Loading authentication...</p>
          </div>
        }
      >
        <CallbackContent />
      </Suspense>
    </div>
  );
}
