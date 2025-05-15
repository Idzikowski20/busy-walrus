import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react"; // Import useEffect
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Lobby {
  id: string;
  name: string;
  status: string;
  created_at: string;
  creator_id: string;
}

interface LobbyPlayer {
    id: string;
    lobby_id: string;
    user_id: string;
}


const LobbyListPage = () => {
  const [newLobbyName, setNewLobbyName] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); // Pobieramy ID aktualnego użytkownika

  useEffect(() => {
      const fetchUser = async () => {
          const { data: { user } } = await supabase.auth.getUser();
          setCurrentUserId(user?.id || null);
      };
      fetchUser();
  }, []);


  // Fetch lobbies
  const { data: lobbies, isLoading: isLoadingLobbies, error: lobbiesError } = useQuery<Lobby[]>({
    queryKey: ["lobbies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lobbies")
        .select("*")
        .eq("status", "waiting") // Tylko lobby oczekujące
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000, // Odświeżaj listę co 5 sekund
  });

  // Fetch all players in waiting lobbies
  const { data: lobbyPlayers, isLoading: isLoadingPlayers, error: playersError } = useQuery<LobbyPlayer[]>({
      queryKey: ["allLobbyPlayers"],
      queryFn: async () => {
          // Pobierz ID wszystkich lobby w statusie 'waiting'
          const waitingLobbyIds = lobbies?.map(l => l.id) || [];
          if (waitingLobbyIds.length === 0) return [];

          // Pobierz wszystkich graczy z tych lobby
          const { data, error } = await supabase
            .from("lobby_players")
            .select("lobby_id, user_id"); // Potrzebujemy tylko lobby_id i user_id
          if (error) throw error;
          return data;
      },
      enabled: !!lobbies && lobbies.length > 0, // Uruchom zapytanie tylko gdy są jakieś lobby
      refetchInterval: 5000, // Odświeżaj listę graczy co 5 sekund
  });


  // Create lobby mutation
  const createLobbyMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not logged in");

      // 1. Create the lobby
      const { data: newlyCreatedLobby, error: createLobbyError } = await supabase
        .from("lobbies")
        .insert({ name, creator_id: user.id })
        .select()
        .single();
      if (createLobbyError) throw createLobbyError;

      // 2. Add the creator to the lobby_players table
      const { error: addCreatorError } = await supabase
        .from("lobby_players")
        .insert({ lobby_id: newlyCreatedLobby.id, user_id: user.id });

      if (addCreatorError) {
          console.error("Error adding creator to lobby_players:", addCreatorError);
          // Możesz zdecydować, czy chcesz usunąć lobby, jeśli dodanie gracza się nie powiedzie
          // Na razie po prostu zgłosimy błąd
          throw addCreatorError;
      }

      return newlyCreatedLobby; // Return the created lobby data
    },
    onSuccess: (newlyCreatedLobby) => { // newlyCreatedLobby is now available here
      queryClient.invalidateQueries({ queryKey: ["lobbies"] });
      queryClient.invalidateQueries({ queryKey: ["allLobbyPlayers"] });
      // Invalidate the specific lobbyPlayers query for the new lobby to update the list in LobbyPage
      queryClient.invalidateQueries({ queryKey: ["lobbyPlayers", newlyCreatedLobby.id] });
      toast.success(`Lobby "${newLobbyName}" stworzone!`);
      setNewLobbyName("");
      navigate(`/lobby/${newlyCreatedLobby.id}`);
    },
    onError: (err) => {
      toast.error(`Błąd podczas tworzenia lobby: ${err.message}`);
    },
  });

  // Join lobby mutation
  const joinLobbyMutation = useMutation({
    mutationFn: async (lobbyId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not logged in");

      // Sprawdź, czy gracz nie jest już w innym lobby (opcjonalnie, ale dobra praktyka)
      const { data: existingPlayer, error: existingPlayerError } = await supabase
        .from("lobby_players")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (existingPlayerError && existingPlayerError.code !== 'PGRST116') { // PGRST116 means no rows found
           throw existingPlayerError;
      }
      if (existingPlayer) {
          // Opuść poprzednie lobby, jeśli istnieje
          await supabase.from("lobby_players").delete().eq("user_id", user.id);
      }


      const { data, error } = await supabase
        .from("lobby_players")
        .insert({ lobby_id: lobbyId, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, lobbyId) => {
      queryClient.invalidateQueries({ queryKey: ["lobbies"] });
      queryClient.invalidateQueries({ queryKey: ["allLobbyPlayers"] }); // Odśwież listę graczy
      // Invalidate the specific lobbyPlayers query for the joined lobby
      queryClient.invalidateQueries({ queryKey: ["lobbyPlayers", lobbyId] });
      toast.success("Dołączono do lobby!");
      navigate(`/lobby/${lobbyId}`);
    },
    onError: (err) => {
      toast.error(`Błąd podczas dołączania do lobby: ${err.message}`);
    },
  });


  const handleCreateLobby = () => {
    if (newLobbyName.trim()) {
      createLobbyMutation.mutate(newLobbyName.trim());
    } else {
      toast.warning("Nazwa lobby nie może być pusta.");
    }
  };

  const handleJoinLobby = (lobbyId: string) => {
    joinLobbyMutation.mutate(lobbyId);
  };

  // Poprawione filtrowanie lobby
  const filteredLobbies = lobbies?.filter(lobby => {
      // Sprawdź, czy aktualny użytkownik jest w tym konkretnym lobby
      const isCurrentUserInThisLobby = lobbyPlayers?.some(player =>
          player.lobby_id === lobby.id && player.user_id === currentUserId
      );

      // Jeśli aktualny użytkownik jest twórcą, pokaż lobby tylko jeśli w nim jest.
      if (lobby.creator_id === currentUserId) {
          return isCurrentUserInThisLobby;
      } else {
          // Jeśli aktualny użytkownik NIE jest twórcą, pokaż lobby tylko jeśli go w nim NIE ma.
          return !isCurrentUserInThisLobby;
      }
  });


  // Funkcja do zliczania graczy w danym lobby
  const countPlayersInLobby = (lobbyId: string) => {
      return lobbyPlayers?.filter(player => player.lobby_id === lobbyId).length || 0;
  };


  if (isLoadingLobbies || isLoadingPlayers) return <div>Ładowanie lobby...</div>;
  if (lobbiesError) return <div>Wystąpił błąd podczas ładowania lobby: {lobbiesError.message}</div>;
  if (playersError) return <div>Wystąpił błąd podczas ładowania graczy w lobby: {playersError.message}</div>;


  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Dostępne Lobby</h1>

      {/* Sekcja tworzenia nowego lobby */}
      <Card className="mb-6 max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Stwórz nowe Lobby</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="Nazwa lobby"
            value={newLobbyName}
            onChange={(e) => setNewLobbyName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleCreateLobby();
              }
            }}
            disabled={createLobbyMutation.isPending}
          />
          <Button onClick={handleCreateLobby} disabled={createLobbyMutation.isPending}>
            {createLobbyMutation.isPending ? "Tworzenie..." : "Stwórz"}
          </Button>
        </CardContent>
      </Card>

      {/* Lista dostępnych lobby */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLobbies?.length === 0 ? (
          <p className="text-center col-span-full">Brak dostępnych lobby. Stwórz nowe!</p>
        ) : (
          filteredLobbies?.map((lobby) => (
            <Card key={lobby.id}>
              <CardHeader>
                <CardTitle>{lobby.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-between items-center">
                <p className="text-sm text-gray-500">Graczy: {countPlayersInLobby(lobby.id)}</p> {/* Wyświetlanie liczby graczy */}
                <Button onClick={() => handleJoinLobby(lobby.id)} disabled={joinLobbyMutation.isPending}>
                  Dołącz
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default LobbyListPage;