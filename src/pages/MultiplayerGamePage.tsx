import React, { useRef, useEffect, useState } from 'react';
import GameLayout from "@/components/GameLayout";
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Definicja typu dla wiadomości czatu (może być potrzebna w multiplayer)
interface ChatMessage {
  id: number;
  sender: string;
  text: string;
}

// Definicja typu dla gracza w grze multiplayer
interface Player {
  id: string; // user_id
  name: string; // pseudonim
  score: number;
  isDrawing?: boolean;
  isBot?: boolean; // W multiplayer nie będzie botów, ale zachowujemy typ
}

interface Lobby {
    id: string;
    name: string;
    status: string;
    creator_id: string;
}

interface LobbyPlayer {
    id: string; // id z tabeli lobby_players
    lobby_id: string;
    user_id: string;
    joined_at: string;
    is_ready: boolean;
    profiles: {
        first_name: string | null;
        last_name: string | null;
    } | null;
}


const MultiplayerGamePage = () => {
  const { id: lobbyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [gameChannel, setGameChannel] = useState<RealtimeChannel | null>(null); // Kanał Realtime dla gry

  // Stany gry (na razie uproszczone dla multiplayer)
  const [gameState, setGameState] = useState<'loading' | 'in-game' | 'game-ended'>('loading');
  const [currentWord, setCurrentWord] = useState(''); // Słowo do rysowania/zgadnięcia
  const [maskedWord, setMaskedWord] = useState(''); // Zamaskowane słowo
  const [timeLeft, setTimeLeft] = useState(60); // Czas na rundę
  const [round, setRound] = useState(1); // Aktualna runda
  const [maxRounds, setMaxRounds] = useState(10); // Maksymalna liczba rund
  const [players, setPlayers] = useState<Player[]>([]); // Lista graczy w grze
  const [isPlayerTurn, setIsPlayerTurn] = useState(false); // Czy to tura aktualnego gracza?

  // Stany dla czatu (na razie placeholder)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // Ref do canvasu i logiki rysowania
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);

  // Stan dla okna dialogowego końca gry/dezercji
  const [isGameEndDialogOpen, setIsGameEndDialogOpen] = useState(false);
  const [gameEndMessage, setGameEndMessage] = useState('');


  useEffect(() => {
      const fetchUser = async () => {
          const { data: { user } } = await supabase.auth.getUser();
          setCurrentUserId(user?.id || null);
      };
      fetchUser();
  }, []);

  // Fetch lobby details (potrzebne np. do nazwy lobby)
  const { data: lobby, isLoading: isLoadingLobby, error: lobbyError } = useQuery<Lobby>({
    queryKey: ["lobby", lobbyId],
    queryFn: async () => {
      if (!lobbyId) throw new Error("Lobby ID missing");
      const { data, error } = await supabase
        .from("lobbies")
        .select("*")
        .eq("id", lobbyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!lobbyId,
  });

  // Fetch players in the lobby and their profiles
  const { data: lobbyPlayersData, isLoading: isLoadingPlayers, error: playersError } = useQuery<LobbyPlayer[]>({
    queryKey: ["lobbyPlayers", lobbyId],
    queryFn: async () => {
      if (!lobbyId) throw new Error("Lobby ID missing");
      const { data: lobbyPlayersResult, error: lobbyPlayersError } = await supabase
        .from("lobby_players")
        .select("user_id, is_ready, profiles(first_name, last_name)") // Pobieramy user_id i profil
        .eq("lobby_id", lobbyId);

      if (lobbyPlayersError) throw lobbyPlayersError;

      // Map fetched data to Player format
      const playersList: Player[] = lobbyPlayersResult?.map(lp => ({
          id: lp.user_id,
          name: lp.profiles?.first_name || lp.user_id, // Użyj pseudonimu lub user_id
          score: 0, // Wynik początkowy
          isDrawing: false, // Ustawiane w logice gry
          isBot: false,
      })) || [];

      setPlayers(playersList);
      setGameState('in-game'); // Zmień stan gry po załadowaniu graczy
      return lobbyPlayersResult; // Zwróć oryginalne dane dla cache
    },
    enabled: !!lobbyId && gameState === 'loading', // Uruchom tylko raz przy ładowaniu
    // refetchInterval: 2000, // Możesz włączyć odświeżanie, jeśli potrzebujesz aktualizacji listy graczy w trakcie gry (np. do wykrywania dezercji)
  });

  // Mutation do aktualizacji statystyk gracza (wygrane/przegrane/dezercje)
  const updatePlayerStatsMutation = useMutation({
      mutationFn: async ({ userId, wins = 0, losses = 0, desertions = 0 }: { userId: string; wins?: number; losses?: number; desertions?: number }) => {
          const { data, error } = await supabase
            .from("profiles")
            .update({
                wins: (profile?.wins || 0) + wins, // Zakładamy, że profile jest dostępne w stanie komponentu lub pobrane
                losses: (profile?.losses || 0) + losses,
                desertions: (profile?.desertions || 0) + desertions,
            })
            .eq("id", userId);

          if (error) throw error;
          return data;
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["profile", currentUserId] }); // Odśwież profil gracza
          console.log("Statystyki gracza zaktualizowane.");
      },
      onError: (err) => {
          console.error("Błąd podczas aktualizacji statystyk:", err.message);
      }
  });

  // Fetch current user's profile to get current stats for updating
  const { data: profile } = useQuery({
      queryKey: ["profile", currentUserId],
      queryFn: async () => {
          if (!currentUserId) return null;
          const { data, error } = await supabase
            .from("profiles")
            .select("wins, losses, desertions")
            .eq("id", currentUserId)
            .single();
          if (error) {
              console.error("Error fetching profile for stats update:", error);
              return null;
          }
          return data;
      },
      enabled: !!currentUserId,
  });


  // --- Realtime Subscription for Player Changes (Desertion Detection) ---
  useEffect(() => {
    if (!lobbyId || gameState !== 'in-game') return; // Subskrybuj tylko gdy gra jest w toku

    // Subskrybuj zmiany w tabeli lobby_players dla tego lobby
    const channel = supabase.channel(`game:${lobbyId}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE', // Nasłuchuj na usunięcie gracza
          schema: 'public',
          table: 'lobby_players',
          filter: `lobby_id=eq.${lobbyId}` // Filtruj tylko dla tego lobby
        },
        async (payload) => {
          console.log('Player deleted from lobby_players:', payload);
          // Po usunięciu gracza, pobierz aktualną listę graczy w lobby
          const { data: remainingPlayers, error } = await supabase
            .from("lobby_players")
            .select("user_id, profiles(first_name)")
            .eq("lobby_id", lobbyId);

          if (error) {
              console.error("Error fetching remaining players:", error);
              return;
          }

          // Sprawdź, czy gra jest 2-osobowa i został tylko jeden gracz
          if (players.length === 2 && remainingPlayers && remainingPlayers.length === 1) {
              const winnerId = remainingPlayers[0].user_id;
              const deserterId = payload.old.user_id; // ID gracza, który opuścił

              // Zakończ grę
              setGameState('game-ended');
              setIsGameEndDialogOpen(true);

              if (currentUserId === winnerId) {
                  // Aktualny gracz wygrał przez dezercję
                  const deserterProfile = players.find(p => p.id === deserterId)?.name || deserterId;
                  setGameEndMessage(`Wygrałeś! ${deserterProfile} opuścił grę, bo się bał.`);
                  updatePlayerStatsMutation.mutate({ userId: winnerId, wins: 1 });
              } else if (currentUserId === deserterId) {
                  // Aktualny gracz zdezerterował
                  const winnerProfile = remainingPlayers[0].profiles?.first_name || winnerId;
                  setGameEndMessage(`Opuściłeś grę. ${winnerProfile} wygrał przez Twoją dezercję.`);
                  updatePlayerStatsMutation.mutate({ userId: deserterId, desertions: 1 });
              } else {
                  // Inny scenariusz (np. obserwator, jeśli by istnieli)
                   setGameEndMessage(`Gra zakończona z powodu dezercji.`);
              }

              // Opcjonalnie: Zmień status lobby z powrotem na 'waiting' lub 'finished'
              await supabase.from("lobbies").update({ status: 'finished' }).eq("id", lobbyId);

          } else if (remainingPlayers && remainingPlayers.length === 0) {
              // Wszyscy opuścili lobby
              setGameState('game-ended');
              setIsGameEndDialogOpen(true);
              setGameEndMessage("Wszyscy gracze opuścili grę.");
               // Opcjonalnie: Usuń lobby lub zmień status
              await supabase.from("lobbies").update({ status: 'finished' }).eq("id", lobbyId);
          }
           // TODO: Obsłużyć dezercję w grach > 2 graczy (np. gracz zostaje wyeliminowany)
        }
      )
      .subscribe();

    setGameChannel(channel);

    return () => {
      if (gameChannel) {
        supabase.removeChannel(gameChannel);
        setGameChannel(null);
      }
    };
  }, [lobbyId, gameState, players, currentUserId, navigate, updatePlayerStatsMutation, queryClient, profile]); // Dodano zależności

  // Efekt do maskowania słowa (pierwsza i ostatnia litera widoczna) - skopiowane z gry solo
  useEffect(() => {
    if (currentWord) {
      if (currentWord.length <= 2) {
        setMaskedWord(currentWord);
      } else {
        const firstLetter = currentWord[0];
        const lastLetter = currentWord[currentWord.length - 1];
        const maskedPart = '_'.repeat(currentWord.length - 2);
        setMaskedWord(firstLetter + maskedPart + lastLetter);
      }
    } else {
      setMaskedWord('');
    }
  }, [currentWord]);

  // Placeholder dla logiki wysyłania wiadomości w multiplayer
  const handleSendMessage = (messageText: string) => {
      console.log("Wiadomość wysłana w multiplayer:", messageText);
      // TODO: Zaimplementować wysyłanie wiadomości przez Supabase Realtime
      // TODO: Zaimplementować logikę zgadywania słowa w multiplayer
  };

  // Funkcja do opuszczenia gry (dezercja)
  const handleLeaveGame = async () => {
      if (!currentUserId || !lobbyId) return;

      // Usuń gracza z lobby_players
      const { error } = await supabase
        .from("lobby_players")
        .delete()
        .eq("lobby_id", lobbyId)
        .eq("user_id", currentUserId);

      if (error) {
          console.error("Błąd podczas opuszczania gry (dezercja):", error.message);
          toast.error("Błąd podczas opuszczania gry.");
      } else {
          // Realtime subscription wykryje usunięcie i obsłuży koniec gry/aktualizację statystyk
          toast.warning("Opuściłeś grę.");
          navigate('/game-modes'); // Przekieruj do menu wyboru trybu gry
      }
  };

  // Funkcja do zamknięcia okna końca gry i powrotu do menu
  const handleEndGameDialogClose = () => {
      setIsGameEndDialogOpen(false);
      navigate('/game-modes');
  };


  if (isLoadingLobby || isLoadingPlayers || gameState === 'loading') return <div>Ładowanie gry multiplayer...</div>;
  if (lobbyError) return <div>Wystąpił błąd podczas ładowania lobby: {lobbyError.message}</div>;
  if (playersError) return <div>Wystąpił błąd podczas ładowania graczy: {playersError.message}</div>;
  if (!lobby) return <div>Lobby nie znaleziono.</div>;


  return (
    <>
      {/* Przycisk do opuszczenia gry */}
      <div className="absolute top-4 right-4 z-10">
          <Button variant="outline" onClick={handleLeaveGame} disabled={gameState === 'game-ended'}>Opuść Grę</Button>
      </div>

      {/* Przekazujemy potrzebne stany i funkcje do GameLayout */}
      {/* TODO: Zaimplementować pełną logikę gry multiplayer (tury, rysowanie, zgadywanie, punkty) */}
      <GameLayout
        canvasRef={canvasRef}
        isDrawing={isDrawing} // Placeholder
        setIsDrawing={setIsDrawing} // Placeholder
        lastPoint={lastPoint} // Placeholder
        setLastPoint={setLastPoint} // Placeholder
        currentWord={currentWord} // Placeholder
        maskedWord={maskedWord} // Placeholder
        timeLeft={timeLeft} // Placeholder
        round={round} // Placeholder
        maxRounds={maxRounds} // Placeholder
        players={players} // Lista graczy
        chatMessages={chatMessages} // Placeholder
        newMessage={newMessage} // Placeholder
        setNewMessage={setNewMessage} // Placeholder
        handleSendMessage={handleSendMessage} // Placeholder
        chatMessagesEndRef={chatMessagesEndRef} // Placeholder
        isPlayerTurn={isPlayerTurn} // Placeholder
        gameState={gameState === 'in-game' ? 'player-drawing' : 'idle'} // Uproszczony stan dla layoutu
      />

      {/* Okno dialogowe końca gry/dezercji */}
      <Dialog open={isGameEndDialogOpen} onOpenChange={setIsGameEndDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gra Zakończona</DialogTitle>
          </DialogHeader>
          <div className="p-4 text-center">
            <p className="text-lg">{gameEndMessage}</p>
             {/* TODO: Wyświetlić końcowy wynik */}
          </div>
          <DialogFooter>
            <Button onClick={handleEndGameDialogClose}>Powrót do Menu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MultiplayerGamePage;