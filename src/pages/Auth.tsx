import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const AuthPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        // Użytkownik jest zalogowany, przekieruj do strony wyboru trybu gry
        navigate('/game-modes');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded shadow-md">
        <h2 className="text-2xl font-bold text-center">
          {isLogin ? 'Zaloguj się' : 'Zarejestruj się'}
        </h2>
        <Auth
          supabaseClient={supabase}
          providers={[]} // Możesz dodać dostawców zewnętrznych, np. ['google']
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: 'hsl(var(--primary))',
                  brandAccent: 'hsl(var(--primary-foreground))',
                },
              },
            },
          }}
          theme="light" // Możesz zmienić na 'dark' lub 'system'
          view={isLogin ? 'sign_in' : 'sign_up'}
        />
      </div>
    </div>
  );
};

export default AuthPage;