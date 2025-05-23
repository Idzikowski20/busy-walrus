import React, { useRef, useEffect, useState } from 'react';
import GameLayout from "@/components/GameLayout"; // Komponent layoutu wizualnego
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner"; // Użyjemy sonner do powiadomień
import { useNavigate } from 'react-router-dom'; // Import useNavigate do wyjścia z gry
import { supabase } from '@/integrations/supabase/client'; // Import Supabase client
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // Import react-query hooks

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

// Definicja typu dla profilu (potrzebna do aktualizacji statystyk)
interface Profile {
    id: string;
    first_name: string | null;
    last_name: string | null;
    wins: number;
    losses: number;
    desertions: number;
}


// Lista przykładowych słów (rzeczy lub zwierzęta)
const WORDS = ['słoń', 'dom', 'drzewo', 'samochód', 'kwiat', 'książka', 'pies', 'kot', 'mysz', 'krzesło', 'stół', 'lampa'];

const SoloGamePage = () => {
  const navigate = useNavigate(); // Hook do nawigacji
  const queryClient = useQueryClient(); // Hook do zarządzania cache react-query
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); // Stan na ID aktualnego użytkownika

  // Pobierz ID aktualnego użytkownika przy ładowaniu komponentu
  useEffect(() => {
      const fetchUser = async () => {
          const { data: { user } } = await supabase.auth.getUser();
          setCurrentUserId(user?.id || null);
      };
      fetchUser();
  }, []);

  // Fetch current user's profile to get current stats for updating
  const { data: profile } = useQuery<Profile>({
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
      enabled: !!currentUserId, // Zapytanie uruchomi się tylko gdy currentUserId jest dostępne
  });


  // Stan gry
  const [gameState, setGameState] = useState<'idle' | 'word-selection' | 'player-drawing' | 'bot-drawing' | 'end-of-round' | 'game-ended'>('idle'); // Dodano 'game-ended'
  const [currentWord, setCurrentWord] = useState('');
  // Stan dla zamaskowanego słowa (obliczany tutaj)
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

  // Stan dla okna dialogowego końca rundy/gry
  const [isEndOfRoundDialogOpen, setIsEndOfRoundDialogOpen] = useState(false);
  const [endOfRoundMessage, setEndOfRoundMessage] = useState('');

  // Ref do elementu audio dla dźwięku wiadomości
  const messageSoundRef = useRef<HTMLAudioElement>(null);

  // Mutation do aktualizacji statystyk gracza (wygrane/przegrane/dezercje)
  const updatePlayerStatsMutation = useMutation({
      mutationFn: async ({ userId, wins = 0, losses = 0, desertions = 0 }: { userId: string; wins?: number; losses?: number; desertions?: number }) => {
          if (!userId) throw new Error("User ID is not available for stats update");
          const { data, error } = await supabase
            .from("profiles")
            .update({
                wins: (profile?.wins || 0) + wins,
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


  // --- Logika gry ---

  // Efekt do rozpoczęcia nowej rundy lub zakończenia gry
  useEffect(() => {
    if (gameState === 'game-ended') {
        // Gra zakończona, nic więcej nie robimy w tym efekcie
        return;
    }

    if (round > maxRounds) {
      // Koniec gry
      console.log('Koniec gry!');
      setGameState('game-ended');
      // TODO: Zaimplementować ekran końcowy gry z podsumowaniem wyników
      let finalMessage = "Gra zakończona! Wyniki:\n";
      players.forEach(p => {
          finalMessage += `${p.name}: ${p.score} pkt\n`;
      });
      setEndOfRoundMessage(finalMessage); // Używamy tego samego stanu dla uproszczenia
      setIsEndOfRoundDialogOpen(true); // Otwórz okno z wynikami końcowymi
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

    // Czyść canvas na początku każdej rundy
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (context && canvas) {
        context.clearRect(0, 0, canvas.width, canvas.height);
    }


    if (newPlayersState[playerIndex].id === 'player') {
      // Tura gracza - wybór słowa
      setGameState('word-selection');
      selectWordsToChoose();
    } else {
      // Tura bota - bot "wybiera" słowo i zaczyna "rysować"
      setGameState('bot-drawing');
      selectBotWord();
    }

  }, [round, gameState]); // Zależność od rundy i stanu gry

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

  // Efekt do maskowania słowa (pierwsza i ostatnia litera widoczna)
  useEffect(() => {
    if (currentWord) {
      if (currentWord.length <= 2) {
        // Jeśli słowo ma 1 lub 2 litery, wyświetl całe
        setMaskedWord(currentWord);
      } else {
        // Maskuj: pierwsza litera + podkreślniki + ostatnia litera
        const firstLetter = currentWord[0];
        const lastLetter = currentWord[currentWord.length - 1];
        const maskedPart = '_'.repeat(currentWord.length - 2);
        setMaskedWord(firstLetter + maskedPart + lastLetter);
      }
    } else {
      setMaskedWord('');
    }
  }, [currentWord]); // Zależność od currentWord

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
    // Gracz może zgadywać tylko gdy rysuje bot
    if (gameState !== 'bot-drawing') return false;

    if (guess.toLowerCase() === currentWord.toLowerCase()) {
      console.log('Gracz zgadł!');
      endRound(true, 'player'); // Gracz zgadł
      return true; // Zgadywanie udane
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
        // Aktualizuj statystyki gracza - wygrana
        if (currentUserId) {
            updatePlayerStatsMutation.mutate({ userId: currentUserId, wins: 1 });
        }
      } else if (guesserId === 'bot') {
         // Bot zgadł (gdy rysował gracz)
         botPoints = Math.max(10, timeLeft * 2); // Punkty dla bota za zgadnięcie
         playerPoints = 5; // Gracz dostaje punkty za narysowanie słowa, które bot zgadł
         message = `Bot odgadł słowo! Było to: "${guessedWord}". Bot zdobywa ${botPoints} punktów! Ty zdobywasz ${playerPoints} punktów.`;
         // Aktualizuj statystyki gracza - przegrana (bo bot zgadł)
         if (currentUserId) {
             updatePlayerStatsMutation.mutate({ userId: currentUserId, losses: 1 });
         }
      }
    } else {
      // Czas minął, nikt nie zgadł
      message = `Czas minął! Nikt nie odgadł słowa: "${guessedWord}".`;
      if (isPlayerTurn) {
          playerPoints = 10; // Gracz dostaje punkty za rysowanie, nawet jeśli nikt nie zgadł
          message += ` Zdobywasz ${playerPoints} punktów!`;
          // Aktualizuj statystyki gracza - przegrana (bo nikt nie zgadł w jego turze)
          if (currentUserId) {
              updatePlayerStatsMutation.mutate({ userId: currentUserId, losses: 1 });
          }
      } else {
          botPoints = 10; // Bot dostaje punkty za rysowanie, nawet jeśli nikt nie zgadł
          message += ` Bot zdobywa ${botPoints} punktów!`;
          // Aktualizuj statystyki gracza - przegrana (bo nie zgadł w turze bota)
          if (currentUserId) {
              updatePlayerStatsMutation.mutate({ userId: currentUserId, losses: 1 });
          }
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

      // Odtwórz dźwięk wiadomości (jeśli element audio istnieje)
      if (messageSoundRef.current) {
          messageSoundRef.current.currentTime = 0; // Zresetuj czas odtwarzania, aby można było szybko odtwarzać dźwięk
          messageSoundRef.current.play().catch(error => console.error("Error playing sound:", error));
      }


      // Sprawdź, czy wiadomość jest zgadywaniem (tylko gdy rysuje bot)
      if (!isPlayerTurn) {
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
      }
  };

  // Funkcja do opuszczenia gry (dezercja)
  const handleLeaveGame = () => {
      console.log("Gracz opuścił grę (dezercja).");
      // Aktualizuj statystyki gracza - dezercja
      if (currentUserId) {
          updatePlayerStatsMutation.mutate({ userId: currentUserId, desertions: 1 });
      }
      toast.warning("Opuściłeś grę. Zostałeś ukarany (dezercja).");
      navigate('/game-modes'); // Przekieruj do menu wyboru trybu gry
  };


  return (
    <>
      {/* Element audio dla dźwięku wiadomości - musisz dodać plik dźwiękowy! */}
      {/* Przykład: <audio ref={messageSoundRef} src="/sounds/message_sent.mp3" /> */}
      {/* Pamiętaj, aby dodać swoje pliki dźwiękowe do folderu public/sounds */}
      <audio ref={messageSoundRef} src="/sounds/message_sent.mp3" /> {/* Zmień ścieżkę na swoją */}
      {/* TODO: Dodać elementy audio dla innych dźwięków (wygrana, przegrana, przejście tury itp.) */}


      {/* Przycisk do opuszczenia gry */}
      <div className="absolute top-4 right-4 z-10">
          <Button variant="outline" onClick={handleLeaveGame} disabled={gameState === 'game-ended'}>Opuść Grę</Button>
      </div>


      {/* Przekazujemy potrzebne stany i funkcje do GameLayout */}
      <GameLayout
        canvasRef={canvasRef}
        isDrawing={isDrawing}
        setIsDrawing={setIsDrawing}
        lastPoint={lastPoint}
        setLastPoint={setLastPoint}
        currentWord={currentWord}
        maskedWord={maskedWord} // Przekazujemy zamaskowane słowo
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
        gameState={gameState} // Przekazujemy stan gry
      />

      {/* Okno dialogowe wyboru słowa dla gracza */}
      <Dialog open={gameState === 'word-selection'} onOpenChange={(open) => { if (!open && gameState === 'word-selection') setGameState('idle'); }}> {/* Dodano warunek na gameState */}
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

      {/* Okno dialogowe końca rundy/gry */}
      <Dialog open={isEndOfRoundDialogOpen} onOpenChange={(open) => { if (!open && gameState !== 'game-ended') setIsEndOfRoundDialogOpen(false); }}> {/* Zmieniono logikę zamykania */}
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{gameState === 'game-ended' ? 'Koniec Gry' : `Koniec Rundy ${round}`}</DialogTitle> {/* Zmieniono tytuł */}
          </DialogHeader>
          <div className="p-4 text-center">
            <p className="text-lg">{endOfRoundMessage}</p>
            {gameState !== 'game-ended' && ( // Wyświetl wyniki rundy tylko jeśli gra się nie skończyła
                <p className="mt-4 text-xl font-semibold">Aktualny wynik:</p>
            )}
            <ul>
                {players.map(player => (
                    <li key={player.id}>{player.name}: {player.score} pkt</li>
                ))}
            </ul>
          </div>
          <DialogFooter>
            {gameState !== 'game-ended' ? (
                <Button onClick={nextRound}>Następna Runda</Button>
            ) : (
                 <Button onClick={() => navigate('/game-modes')}>Powrót do Menu</Button> // Przycisk powrotu po zakończeniu gry
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SoloGamePage;