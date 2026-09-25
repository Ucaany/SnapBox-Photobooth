'use client';

/**
 * Form login SnapBox (PRD Task 1.2).
 *
 * Dua mode:
 * - `password`: Firebase Client SDK (`signInWithEmailAndPassword`), lalu ID token
 *   ditukar menjadi cookie sesi lewat `POST /api/auth/session`.
 * - `pin`: email + PIN 6 digit dikirim ke `POST /api/auth/staff-pin`. Firebase
 *   Client SDK TIDAK dipakai di jalur ini karena PIN bukan kredensial Firebase.
 *
 * Aturan yang dipegang di sini:
 * - Klien tidak pernah memutuskan tujuan redirect maupun peran. Keduanya datang
 *   dari respons server (`redirectTo`), agar otorisasi tidak bisa dibajak dari
 *   browser.
 * - Pesan kegagalan bersifat generik; form tidak pernah mengungkap apakah email,
 *   akun, booth, atau langganan yang bermasalah.
 * - Semua field punya label, `aria-invalid`, dan error diumumkan lewat region
 *   `role="alert"`.
 */
import * as React from 'react';

import { Button } from '@snapbox/ui';
import { cn } from '@snapbox/ui';

type LoginMode = 'password' | 'pin';

interface ApiSuccess {
  ok: true;
  role?: string;
  redirectTo?: string | null;
}

interface ApiFailure {
  ok: false;
  message?: string;
  code?: string;
}

const GENERIC_FAILURE = 'Login tidak dapat diproses. Periksa data Anda lalu coba lagi.';
const NETWORK_FAILURE = 'Tidak dapat menghubungi server. Periksa koneksi Anda lalu coba lagi.';
const NO_DESTINATION =
  'Login berhasil, tetapi halaman tujuan untuk peran ini belum tersedia pada fase ini.';

/** Peta kode error Firebase ke pesan Indonesia yang aman. */
function firebaseErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Email atau kata sandi tidak sesuai.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
    case 'auth/user-disabled':
      return 'Akun ini dinonaktifkan. Hubungi Owner tenant Anda.';
    case 'auth/network-request-failed':
      return NETWORK_FAILURE;
    default:
      return GENERIC_FAILURE;
  }
}

interface LoginFormProps {
  /** Path tujuan setelah login, dari `?next=`. Sudah divalidasi server. */
  nextPath: string | null;
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const [mode, setMode] = React.useState<LoginMode>('password');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const errorRef = React.useRef<HTMLParagraphElement>(null);

  function switchMode(next: LoginMode) {
    if (next === mode) return;
    setMode(next);
    setError(null);
    setNotice(null);
    setPassword('');
    setPin('');
  }

  /**
   * Menukar ID token menjadi cookie sesi.
   *
   * Dipisah supaya baik jalur kata sandi maupun (kelak) jalur lain memakai
   * kontrak server yang sama persis.
   */
  async function exchangeIdToken(idToken: string): Promise<string | null> {
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
      cache: 'no-store',
    });

    const payload = (await response.json().catch(() => null)) as ApiSuccess | ApiFailure | null;

    if (!response.ok || !payload || payload.ok !== true) {
      throw new Error((payload as ApiFailure | null)?.message ?? GENERIC_FAILURE);
    }

    return resolveDestination(payload.redirectTo ?? null);
  }

  /** Memutuskan tujuan akhir; `next` yang sah selalu menang atas home peran. */
  function resolveDestination(serverRedirect: string | null): string | null {
    return nextPath ?? serverRedirect ?? null;
  }

  async function submitPassword(): Promise<string | null> {
    const { getFirebaseAuth } = await import('@snapbox/auth/client');
    const { signInWithEmailAndPassword } = await import('firebase/auth');

    const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    const idToken = await credential.user.getIdToken();

    return exchangeIdToken(idToken);
  }

  async function submitPin(): Promise<string | null> {
    const response = await fetch('/api/auth/staff-pin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, pin }),
      cache: 'no-store',
    });

    const payload = (await response.json().catch(() => null)) as ApiSuccess | ApiFailure | null;

    if (!response.ok || !payload || payload.ok !== true) {
      throw new Error((payload as ApiFailure | null)?.message ?? GENERIC_FAILURE);
    }

    return resolveDestination(payload.redirectTo ?? null);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);
    setNotice(null);

    try {
      const destination = mode === 'password' ? await submitPassword() : await submitPin();

      if (!destination) {
        // Peran sah tetapi halaman tujuannya belum ada di fase ini. Jangan
        // pura-pura berhasil dan jangan arahkan ke tautan mati.
        setNotice(NO_DESTINATION);
        return;
      }

      // Navigasi penuh (bukan router.push) agar middleware dan server component
      // membaca cookie baru pada request pertama.
      window.location.assign(destination);
    } catch (cause) {
      const code =
        typeof cause === 'object' && cause !== null && 'code' in cause
          ? String((cause as { code?: unknown }).code ?? '')
          : '';

      setError(code ? firebaseErrorMessage(code) : (cause as Error).message || GENERIC_FAILURE);
    } finally {
      setPending(false);
    }
  }

  React.useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      {/*
        Toggle mode. `type="button"` wajib supaya tidak men-submit form.
        `aria-pressed` memberi tahu pembaca layar mode yang aktif.
      */}
      <div className="auth-switch" role="group" aria-label="Pilih metode masuk">
        <button
          type="button"
          aria-pressed={mode === 'password'}
          className={cn(mode === 'password' && 'auth-switch-active')}
          onClick={() => switchMode('password')}
          disabled={pending}
        >
          Email &amp; kata sandi
        </button>
        <button
          type="button"
          aria-pressed={mode === 'pin'}
          className={cn(mode === 'pin' && 'auth-switch-active')}
          onClick={() => switchMode('pin')}
          disabled={pending}
        >
          PIN staf
        </button>
      </div>

      <div className="auth-field">
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={pending}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'login-error' : undefined}
          className="h-11 w-full rounded-base border-2 border-border bg-secondary-background px-3 text-sm"
        />
      </div>

      {mode === 'password' ? (
        <div className="auth-field">
          <label htmlFor="login-password">Kata sandi</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={pending}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'login-error' : undefined}
            className="h-11 w-full rounded-base border-2 border-border bg-secondary-background px-3 text-sm"
          />
        </div>
      ) : (
        <div className="auth-field">
          <label htmlFor="login-pin">PIN operator (6 digit)</label>
          <input
            id="login-pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
            disabled={pending}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'login-error' : 'login-pin-hint'}
            className="h-11 w-full rounded-base border-2 border-border bg-secondary-background px-3 text-sm"
          />
          <p id="login-pin-hint" className="auth-status">
            PIN dibuat Owner di dasbor staf. Masukkan email akun staf dan PIN booth Anda.
          </p>
        </div>
      )}

      {error ? (
        <p id="login-error" ref={errorRef} role="alert" tabIndex={-1} className="auth-error">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="auth-status">
          {notice}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
        {pending ? 'Memproses...' : mode === 'password' ? 'Masuk' : 'Masuk dengan PIN'}
      </Button>

      <p className="auth-status">
        Akun dibuat lewat undangan Owner atau CEO. Pendaftaran mandiri tidak tersedia.
      </p>
    </form>
  );
}
