import React, { useRef, useEffect, useState } from 'react';
import GameLayout from "@/components/GameLayout"; // Komponent layoutu wizualnego
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner"; // Użyjemy sonner do powiadomień

// Definicja typu dla wiadomości czatu
interface ChatMessage {
  id: number;
  sender: string;
  text: string;
}

// Definicja typu dla gracza (teraz uwzględniamy bota)
interface Player {
  id: string;
  name: string;
  score: number;
  isDrawing?: boolean;
  isBot?: boolean; // Dodajemy flagę dla bota
}

// Lista przykładowych słów (rzeczy lub zwierzęta)
const WORDS = ['słoń', 'dom', 'drzewo', 'samochód', 'kwiat', 'książka', 'pies', 'kot', 'mysz', 'krzesło', 'stół', 'lampa'];

const SoloGamePage = () => {
  // Stan gry
  const [gameState, setGameState] = useState<'idle' | 'word-selection' | 'player-drawing' | 'bot-drawing' | 'end-of-round'>('idle');
  const [currentWord, setCurrentWord] = useState('');
  const [maskedWord, setMaskedWord] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [round, setRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(10);
  const [players, setPlayers] = useState<Player[]>([
    { id: 'player', name: 'Ty', score: 0, isDrawing: true, isBot: false },
    { id: 'bot', name: 'Bot', score: 0, isDrawing: false, isBot: true },
  ]);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true); // Czy aktualnie rysuje gracz?
  const [wordsToChoose, setWordsToChoose] = useState<string[]>([]); // Słowa do wyboru dla gracza

  // Stan dla wiadomości czatu (przekazywany do GameLayout)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: 1, sender: 'System', text: 'Witaj w grze solo przeciwko Botowi!' },
  ]);
  // Stan dla aktualnie wpisywanej wiadomości (obsługiwany w GameLayout, ale logika zgadywania tutaj)
  const [newMessage, setNewMessage] = useState(''); // Przeniesione do GameLayout

  // Ref do canvasu i logiki rysowania (przekazywany do GameLayout)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false); // Przeniesione do GameLayout
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null); // Przeniesione do GameLayout

  // Ref do przewijania czatu na dół (przekazywany do GameLayout)
  const chatMessagesEndRef = useRef<HTMLDivElement>(null); // Przeniesione do GameLayout

  // Stan dla okna dialogowego końca rundy
  const [isEndOfRoundDialogOpen, setIsEndOfRoundDialogOpen] = useState(false);
  const [endOfRoundMessage, setEndOfRoundMessage] = useState('');

  // --- Logika gry ---

  // Efekt do rozpoczęcia nowej rundy
  useEffect(() => {
    if (round > maxRounds) {
      // Koniec gry
      console.log('Koniec gry!');
      // TODO: Zaimplementować ekran końcowy gry
      return;
    }

    // Ustawienie, kto rysuje w tej rundzie
    const playerIndex = (round - 1) % players.length;
    const newPlayersState = players.map((p, index) => ({
      ...p,
      isDrawing: index === playerIndex,
    }));
    setPlayers(newPlayersState);
    setIsPlayerTurn(newPlayersState[playerIndex].id === 'player');

    setCurrentWord(''); // Reset słowa
    setMaskedWord(''); // Reset maskowania
    setTimeLeft(60); // Reset czasu
    setChatMessages([{ id: 1, sender: 'System', text: `Rozpoczęto rundę ${round}.` }]); // Wyczyść czat i dodaj wiadomość systemową

    if (newPlayersState[playerIndex].id === 'player') {
      // Tura gracza - wybór słowa
      setGameState('word-selection');
      selectWordsToChoose();
    } else {
      // Tura bota - bot "wybiera" słowo i zaczyna "rysować"
      setGameState('bot-drawing');
      selectBotWord();
    }

  }, [round]); // Zależność od rundy

  // Efekt do odliczania czasu
  useEffect(() => {
    if (gameState !== 'player-drawing' && gameState !== 'bot-drawing') {
      return; // Timer działa tylko podczas rysowania
    }

    if (timeLeft <= 0) {
      // Czas minął, koniec rundy rysowania
      console.log('Czas minął! Koniec rundy rysowania.');
      endRound(false); // Nikt nie zgadł
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);

    return () => clearInterval(timer); // Czyszczenie timera
  }, [timeLeft, gameState]); // Zależność od timeLeft i gameState

  // Efekt do maskowania słowa
  useEffect(() => {
    if (currentWord && gameState !== 'player-drawing') { // Maskuj słowo tylko gdy rysuje gracz
       setMaskedWord(currentWord[0] + '_'.repeat(currentWord.length - 1));
    } else if (currentWord && gameState === 'bot-drawing') {
       setMaskedWord(currentWord); // Bot "zna" słowo, więc nie maskujemy dla niego
    }
    else {
      setMaskedWord('');
    }
  }, [currentWord, gameState]);

  // Logika wyboru 3 słów dla gracza
  const selectWordsToChoose = () => {
    const shuffledWords = WORDS.sort(() => 0.5 - Math.random());
    setWordsToChoose(shuffledWords.slice(0, 3));
  };

  // Logika wyboru słowa przez bota (symulacja)
  const selectBotWord = () => {
     const shuffledWords = WORDS.sort(() => 0.5 - Math.random());
     const word = shuffledWords[0]; // Bot wybiera pierwsze słowo po przetasowaniu
     setCurrentWord(word);
     // Symulacja rysowania bota - na razie po prostu czekamy i kończymy rundę
     // TODO: Zaimplementować symulację rysowania bota na canvasie
     setTimeout(() => {
        // Bot "rysował" przez chwilę, teraz "zgaduje"
        simulateBotGuess();
     }, 5000); // Bot "rysuje" przez 5 sekund
  };

  // Symulacja zgadywania bota
  const simulateBotGuess = () => {
      // Prosta symulacja: bot zgaduje poprawnie z 50% szansą po 5-15 sekundach rysowania gracza
      if (gameState !== 'player-drawing') return; // Bot zgaduje tylko gdy rysuje gracz

      const guessChance = Math.random();
      const guessTime = Math.random() * 10000 + 5000; // Zgaduje między 5 a 15 sekundą

      setTimeout(() => {
          if (guessChance > 0.5) { // Bot zgadł
              console.log('Bot zgadł!');
              endRound(true, 'bot'); // Bot zgadł
          } else { // Bot nie zgadł
              console.log('Bot nie zgadł (symulacja).');
              // Runda trwa dalej do końca czasu
          }
      }, guessTime);
  };


  // Funkcja do obsługi zgadywania słowa przez gracza (przez czat)
  const handlePlayerGuess = (guess: string) => {
    if (gameState !== 'player-drawing' && gameState !== 'bot-drawing') return false; // Gracz może zgadywać tylko gdy ktoś rysuje

    if (guess.toLowerCase() === currentWord.toLowerCase()) {
      console.log('Gracz zgadł!');
      // W trybie solo, gracz zgaduje tylko gdy rysuje bot
      if (!isPlayerTurn) {
         endRound(true, 'player'); // Gracz zgadł
         return true; // Zgadywanie udane
      }
    }
    return false; // Zgadywanie nieudane
  };

  // Funkcja kończąca rundę
  const endRound = (guessed: boolean, guesserId?: string) => {
    setGameState('end-of-round');
    let message = '';
    let playerPoints = 0;
    let botPoints = 0;
    const guessedWord = currentWord; // Zachowaj słowo przed resetem

    if (guessed) {
      message = `Słowo odgadnięte! Było to: "${guessedWord}".`;
      if (guesserId === 'player') {
        // Gracz zgadł (gdy rysował bot)
        playerPoints = Math.max(10, timeLeft * 2); // Punkty za zgadnięcie (więcej za szybsze zgadnięcie)
        botPoints = 5; // Bot dostaje punkty za narysowanie słowa, które zostało odgadnięte
        message = `Ty odgadłeś słowo! Było to: "${guessedWord}". Zdobywasz ${playerPoints} punktów! Bot zdobywa ${botPoints} punktów.`;
      } else if (guesserId === 'bot') {
         // Bot zgadł (gdy rysował gracz)
         botPoints = Math.max(10, timeLeft * 2); // Punkty dla bota za zgadnięcie
         playerPoints = 5; // Gracz dostaje punkty za narysowanie słowa, które bot zgadł
         message = `Bot odgadł słowo! Było to: "${guessedWord}". Bot zdobywa ${botPoints} punktów! Ty zdobywasz ${playerPoints} punktów.`;
      }
    } else {
      // Czas minął, nikt nie zgadł
      message = `Czas minął! Nikt nie odgadł słowa: "${guessedWord}".`;
      if (isPlayerTurn) {
          playerPoints = 10; // Gracz dostaje punkty za rysowanie, nawet jeśli nikt nie zgadł
          message += ` Zdobywasz ${playerPoints} punktów!`;
      } else {
          botPoints = 10; // Bot dostaje punkty za rysowanie, nawet jeśli nikt nie zgadł
          message += ` Bot zdobywa ${botPoints} punktów!`;
      }
    }

    // Aktualizacja punktacji
    setPlayers(prevPlayers => prevPlayers.map(p => {
        if (p.id === 'player') return { ...p, score: p.score + playerPoints };
        if (p.id === 'bot') return { ...p, score: p.score + botPoints };
        return p;
    }));

    setEndOfRoundMessage(message);
    setIsEndOfRoundDialogOpen(true);
  };

  // Funkcja do przejścia do następnej rundy
  const nextRound = () => {
    setIsEndOfRoundDialogOpen(false);
    setRound(prevRound => prevRound + 1);
  };

  // Funkcja do wyboru słowa przez gracza
  const handleWordSelect = (word: string) => {
    setCurrentWord(word);
    setGameState('player-drawing');
    // Rozpocznij symulację zgadywania bota po wybraniu słowa przez gracza
    simulateBotGuess();
  };

  // Funkcja do obsługi wysyłania wiadomości z GameLayout
  const handleSendMessage = (messageText: string) => {
      // Dodaj wiadomość gracza do czatu
      const newMessage: ChatMessage = {
        id: chatMessages.length + 1,
        sender: 'Ty', // Zastąp to rzeczywistym imieniem użytkownika
        text: messageText.trim(),
      };
      setChatMessages(prevMessages => [...prevMessages, newMessage]);

      // Sprawdź, czy wiadomość jest zgadywaniem
      const guessSuccessful = handlePlayerGuess(messageText.trim());

      if (guessSuccessful) {
        // Jeśli gracz zgadł, dodaj wiadomość systemową
         const successMessage: ChatMessage = {
           id: chatMessages.length + 2,
           sender: 'System',
           text: `Gracz Ty odgadł słowo!`, // Zastąp 'Ty' rzeczywistym imieniem
         };
         setChatMessages((prevMessages) => [...prevMessages, successMessage]);
      }
  };


  return (
    <>
      {/* Przekazujemy potrzebne stany i funkcje do GameLayout */}
      <GameLayout
        canvasRef={canvasRef}
        isDrawing={isDrawing}
        setIsDrawing={setIsDrawing}
        lastPoint={lastPoint}
        setLastPoint={setLastPoint}
        currentWord={currentWord}
        maskedWord={maskedWord}
        timeLeft={timeLeft}
        round={round}
        maxRounds={maxRounds}
        players={players}
        chatMessages={chatMessages}
        newMessage={newMessage} // Przekazujemy stan newMessage
        setNewMessage={setNewMessage} // Przekazujemy funkcję do aktualizacji newMessage
        handleSendMessage={handleSendMessage} // Przekazujemy funkcję do wysyłania wiadomości
        chatMessagesEndRef={chatMessagesEndRef}
        isPlayerTurn={isPlayerTurn} // Przekazujemy informację, czy to tura gracza
      />

      {/* Okno dialogowe wyboru słowa dla gracza */}
      <Dialog open={gameState === 'word-selection'} onOpenChange={(open) => { if (!open) setGameState('idle'); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wybierz słowo do narysowania</DialogTitle>
          </DialogHeader>
          <div className="flex justify-around p-4">
            {wordsToChoose.map(word => (
              <Button key={word} onClick={() => handleWordSelect(word)}>
                {word}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Okno dialogowe końca rundy */}
      <Dialog open={isEndOfRoundDialogOpen} onOpenChange={setIsEndOfRoundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Koniec Rundy {round}</DialogTitle>
          </DialogHeader>
          <div className="p-4 text-center">
            <p className="text-lg">{endOfRoundMessage}</p>
            <p className="mt-4 text-xl font-semibold">Aktualny wynik:</p>
            <ul>
                {players.map(player => (
                    <li key={player.id}>{player.name}: {player.score} pkt</li>
                ))}
            </ul>
          </div>
          <DialogFooter>
            <Button onClick={nextRound}>Następna Runda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SoloGamePage;