/**
 * Shell kiosk Fase 0.
 *
 * Hanya membuktikan frontend Tauri jalan dan paket workspace bisa di-import di
 * runtime desktop. Attract Mode, state machine sesi, dan hardware engine
 * dibangun di Fase 4 dan 5.
 */
import { cn } from '@snapbox/ui';

export function App() {
  return (
    <main className="kiosk-shell">
      <h1 className="kiosk-title">SnapBox Kiosk</h1>
      <p className="kiosk-copy">
        Kerangka aplikasi desktop aktif. Layar pairing, attract mode, dan sesi foto dibangun pada
        Fase 4 dan 5.
      </p>
      <ul className="kiosk-status">
        <li className={cn('kiosk-badge')}>Tauri v2</li>
        <li className={cn('kiosk-badge')}>React 19</li>
        <li className={cn('kiosk-badge')}>Hardware engine belum terpasang</li>
      </ul>
    </main>
  );
}
