import React from 'react';

const GameLayout = () => {
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
        <div className="flex-1 bg-white rounded-lg shadow-md p-4 flex items-center justify-center">
          {/* Placeholder na Canvas do rysowania */}
          <div className="text-gray-400 text-xl">Obszar rysowania (Canvas)</div>
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
            {/* Placeholder na wiadomości czatu */}
            <div className="flex-1 overflow-y-auto border-b pb-2 mb-2">
              <p className="text-gray-600">Wiadomość 1...</p>
              <p className="text-gray-600">Wiadomość 2...</p>
              {/* ...więcej wiadomości */}
            </div>
            {/* Placeholder na pole wprowadzania czatu */}
            <input
              type="text"
              placeholder="Wpisz zgadywane słowo lub wiadomość"
              className="w-full p-2 border rounded"
            />
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