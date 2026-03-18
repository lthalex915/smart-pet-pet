import { useState } from 'react';
import type { FormEvent } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm border border-cyan-500/40 bg-gray-900 rounded-xl p-6 shadow-2xl shadow-cyan-500/10">
        <h1 className="text-cyan-400 font-mono text-xl font-bold text-center mb-1">
          &#187; CYBERPUNK HUD
        </h1>
        <p className="text-gray-500 font-mono text-xs text-center mb-6">
          SECURE ACCESS TERMINAL v2.0
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-cyan-400/70 font-mono text-xs mb-1">
              USER.ID
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@domain.com"
              className="w-full bg-gray-800 border border-cyan-500/30 text-cyan-200
                         font-mono text-sm px-3 py-2 rounded-lg
                         focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-cyan-400/70 font-mono text-xs mb-1">
              PASSKEY
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-gray-800 border border-cyan-500/30 text-cyan-200
                         font-mono text-sm px-3 py-2 rounded-lg
                         focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>

          {error && (
            <div className="text-red-400 font-mono text-xs border border-red-500/30
                            bg-red-500/10 px-3 py-2 rounded-lg">
              !! {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500
                       text-cyan-400 font-mono font-bold text-sm py-2.5 rounded-lg
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'AUTHENTICATING…' : '>> ACCESS SYSTEM'}
          </button>
        </form>
      </div>
    </div>
  );
}
