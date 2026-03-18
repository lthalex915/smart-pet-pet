import { useEffect, useState }                   from 'react';
import { onAuthStateChanged }                    from 'firebase/auth';
import type { User }                             from 'firebase/auth';
import { auth }                                  from './firebase';
import Login     from './pages/Login';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u: User | null) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-cyan-400 font-mono text-lg animate-pulse">
          SYSTEM BOOT…
        </p>
      </div>
    );
  }

  return user ? <Dashboard user={user} /> : <Login />;
}