import { useEffect } from 'react';

/** O app está aberto dentro do deck (tecla J da apresentação)? */
export const insideDeck = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const backToDeck = () => window.parent.postMessage('vrio:aula', '*');

/** Dentro do deck: botão e tecla A para voltar para a aula sem trocar de aba. */
export function BackToDeck() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        backToDeck();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <button
      onClick={backToDeck}
      title="Voltar para a apresentação (tecla A)"
      className="fixed left-1/2 top-2 z-[1000] -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-sm font-semibold text-white/80 ring-1 ring-white/20 backdrop-blur transition hover:bg-violet hover:text-white"
    >
      ◀ Voltar à aula <span className="ml-1 rounded bg-white/15 px-1.5 font-mono text-xs">A</span>
    </button>
  );
}
