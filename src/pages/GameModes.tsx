import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const GameModesPage = () => {
  const navigate = useNavigate();

  const handleSoloPlay = () => {
    navigate('/game/solo'); // Przekierowanie do trasy gry solo
  };

  const handleMultiplayerPlay = () => {
    navigate('/lobbies'); // Przekierowanie do listy lobby
  };

  const handleRankedPlay = () => {
    // TODO: Zaimplementować logikę dla trybu rankingowego
    console.log("Rozpoczęto grę rankingową (placeholder)");
    // navigate('/game/ranked');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-green-400 text-white p-4">
      <h1 className="text-4xl font-bold mb-8 text-center">Wybierz tryb gry</h1>

      <div className="flex flex-col space-y-4 w-full max-w-sm">
        <Button
          onClick={handleSoloPlay}
          className="px-8 py-4 text-xl bg-white text-green-600 hover:bg-gray-200 border-2 border-black shadow-md"
        >
          Gra solo (vs Bot)
        </Button>
        <Button
          onClick={handleMultiplayerPlay}
          className="px-8 py-4 text-xl bg-white text-green-600 hover:bg-gray-200 border-2 border-black shadow-md"
        >
          Zwykła multiplayer
        </Button>
        <Button
          onClick={handleRankedPlay}
          className="px-8 py-4 text-xl bg-white text-green-600 hover:bg-gray-200 border-2 border-black shadow-md"
        >
          Rankingowa multiplayer
        </Button>
      </div>
    </div>
  );
};

export default GameModesPage;