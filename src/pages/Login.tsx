import { useState } from 'react';
import type { FormEvent } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

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

export default function Login() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left Panel ─────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-50 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background blobs */}
        <div
          className="absolute top-0 left-0 w-80 h-80 rounded-full opacity-40 -translate-x-1/2 -translate-y-1/2"
          style={{ background: 'radial-gradient(circle, #bbf7d0, transparent)' }}
        />
        <div
          className="absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-30 translate-x-1/3 translate-y-1/3"
          style={{ background: 'radial-gradient(circle, #dcfce7, transparent)' }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center shadow-sm">
            <PawIcon className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg tracking-tight">SmartPet</span>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-5">
          <div>
            <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-1">智能寵物，</h1>
            <h1 className="text-5xl font-bold leading-tight text-green-600">輕鬆掌握。</h1>
          </div>
          <p className="text-gray-500 text-lg leading-relaxed max-w-sm">
            AI 驅動的感測器監控，即時掌握寵物的每個動態與環境狀態。
          </p>
        </div>

        {/* Stats */}
        <div className="relative z-10 grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-3xl font-bold text-gray-900">&lt;&nbsp;15秒</p>
            <p className="text-gray-400 text-sm mt-1">即時更新延遲</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-3xl font-bold text-gray-900">100%</p>
            <p className="text-gray-400 text-sm mt-1">隱私安全</p>
          </div>
        </div>
      </div>

      {/* ── Right Panel ────────────────────────────────── */}
      <div className="w-full lg:w-1/2 bg-white flex flex-col items-center justify-center p-8 lg:p-16">

        {/* Mobile logo */}
        <div className="lg:hidden mb-10 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center shadow-sm">
            <PawIcon className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg tracking-tight">SmartPet</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">歡迎回來</h2>
            <p className="text-gray-400">登入以繼續使用工作台</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                電子郵件
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full bg-gray-50 border border-gray-200 text-gray-900
                           text-sm px-4 py-3 rounded-xl placeholder-gray-400
                           focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10
                           transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                密碼
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-50 border border-gray-200 text-gray-900
                           text-sm px-4 py-3 rounded-xl placeholder-gray-400
                           focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10
                           transition-all"
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm border border-red-200 bg-red-50 px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700
                         text-white font-semibold text-sm py-3.5 rounded-xl
                         transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                         shadow-sm"
            >
              {loading ? '登入中…' : '登入'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-8">
            登入即表示您同意我們的服務條款與隱私政策
          </p>
        </div>
      </div>
    </div>
  );
}
