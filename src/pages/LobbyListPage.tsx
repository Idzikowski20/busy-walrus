import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Lobby {
  id: string;
  name: string;
  status: string;
  created_at: string;
  creator_id: string;
}

const LobbyListPage = () => {
  const [newLobbyName, setNewLobbyName] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch lobbies
  const { data: lobbies, isLoading, error } = useQuery<Lobby[]>({
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

  // Create lobby mutation
  const createLobbyMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not logged in");

      const { data, error } = await supabase
        .from("lobbies")
        .insert({ name, creator_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (newlyCreatedLobby) => {
      queryClient.invalidateQueries({ queryKey: ["lobbies"] });
      toast.success(`Lobby "${newLobbyName}" stworzone!`);
      setNewLobbyName("");
      // Przekieruj do nowo stworzonego lobby
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

  if (isLoading) return <div>Ładowanie lobby...</div>;
  if (error) return <div>Wystąpił błąd podczas ładowania lobby: {error.message}</div>;

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
        {lobbies?.length === 0 ? (
          <p className="text-center col-span-full">Brak dostępnych lobby. Stwórz nowe!</p>
        ) : (
          lobbies?.map((lobby) => (
            <Card key={lobby.id}>
              <CardHeader>
                <CardTitle>{lobby.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-between items-center">
                <p className="text-sm text-gray-500">Status: {lobby.status}</p>
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