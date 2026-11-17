import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BackToDeck, insideDeck } from './components/BackToDeck.tsx';
import './index.css';

// Cada tela carrega só o que precisa (a missão nem abre conexão Socket.IO).
const Entry = lazy(() => import('./pages/Entry.tsx'));
const Home = lazy(() => import('./pages/Home.tsx'));
const Host = lazy(() => import('./pages/Host.tsx'));
const Player = lazy(() => import('./pages/Player.tsx'));
const Mission = lazy(() => import('./pages/Mission.tsx'));
const MissionScreen = lazy(() => import('./pages/MissionScreen.tsx'));

// Rotas:
//   /              aluno: entra direto na sala mais recente (é para onde o QR do deck aponta)
//   /professor     professor: cria a sala
//   /host/ABCD?k=  telão
//   /ABCD          celular do aluno
//   /m/1           missão no celular · /m/1/tela nuvem em tela cheia
function route() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts.length === 0) return <Entry />;
  if (parts[0] === 'professor') return <Home />;
  if (parts[0] === 'host' && parts[1]) return <Host code={parts[1].toUpperCase()} />;
  if (parts[0] === 'm' && parts[1]) return parts[2] === 'tela' ? <MissionScreen id={parts[1]} /> : <Mission id={parts[1]} />;
  // Códigos não têm vogais, então nenhuma outra rota é confundida com uma sala.
  if (parts.length === 1 && /^[bcdfghjklmnpqrstvwxz]{4}$/i.test(parts[0])) return <Player code={parts[0].toUpperCase()} />;
  return <Entry />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div className="glow-bg h-full" />}>{route()}</Suspense>
    {insideDeck && <BackToDeck />}
  </StrictMode>,
);
