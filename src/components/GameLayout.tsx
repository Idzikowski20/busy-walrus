import React, { useRef, useEffect, useState } from 'react';

// Definicja typu dla wiadomości czatu
interface ChatMessage {
  id: number;
  sender: string;
  text: string;
}

const GameLayout = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);

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
  }, [isDrawing, lastPoint]); // Zależności hooka useEffect

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
        }
      }
    };

    resizeCanvas(); // Ustaw rozmiar przy pierwszym renderowaniu
    window.addEventListener('resize', resizeCanvas); // Ustaw listener na zmianę rozmiaru okna

    return () => window.removeEventListener('resize', resizeCanvas); // Czyszczenie listenera
  }, []); // Pusta tablica zależności oznacza, że hook uruchomi się tylko raz po zamontowaniu

  // Funkcja do wysyłania wiadomości (na razie tylko dodaje do stanu lokalnego)
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      // Na razie używamy placeholderowego nadawcy i ID
      const message: ChatMessage = {
        id: chatMessages.length + 1,
        sender: 'Ty', // Zastąp to rzeczywistym imieniem użytkownika
        text: newMessage.trim(),
      };
      setChatMessages([...chatMessages, message]);
      setNewMessage('');
    }
  };


  return (
    <div className="flex flex-col h-screen p-4 bg-gray-100">
      {/* Nagłówek/Informacje o grze */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Gartic Show Clone</h1>
        {/* Placeholder na informacje o rundzie, czasie, punkty */}
        <div className="text-lg">Runda: 1/10 | Czas: 60s | Twoje punkty: 0</div>
      </div>

      {/* Główny obszar gry: Rysunek i Panel boczny (Czat + Gracze) */}
      <div className="flex flex-1 gap-4">
        {/* Obszar rysowania */}
        <div className="flex-1 bg-white rounded-lg shadow-md p-4 flex items-center justify-center relative"> {/* Dodano relative */}
          {/* Canvas do rysowania */}
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full" // Ustawienie canvasu na absolutne i wypełnienie kontenera
          ></canvas>
           {/* Usunięto placeholder */}
        </div>

        {/* Panel boczny: Czat i Lista graczy */}
        <div className="w-80 flex flex-col gap-4">
          {/* Wyświetlanie słowa do zgadnięcia */}
          <div className="bg-white rounded-lg shadow-md p-4 text-center text-xl font-semibold">
            Słowo: _ _ _ _ _
          </div>

          {/* Czat */}
          <div className="flex-1 bg-white rounded-lg shadow-md p-4 flex flex-col">
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
              <input
                type="text"
                placeholder="Wpisz zgadywane słowo lub wiadomość"
                className="flex-1 p-2 border rounded"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Wyślij</button>
            </form>
          </div>

          {/* Lista graczy */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-lg font-semibold mb-2">Gracze</h3>
            {/* Placeholder na listę graczy */}
            <ul>
              <li className="text-gray-700">Gracz 1 (Rysuje) - 0 pkt</li>
              <li className="text-gray-700">Gracz 2 - 0 pkt</li>
              {/* ...więcej graczy */}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameLayout;