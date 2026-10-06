import { useUI } from '../lib/ui.jsx';

export default function Toasts() {
  const { toasts } = useUI();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map(t => <div key={t.id} className={`toast glass tone-${t.tone}`}>{t.text}</div>)}
    </div>
  );
}
