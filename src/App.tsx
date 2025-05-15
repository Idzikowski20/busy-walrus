import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index"; // Solo Game Page
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/Auth";
import LandingPage from "./pages/LandingPage";
import GameModesPage from "./pages/GameModes";
import LobbyListPage from "./pages/LobbyListPage"; // Import LobbyListPage
import LobbyPage from "./pages/LobbyPage"; // Import LobbyPage
import { supabase } from "./integrations/supabase/client";
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
        <BrowserRouter>
          <Routes>
            {/* Strona główna (Landing Page) */}
            <Route path="/" element={<LandingPage />} />

            {/* Trasy publiczne - nie wymagają zalogowania */}
            <Route path="/login" element={<AuthPage />} />
            <Route path="/register" element={<AuthPage />} />
            {/* ADD ALL CUSTOM PUBLIC ROUTES ABOVE THIS LINE */}

            {/* Trasy chronione - wymagają zalogowania */}
            <Route path="/game-modes" element={<ProtectedRoute><GameModesPage /></ProtectedRoute>} />
            <Route path="/lobbies" element={<ProtectedRoute><LobbyListPage /></ProtectedRoute>} /> {/* Trasa dla listy lobby */}
            <Route path="/lobby/:id" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} /> {/* Trasa dla pojedynczego lobby */}
            <Route path="/game/solo" element={<ProtectedRoute><Index /></ProtectedRoute>} /> {/* Trasa dla gry solo */}
            {/* TODO: Dodać trasę dla gry multiplayer, np. /game/multiplayer/:lobbyId */}
            {/* ADD ALL CUSTOM PROTECTED ROUTES ABOVE THIS LINE */}

            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;