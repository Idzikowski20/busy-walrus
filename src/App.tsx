import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/Auth"; // Import nowej strony Auth
import { supabase } from "./integrations/supabase/client"; // Import klienta Supabase
// Usunięto: import { SessionContextProvider } from '@supabase/auth-ui-react'; // Import SessionContextProvider
import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";

const queryClient = new QueryClient();

// Komponent do ochrony tras
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    // Możesz tutaj dodać spinner ładowania
    return <div>Ładowanie...</div>;
  }

  if (!session) {
    // Użytkownik nie jest zalogowany, przekieruj do strony logowania
    return <Navigate to="/login" replace />;
  }

  return children;
};


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      {/* Usunięto: <SessionContextProvider supabaseClient={supabase}> */}
        <BrowserRouter>
          <Routes>
            {/* Trasy chronione - wymagają zalogowania */}
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM PROTECTED ROUTES ABOVE THIS LINE */}

            {/* Trasy publiczne - nie wymagają zalogowania */}
            <Route path="/login" element={<AuthPage />} />
            <Route path="/register" element={<AuthPage />} /> {/* Używamy tej samej strony AuthPage */}
            {/* ADD ALL CUSTOM PUBLIC ROUTES ABOVE THIS LINE */}

            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      {/* Usunięto: </SessionContextProvider> */}
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;