import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const LandingPage = () => {
  const navigate = useNavigate();

  const handlePlayClick = () => {
    navigate('/login');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-blue-400 text-white p-4">
      {/* Prosty nagłówek i opis - można rozbudować o więcej elementów graficznych */}
      <h1 className="text-5xl font-bold mb-6 text-center">Gartic Show Clone</h1>
      <p className="text-xl mb-8 text-center max-w-prose">
        Rzuć wyzwanie znajomym lub zagraj solo przeciwko botowi! Rysuj i zgaduj słowa w tej ekscytującej grze online.
      </p>
      {/* Przycisk 'Graj' */}
      <Button
        onClick={handlePlayClick}
        className="px-8 py-4 text-xl bg-white text-blue-600 hover:bg-gray-200 border-2 border-black shadow-md"
      >
        Graj
      </Button>
    </div>
  );
};

export default LandingPage;