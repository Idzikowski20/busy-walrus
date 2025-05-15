import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Lobby {
  id: string;
  name: string;
  status: string;
  creator_id: string;
}

interface LobbyPlayer {
    id: string;
    lobby_id: string;
    user_id: string;
    joined_at: string; // Dodano joined_at
    is_ready: boolean; // Dodano is_ready
    // Profil będzie dołączony po pobraniu
    profiles: {
        first_name: string | null;
        last_name: string | null;
    } | null;
}


const LobbyPage = () => {
  const { id: lobbyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
      const fetchUser = async () => {
          const { data: { user } } = await supabase.auth.getUser();
          setCurrentUserId(user?.id || null);
      };
      fetchUser();
  }, []);


  // Fetch lobby details
  const { data: lobby, isLoading: isLoadingLobby, error: lobbyError } = useQuery<Lobby>({
    queryKey: ["lobby", lobbyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lobbies")
        .select("*")
        .eq("id", lobbyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!lobbyId, // Tylko jeśli lobbyId jest dostępne
  });

  // Fetch players in the lobby and their profiles
  const { data: playersWithProfiles, isLoading: isLoadingPlayers, error: playersError } = useQuery<LobbyPlayer[]>({
    queryKey: ["lobbyPlayers", lobbyId],
    queryFn: async () => {
      // 1. Fetch lobby players to get user_ids
      const { data: lobbyPlayers, error: lobbyPlayersError } = await supabase
        .from("lobby_players")
        .select("id, lobby_id, user_id, joined_at, is_ready") // Select necessary fields including user_id
        .eq("lobby_id", lobbyId);

      if (lobbyPlayersError) throw lobbyPlayersError;

      if (!lobbyPlayers || lobbyPlayers.length === 0) return [];

      // Extract user_ids
      const userIds = lobbyPlayers.map(p => p.user_id);

      // 2. Fetch profiles for these user_ids
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds); // profiles.id is the user_id

      if (profilesError) throw profilesError;

      // 3. Map profiles back to lobby players
      const playersWithProfiles = lobbyPlayers.map(lp => {
        const profile = profiles?.find(p => p.id === lp.user_id);
        return {
          ...lp,
          profiles: profile || null // Attach profile data
        };
      });

      return playersWithProfiles;
    },
    enabled: !!lobbyId, // Tylko jeśli lobbyId jest dostępne
    refetchInterval: 2000, // Odświeżaj listę graczy co 2 sekundy
  });

  // Mutation to leave the lobby
  const leaveLobbyMutation = useMutation({
      mutationFn: async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user || !lobbyId) throw new Error("User not logged in or lobby ID missing");

          const { error } = await supabase
            .from("lobby_players")
            .delete()
            .eq("lobby_id", lobbyId)
            .eq("user_id", user.id);

          if (error) throw error;

          // Jeśli gracz był twórcą i nie ma innych graczy, usuń lobby
          if (lobby?.creator_id === user.id && playersWithProfiles?.length === 1) {
               await supabase.from("lobbies").delete().eq("id", lobbyId);
          }
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["lobbies"] });
          queryClient.invalidateQueries({ queryKey: ["lobbyPlayers", lobbyId] });
          toast.info("Opuszczono lobby.");
          navigate("/lobbies"); // Wróć do listy lobby
      },
      onError: (err) => {
          toast.error(`Błąd podczas opuszczania lobby: ${err.message}`);
      }
  });

  // Mutation to start the game
  const startGameMutation = useMutation({
      mutationFn: async () => {
          if (!lobbyId) throw new Error("Lobby ID missing");
          // TODO: Zaimplementować logikę rozpoczęcia gry (np. zmiana statusu lobby, utworzenie sesji gry)
          console.log(`Starting game for lobby ${lobbyId}`);
          toast.info("Rozpoczynanie gry... (placeholder)");
          // Po rozpoczęciu gry, przekieruj graczy do ekranu gry, np. /game/multiplayer/:lobbyId
          // Na razie przekierujemy do gry solo jako placeholder
          navigate(`/game/solo`); // Zmień na odpowiednią trasę multiplayer
      },
      onSuccess: () => {
          // Możesz tutaj zrobić coś po pomyślnym rozpoczęciu gry, np. zaktualizować status lobby
          queryClient.invalidateQueries({ queryKey: ["lobbies"] });
      },
      onError: (err) => {
          toast.error(`Błąd podczas rozpoczynania gry: ${err.message}`);
      }
  });


  const handleLeaveLobby = () => {
      leaveLobbyMutation.mutate();
  };

  const handleStartGame = () => {
      startGameMutation.mutate();
  };

  const isCreator = currentUserId && lobby?.creator_id === currentUserId;
  const canStartGame = isCreator && (playersWithProfiles?.length || 0) >= 2;


  if (isLoadingLobby || isLoadingPlayers) return <div>Ładowanie lobby...</div>;
  if (lobbyError) return <div>Wystąpił błąd podczas ładowania lobby: {lobbyError.message}</div>;
  if (!lobby) return <div>Lobby nie znaleziono.</div>;
  if (playersError) return <div>Wystąpił błąd podczas ładowania graczy: {playersError.message}</div>;


  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Lobby: {lobby.name}</h1>

      <Card className="mb-6 max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Gracze w Lobby ({playersWithProfiles?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul>
            {playersWithProfiles?.map(player => (
              <li key={player.id} className="text-lg">
                {player.profiles?.first_name || player.user_id} {player.profiles?.last_name}
                {player.user_id === lobby.creator_id && " (Twórca)"}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex justify-center gap-4">
          {isCreator && (
              <Button
                  onClick={handleStartGame}
                  disabled={!canStartGame || startGameMutation.isPending}
              >
                  {startGameMutation.isPending ? "Rozpoczynanie..." : "Rozpocznij Grę"}
              </Button>
          )}
          <Button
              onClick={handleLeaveLobby}
              variant="destructive"
              disabled={leaveLobbyMutation.isPending}
          >
              {leaveLobbyMutation.isPending ? "Opuszczanie..." : "Opuść Lobby"}
          </Button>
      </div>

        {isCreator && (playersWithProfiles?.length || 0) < 2 && (
            <p className="text-center mt-4 text-sm text-gray-600">Potrzeba co najmniej 2 graczy, aby rozpocząć grę.</p>
        )}

    </div>
  );
};

export default LobbyPage;