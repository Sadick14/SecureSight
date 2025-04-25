import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';

export default function AuthCallback() {
  const router = useRouter();
  const { isLoading } = useAuth();

  useEffect(() => {
    const checkAuth = async () => {
      const userData = localStorage.getItem('user');
      if (userData) {
        router.push('/dashboard');
      } else {
        router.push('/login?error=auth_failed');
      }
    };

    if (!isLoading) {
      checkAuth();
    }
  }, [isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      Authenticating...
    </div>
  );
}
