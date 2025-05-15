import React, { useRef, useEffect, useState } from 'react';

// Definicja typu dla wiadomości czatu
interface ChatMessage {
  id: number;
  sender: string;
  text: string;
}

// Definicja typu dla gracza
interface Player {
  id: string;
  name: string;
  score: number;
  isDrawing?: boolean;
}

// Dodajemy nowe propsy do GameLayout
interface GameLayoutProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isDrawing: boolean;
  setIsDrawing: (isDrawing: boolean) => void;
  lastPoint: { x: number; y: number } | null;
  setLastPoint: (point: { x: number; y: number } | null) => void;
  currentWord: string; // Przekazujemy rzeczywiste słowo
  maskedWord: string; // Przekazujemy zamaskowane słowo (dla zgadującego)
  timeLeft: number;
  round: number;
  maxRounds: number;
  players: Player[];
  chatMessages: ChatMessage[];
  newMessage: string;
  setNewMessage: (message: string) => void;
  handleSendMessage: (message: string) => void;
  chatMessagesEndRef: React.RefObject<HTMLDivElement>;
  isPlayerTurn: boolean; // Informacja, czy to tura gracza
  gameState: 'idle' | 'word-selection' | 'player-drawing' | 'bot-drawing' | 'end-of-round'; // Stan gry
}


