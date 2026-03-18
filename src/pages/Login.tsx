import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

function PawIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="4" r="2" />
      <circle cx="18" cy="8" r="2" />
      <circle cx="4" cy="8" r="2" />
      <path d="M12 22c-4 0-7-3-7-6 0-2 1-4 3-5l2-1 2-1 2 1 2 1c2 1 3 3 3 5 0 3-3 6-7 6z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function Login() {
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left Panel ─────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ backgroundColor: '#f7f6f3' }}
      >
        {/* Subtle background blobs */}
        <div
          className="absolute top-0 left-0 w-96 h-96 rounded-full opacity-50 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #e0f2fe, transparent)' }}
        />
        <div
          className="absolute bottom-0 right-0 w-[28rem] h-[28rem] rounded-full opacity-40 translate-x-1/3 translate-y-1/3 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #dbeafe, transparent)' }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
            style={{ backgroundColor: '#111827' }}
          >
            <PawIcon className="w-4 h-4 text-white" />
          </div>
          <span
            className="font-bold text-lg tracking-tight"
            style={{ letterSpacing: '-0.02em' }}
          >
            <span style={{ color: '#1937E6' }}>Smart</span><span style={{ color: '#111827' }}>Pet</span>
          </span>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-5">
          <div>
            <h1
              className="text-5xl font-bold leading-tight"
              style={{ color: '#111827', letterSpacing: '-0.03em' }}
            >
              Smart Monitoring,
            </h1>
            <h1
              className="text-5xl font-bold leading-tight"
              style={{ color: '#1937E6', letterSpacing: '-0.03em' }}
            >
              Effortless Care.
            </h1>
          </div>
          <p className="text-lg leading-relaxed max-w-sm" style={{ color: '#6b7280' }}>
            AI-powered sensor monitoring to track your pet's health and environment in real time.
          </p>
        </div>

        {/* Stats */}
        <div className="relative z-10 grid grid-cols-2 gap-4">
          <div
            className="bg-white rounded-2xl p-5 shadow-sm"
            style={{ border: '1px solid #e5e7eb' }}
          >
            <p
              className="text-3xl font-bold"
              style={{ color: '#111827', letterSpacing: '-0.03em' }}
            >
              &lt;&nbsp;15s
            </p>
            <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>
              Update latency
            </p>
          </div>
          <div
            className="bg-white rounded-2xl p-5 shadow-sm"
            style={{ border: '1px solid #e5e7eb' }}
          >
            <p
              className="text-3xl font-bold"
              style={{ color: '#111827', letterSpacing: '-0.03em' }}
            >
              100%
            </p>
            <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>
              Private &amp; secure
            </p>
          </div>
        </div>
      </div>

      {/* ── Right Panel ────────────────────────────────── */}
      <div className="w-full lg:w-1/2 bg-white flex flex-col items-center justify-center p-8 lg:p-16">

        {/* Mobile logo */}
        <div className="lg:hidden mb-10 flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
            style={{ backgroundColor: '#111827' }}
          >
            <PawIcon className="w-4 h-4 text-white" />
          </div>
          <span
            className="font-bold text-lg tracking-tight"
            style={{ letterSpacing: '-0.02em' }}
          >
            <span style={{ color: '#1937E6' }}>Smart</span><span style={{ color: '#111827' }}>Pet</span>
          </span>
        </div>

        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-8">
            <h2
              className="text-3xl font-bold mb-2"
              style={{ color: '#111827', letterSpacing: '-0.03em' }}
            >
              Welcome back
            </h2>
            <p style={{ color: '#9ca3af' }}>Sign in to continue to your dashboard</p>
          </div>

          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 font-semibold text-sm py-3.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#111827',
              color: '#ffffff',
              border: 'none',
            }}
            onMouseEnter={e => {
              if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1f2937';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#111827';
            }}
          >
            <GoogleIcon />
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>

          {error && (
            <div
              className="mt-4 text-sm px-4 py-3 rounded-xl"
              style={{
                color: '#dc2626',
                border: '1px solid #fecaca',
                backgroundColor: '#fef2f2',
              }}
            >
              {error}
            </div>
          )}

          <p className="text-center text-xs mt-8" style={{ color: '#9ca3af' }}>
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
