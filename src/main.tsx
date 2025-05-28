import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GameProvider } from './contexts/GameContext';
import App from './App'; // 這裡要正確引入 App.tsx
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <GameProvider>
    <App />
      </GameProvider>
    </BrowserRouter>
  </React.StrictMode>,
);