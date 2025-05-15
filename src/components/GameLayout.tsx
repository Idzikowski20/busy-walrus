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

const GameLayout = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);

  // Stan gry
  const [currentWord, setCurrentWord] = useState('słoń'); // Przykładowe słowo
  const [maskedWord, setMaskedWord] = useState('');
  const [timeLeft, setTimeLeft] = useState(60); // Czas w sekundach
  const [round, setRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(10);
  const [players, setPlayers] = useState<Player[]>([ // Przykładowi gracze
    { id: 'player1', name: 'Gracz 1', score: 0, isDrawing: true },
    { id: 'player2', name: 'Gracz 2', score: 0 },
    { id: 'player3', name: 'Gracz 3', score: 0 },
  ]);
  const [currentPlayerId, setCurrentPlayerId] = useState('player1'); // ID gracza, który rysuje

  // Stan dla wiadomości czatu
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: 1, sender: 'System', text: 'Witaj w grze!' },
    { id: 2, sender: 'Gracz 1', text: 'Cześć!' },
  ]);
  // Stan dla aktualnie wpisywanej wiadomości
  const [newMessage, setNewMessage] = useState('');

  // Ref do przewijania czatu na dół
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // Efekt do przewijania czatu na dół po dodaniu nowej wiadomości
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Efekt do maskowania słowa
  useEffect(() => {
    // Proste maskowanie: pokazuje pierwszą literę i resztę zastępuje podkreślnikami
    if (currentWord) {
      setMaskedWord(currentWord[0] + '_'.repeat(currentWord.length - 1));
    } else {
      setMaskedWord('');
    }
  }, [currentWord]);

  // Efekt do odliczania czasu
  useEffect(() => {
    if (timeLeft <= 0) {
      // Czas minął, koniec rundy
      console.log('Czas minął! Koniec rundy.');
      // Tutaj dodamy logikę końca rundy (punktacja, zmiana rysującego, nowa runda)
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);

    return () => clearInterval(timer); // Czyszczenie timera
  }, [timeLeft]); // Zależność od timeLeft, aby timer zatrzymał się przy 0

  // Placeholder: Funkcja do wyboru nowego słowa (na razie losuje z prostej listy)
  const selectNewWord = () => {
    const words = ['dom', 'drzewo', 'samochód', 'kwiat', 'książka'];
    const randomIndex = Math.floor(Math.random() * words.length);
    setCurrentWord(words[randomIndex]);
    setTimeLeft(60); // Reset czasu
    // Tutaj dodamy logikę zmiany rysującego gracza
  };

  // Placeholder: Funkcja do obsługi zgadywania słowa
  const handleGuess = (guess: string) => {
    if (guess.toLowerCase() === currentWord.toLowerCase()) {
      console.log('Słowo odgadnięte!');
      // Tutaj dodamy logikę punktacji za odgadnięcie
      // i logikę przejścia do następnej rundy
      selectNewWord(); // Na razie od razu wybieramy nowe słowo
      return true; // Zgadywanie udane
    }
    return false; // Zgadywanie nieudane
  };


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
      // if (currentPlayerId !== 'ID_AKTUALNEGO_ZALOGOWANEGO_GRACZA') return; // TODO: Zaimplementować sprawdzenie ID

      setIsDrawing(true);
      setLastPoint(getCanvasCoordinates(event));
      event.preventDefault(); // Zapobiega przewijaniu na urządzeniach dotykowych
    };

    const draw = (event: MouseEvent | TouchEvent) => {
      if (!isDrawing || !lastPoint) return;

      const currentPoint = getCanvasCoordinates(event);
      context.beginPath();
      context.moveTo(lastPoint.x, lastPoint.y);
      context.lineTo(currentPoint.x, currentPoint.y);
      context.stroke();
      setLastPoint(currentPoint);
      event.preventDefault();
    };

    const stopDrawing = () => {
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
  }, [isDrawing, lastPoint, currentPlayerId]); // Zależności hooka useEffect

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
        }
      }
    };

    resizeCanvas(); // Ustaw rozmiar przy pierwszym renderowaniu
    window.addEventListener('resize', resizeCanvas); // Ustaw listener na zmianę rozmiaru okna

    return () => window.removeEventListener('resize', resizeCanvas); // Czyszczenie listenera
  }, []); // Pusta tablica zależności oznacza, że hook uruchomi się tylko raz po zamontowaniu

  // Funkcja do wysyłania wiadomości (na razie tylko dodaje do stanu lokalnego i sprawdza zgadywanie)
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      const guessSuccessful = handleGuess(newMessage.trim());

      // Na razie używamy placeholderowego nadawcy i ID
      const message: ChatMessage = {
        id: chatMessages.length + 1,
        sender: 'Ty', // Zastąp to rzeczywistym imieniem użytkownika
        text: newMessage.trim(),
      };
      setChatMessages([...chatMessages, message]);
      setNewMessage('');

      if (guessSuccessful) {
        // Można dodać wiadomość systemową o poprawnym zgadnięciu
        const successMessage: ChatMessage = {
          id: chatMessages.length + 2,
          sender: 'System',
          text: `Gracz Ty odgadł słowo!`, // Zastąp 'Ty' rzeczywistym imieniem
        };
        setChatMessages((prevMessages) => [...prevMessages, successMessage]);
      }
    }
  };


  return (
    <div className="flex flex-col h-screen p-4 bg-gray-100">
      {/* Nagłówek/Informacje o grze */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Gartic Show Clone</h1>
        {/* Informacje o rundzie, czasie, punkty */}
        <div className="text-lg">Runda: {round}/{maxRounds} | Czas: {timeLeft}s | Twoje punkty: {players.find(p => p.id === 'player2')?.score || 0}</div> {/* TODO: Zastąpić 'player2' ID aktualnego gracza */}
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
            Słowo: {maskedWord} {/* Wyświetlanie zamaskowanego słowa */}
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
            <form onSubmit={handleSendMessage} className="flex gap-2">
              {/* Dodano klasy border-2, border-black, rounded */}
              <input
                type="text"
                placeholder="Wpisz zgadywane słowo lub wiadomość"
                className="flex-1 p-2 border-2 border-black rounded"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              {/* Dodano klasy border-2, border-black, shadow-md */}
              <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 border-2 border-black shadow-md">Wyślij</button>
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