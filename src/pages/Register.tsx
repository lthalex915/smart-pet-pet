import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
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

interface Props {
  prefillEmail?: string;
  onBackToLogin: () => void;
}

export default function Register({ prefillEmail = '', onBackToLogin }: Props) {
  const [email,    setEmail]    = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('兩次輸入的密碼不相符');
      return;
    }
    if (password.length < 6) {
      setError('密碼至少需要 6 個字元');
      return;
    }

    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      // onAuthStateChanged in App.tsx will handle redirect
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/email-already-in-use') {
        setError('此電子郵件已被使用，請直接登入');
      } else if (code === 'auth/invalid-email') {
        setError('電子郵件格式不正確');
      } else if (code === 'auth/weak-password') {
        setError('密碼強度不足，請使用至少 6 個字元');
      } else {
        setError(err instanceof Error ? err.message : '註冊失敗，請稍後再試');
      }
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
          <span className="font-bold text-lg tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            <span style={{ color: '#1937E6' }}>Smart</span><span style={{ color: '#111827' }}>Pet</span>
          </span>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-5">
          <div>
            <h1 className="text-5xl font-bold leading-tight" style={{ color: '#111827', letterSpacing: '-0.03em' }}>
              Join SmartPet,
            </h1>
            <h1 className="text-5xl font-bold leading-tight" style={{ color: '#1937E6', letterSpacing: '-0.03em' }}>
              Start Caring.
            </h1>
          </div>
          <p className="text-lg leading-relaxed max-w-sm" style={{ color: '#6b7280' }}>
            Create your account to start monitoring your pet's health and environment in real time.
          </p>
        </div>

        {/* Stats */}
        <div className="relative z-10 grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: '1px solid #e5e7eb' }}>
            <p className="text-3xl font-bold" style={{ color: '#111827', letterSpacing: '-0.03em' }}>&lt;&nbsp;15s</p>
            <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>Update latency</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: '1px solid #e5e7eb' }}>
            <p className="text-3xl font-bold" style={{ color: '#111827', letterSpacing: '-0.03em' }}>100%</p>
            <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>Private &amp; secure</p>
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
          <span className="font-bold text-lg tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            <span style={{ color: '#1937E6' }}>Smart</span><span style={{ color: '#111827' }}>Pet</span>
          </span>
        </div>

        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2" style={{ color: '#111827', letterSpacing: '-0.03em' }}>
              建立帳號
            </h2>
            <p style={{ color: '#9ca3af' }}>填寫以下資料即可免費使用</p>
          </div>

          {/* Register Form */}
          <form onSubmit={handleRegister} className="space-y-3">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
                電子郵件
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  border: '1.5px solid #e5e7eb',
                  color: '#111827',
                  backgroundColor: '#fafafa',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#1937E6'; e.currentTarget.style.backgroundColor = '#fff'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#fafafa'; }}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
                密碼
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="至少 6 個字元"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  border: '1.5px solid #e5e7eb',
                  color: '#111827',
                  backgroundColor: '#fafafa',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#1937E6'; e.currentTarget.style.backgroundColor = '#fff'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#fafafa'; }}
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
                確認密碼
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="再輸入一次密碼"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  border: '1.5px solid #e5e7eb',
                  color: '#111827',
                  backgroundColor: '#fafafa',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#1937E6'; e.currentTarget.style.backgroundColor = '#fff'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#fafafa'; }}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 font-semibold text-sm py-3.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-1"
              style={{ backgroundColor: '#1937E6', color: '#ffffff', border: 'none' }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1430c4'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1937E6'; }}
            >
              {loading ? '建立中…' : '建立帳號'}
            </button>
          </form>

          {error && (
            <div
              className="mt-4 text-sm px-4 py-3 rounded-xl"
              style={{ color: '#dc2626', border: '1px solid #fecaca', backgroundColor: '#fef2f2' }}
            >
              {error}
            </div>
          )}

          {/* Back to Login */}
          <p className="text-center text-sm mt-6" style={{ color: '#9ca3af' }}>
            已有帳號？{' '}
            <button
              type="button"
              onClick={onBackToLogin}
              className="font-semibold transition-colors"
              style={{ color: '#1937E6' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#1430c4'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#1937E6'; }}
            >
              登入
            </button>
          </p>

          <p className="text-center text-xs mt-4" style={{ color: '#9ca3af' }}>
            建立帳號即代表您同意我們的服務條款與隱私政策。
          </p>
        </div>
      </div>
    </div>
  );
}