const GameLayout: React.FC<GameLayoutProps> = ({
  canvasRef,
  isDrawing,
  setIsDrawing,
  lastPoint,
  setLastPoint,
  currentWord,
  maskedWord, // Teraz przyjmujemy zamaskowane słowo jako prop
  timeLeft,
  round,
  maxRounds,
  players,
  chatMessages,
  newMessage,
  setNewMessage,
  handleSendMessage,
  chatMessagesEndRef,
  isPlayerTurn, // Odbieramy prop isPlayerTurn
  gameState, // Odbieramy prop gameState
}) => {

  // Stan do wyświetlania słowa (pełne lub zamaskowane)
  const [displayWord, setDisplayWord] = useState('');

  // Efekt do określenia, które słowo wyświetlić
  useEffect(() => {
    if (isPlayerTurn) {
      // Jeśli to tura gracza, wyświetl pełne słowo (gracz rysuje)
      setDisplayWord(currentWord);
    } else {
      // Jeśli to tura bota, wyświetl zamaskowane słowo (gracz zgaduje)
      setDisplayWord(maskedWord);
    }
  }, [currentWord, maskedWord, isPlayerTurn]); // Zależności hooka

  // Efekt do obsługi rysowania na canvasie
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Ustawienia początkowe rysowania
    context.lineWidth = 5;
    context.lineCap = 'round';
    context.strokeStyle = '#000000'; // Czarny kolor

    const getCanvasCoordinates = (event: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      let clientX, clientY;
      if (event instanceof MouseEvent) {
        clientX = event.clientX;
        clientY = event.clientY;
      } else { // TouchEvent
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      }
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    };

    const startDrawing = (event: MouseEvent | TouchEvent) => {
      // Rysować może tylko gracz, który aktualnie rysuje
      if (!isPlayerTurn) return; // Tylko gracz może rysować w swojej turze

      setIsDrawing(true);
      setLastPoint(getCanvasCoordinates(event));
      event.preventDefault(); // Zapobiega przewijaniu na urządzeniach dotykowych
    };

    const draw = (event: MouseEvent | TouchEvent) => {
      if (!isDrawing || !lastPoint || !isPlayerTurn) return; // Rysowanie tylko w turze gracza

      const currentPoint = getCanvasCoordinates(event);
      context.beginPath();
      context.moveTo(lastPoint.x, lastPoint.y);
      context.lineTo(currentPoint.x, currentPoint.y);
      context.stroke();
      setLastPoint(currentPoint);
      event.preventDefault();
    };

    const stopDrawing = () => {
      if (!isPlayerTurn) return; // Zatrzymanie rysowania tylko w turze gracza
      setIsDrawing(false);
      setLastPoint(null);
    };

    // Obsługa myszy
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    // Obsługa dotyku (dla urządzeń mobilnych)
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);


    // Czyszczenie event listenerów przy odmontowaniu komponentu
    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseleave', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
      canvas.removeEventListener('touchcancel', stopDrawing);
    };
  }, [isDrawing, lastPoint, isPlayerTurn]); // Zależności hooka useEffect

  // Ustawienie rozmiaru canvasu tak, aby wypełniał dostępną przestrzeń
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        // Przy zmianie rozmiaru canvasu, kontekst rysowania jest resetowany,
        // więc trzeba ponownie ustawić styl rysowania
        const context = canvas.getContext('2d');
        if (context) {
          context.lineWidth = 5;
          context.lineCap = 'round';
          context.strokeStyle = '#000000';
          // TODO: Po zmianie rozmiaru canvasu, poprzedni rysunek znika.
          // W trybie multiplayer trzeba będzie ponownie narysować całą historię ruchów.
          // W trybie solo, przy zmianie tury canvas jest czyszczony, więc to mniej problematyczne.
        }
      }
    };

    resizeCanvas(); // Ustaw rozmiar przy pierwszym renderowaniu
    window.addEventListener('resize', resizeCanvas); // Ustaw listener na zmianę rozmiaru okna

    return () => window.removeEventListener('resize', resizeCanvas); // Czyszczenie listenera
  }, []); // Pusta tablica zależności oznacza, że hook uruchomi się tylko raz po zamontowaniu

  // Efekt do czyszczenia canvasu i wyświetlania komunikatu w turze bota
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Czyść canvas na początku każdej tury rysowania
    if (gameState === 'player-drawing' || gameState === 'bot-drawing') {
        context.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Wyświetl komunikat w turze bota
    if (gameState === 'bot-drawing') {
      context.font = '24px Arial';
      context.textAlign = 'center';
      context.fillStyle = '#000';
      // Wyświetlamy słowo dla symulacji, żeby było widać co bot "rysuje"
      context.fillText(`Bot rysuje... (${currentWord})`, canvas.width / 2, canvas.height / 2);
    }

  }, [gameState, currentWord]); // Zależność od stanu gry i aktualnego słowa


  return (
    <div className="flex flex-col h-screen p-4 bg-gray-100">
      {/* Nagłówek/Informacje o grze */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Gartic Show Clone</h1>
        {/* Informacje o rundzie, czasie, punkty */}
        <div className="text-lg">Runda: {round}/{maxRounds} | Czas: {timeLeft}s | Twoje punkty: {players.find(p => p.id === 'player')?.score || 0}</div> {/* Używamy 'player' jako ID gracza */}
      </div>

      {/* Główny obszar gry: Rysunek i Panel boczny (Czat + Gracze) */}
      <div className="flex flex-1 gap-4">
        {/* Obszar rysowania */}
        {/* Dodano klasy border-2, border-black, shadow-lg, rounded-lg */}
        <div className="flex-1 bg-white border-2 border-black shadow-lg rounded-lg p-4 flex items-center justify-center relative">
          {/* Canvas do rysowania */}
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full" // Ustawienie canvasu na absolutne i wypełnienie kontenera
          ></canvas>
        </div>

        {/* Panel boczny: Czat i Lista graczy */}
        <div className="w-80 flex flex-col gap-4">
          {/* Wyświetlanie słowa do zgadnięcia */}
          {/* Dodano klasy border-2, border-black, shadow-lg, rounded-lg */}
          <div className="bg-white border-2 border-black shadow-lg rounded-lg p-4 text-center text-xl font-semibold">
            Słowo: {displayWord} {/* Wyświetlanie słowa (pełne lub zamaskowane) */}
          </div>

          {/* Czat */}
          {/* Dodano klasy border-2, border-black, shadow-lg, rounded-lg */}
          <div className="flex-1 bg-white border-2 border-black shadow-lg rounded-lg p-4 flex flex-col">
            <h3 className="text-lg font-semibold mb-2">Czat</h3>
            {/* Wiadomości czatu */}
            <div className="flex-1 overflow-y-auto border-b pb-2 mb-2">
              {chatMessages.map((msg) => (
                <p key={msg.id} className="text-gray-600">
                  <span className="font-semibold">{msg.sender}:</span> {msg.text}
                </p>
              ))}
              {/* Element do przewijania na dół */}
              <div ref={chatMessagesEndRef} />
            </div>
            {/* Formularz do wprowadzania czatu */}
            {/* Formularz czatu aktywny tylko gdy gracz zgaduje (czyli gdy rysuje bot) */}
            {/* TODO: Zaimplementować wysyłanie wiadomości niezależnie od zgadywania */}
            {/* Na razie formularz służy głównie do zgadywania */}
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(newMessage); setNewMessage(''); }} className="flex gap-2">
              {/* Dodano klasy border-2, border-black, rounded */}
              <input
                type="text"
                placeholder={isPlayerTurn ? "Rysujesz..." : "Wpisz zgadywane słowo lub wiadomość"}
                className="flex-1 p-2 border-2 border-black rounded"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={isPlayerTurn} // Wyłącz pole wprowadzania, gdy gracz rysuje
              />
              {/* Dodano klasy border-2, border-black, shadow-md */}
              <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 border-2 border-black shadow-md" disabled={isPlayerTurn}>Wyślij</button>
            </form>
          </div>

          {/* Lista graczy */}
          {/* Dodano klasy border-2, border-black, shadow-lg, rounded-lg */}
          <div className="bg-white border-2 border-black shadow-lg rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2">Gracze</h3>
            {/* Placeholder na listę graczy */}
            <ul>
              {players.map(player => (
                <li key={player.id} className="text-gray-700">
                  {player.name} {player.isDrawing && '(Rysuje)'} - {player.score} pkt
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameLayout;