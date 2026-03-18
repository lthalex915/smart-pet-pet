import { useEffect, useState }                   from 'react';
import { onAuthStateChanged }                    from 'firebase/auth';
import type { User }                             from 'firebase/auth';
import { auth }                                  from './firebase';
import Login     from './pages/Login';
import Register  from './pages/Register';
import Dashboard from './pages/Dashboard';

type AuthPage = 'login' | 'register';

export default function App() {
  const [user,         setUser]         = useState<User | null>(null);
  const [loading,      setLoading]      = useState<boolean>(true);
  const [authPage,     setAuthPage]     = useState<AuthPage>('login');
  const [prefillEmail, setPrefillEmail] = useState<string>('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u: User | null) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const goToRegister = (email?: string) => {
    setPrefillEmail(email ?? '');
    setAuthPage('register');
  };

  const goToLogin = () => {
    setAuthPage('login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <circle cx="11" cy="4" r="2" />
            <circle cx="18" cy="8" r="2" />
            <circle cx="4" cy="8" r="2" />
            <path d="M12 22c-4 0-7-3-7-6 0-2 1-4 3-5l2-1 2-1 2 1 2 1c2 1 3 3 3 5 0 3-3 6-7 6z" />
          </svg>
        </div>
        <p className="text-gray-400 text-sm font-medium animate-pulse">載入中…</p>
      </div>
    );
  }

  if (user) {
    return <Dashboard user={user} />;
  }

  if (authPage === 'register') {
    return (
      <Register
        prefillEmail={prefillEmail}
        onBackToLogin={goToLogin}
      />
    );
  }

  return <Login onGoToRegister={goToRegister} />;
}
