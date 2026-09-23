'use client';

import * as React from 'react';

/**
 * Tema yang didukung web saat ini.
 *
 * Nilai token untuk `'dark'` BELUM ada di globals.css — hanya `'light'` yang
 * benar-benar dirender berbeda. Union ini sengaja menyertakan `'dark'` supaya
 * provider sudah jadi primitif yang siap didorong lapisan tenant theme
 * (ADR-005: Global defaults → Tenant theme → Booth override → Device runtime).
 * Sampai token dark ditulis, `useTheme().theme === 'dark'` hanya mengganti
 * atribut `data-theme`, bukan warna.
 */
export type Theme = 'light' | 'dark';

/** Kunci localStorage. Konstanta supaya skrip init dan provider tidak drift. */
export const THEME_STORAGE_KEY = 'snapbox-theme';

interface ThemeContextValue {
  /** Pilihan eksplisit user/tenant; `null` berarti "ikuti sistem". */
  theme: Theme | null;
  setTheme: (theme: Theme | null) => void;
  /** Tema yang benar-benar aktif setelah preferensi sistem diperhitungkan. */
  resolvedTheme: Theme;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

/**
 * Skrip blocking pra-paint.
 *
 * Harus dieksekusi sebelum browser melukis body, jika tidak user melihat
 * kedipan tema terang sebelum tema tersimpan diterapkan (FOWT). Ditaruh di
 * `<head>` oleh layout, bukan lewat provider, karena provider baru jalan
 * setelah hydration — terlambat.
 *
 * Ditulis sebagai string, bukan komponen React, agar bisa dipasang sebagai
 * `<script dangerouslySetInnerHTML>` tanpa memaksa layout jadi client
 * component. Berisi kode yang harus identik dengan logika `resolve` di bawah.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var r=t==='light'||t==='dark'?t:(m?'dark':'light');var e=document.documentElement;e.setAttribute('data-theme',r);e.style.colorScheme=r;}catch(_){}})();`;

/**
 * Baca tema tersimpan. Dipisah agar `useState` initializer dan efek sinkron
 * memakai satu sumber. Mengembalikan `null` bila user belum memilih (ikut sistem).
 *
 * ponytail: baca localStorage saat render pertama, bukan di efek, karena skrip
 * init sudah menulisnya ke DOM sebelum React jalan; membaca di efek akan
 * memicu re-render yang tidak perlu. Upgrade ke cookie/DB bila tema harus
 * ditentukan server (SSR tenant theme).
 */
function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    // localStorage bisa diblokir (mode privat, iframe sandbox) — anggap belum dipilih.
    return null;
  }
}

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Terapkan tema ke `<html>`: atribut `data-theme` untuk selector CSS, dan
 * `colorScheme` supaya kontrol native (scrollbar, form) ikut menyesuaikan.
 */
function applyTheme(resolved: Theme): void {
  const el = document.documentElement;
  el.setAttribute('data-theme', resolved);
  el.style.colorScheme = resolved;
}

export interface ThemeProviderProps {
  children: React.ReactNode;
  /**
   * Tema awal untuk SSR. Web saat ini selalu `'light'`. Future: lapisan tenant
   * theme (ADR-005) mengisi ini dari server agar tidak perlu koreksi pra-paint.
   */
  defaultTheme?: Theme;
}

/**
 * Provider tema minimal (tanpa `next-themes`).
 *
 * Primitif saja: menyimpan pilihan + menerapkannya ke DOM. Hierarki tenant/booth
 * (ADR-005) adalah pekerjaan lanjutan yang akan memanggil `setTheme`, bukan
 * sesuatu yang dibangun di sini.
 */
export function ThemeProvider({ children, defaultTheme = 'light' }: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme | null>(null);
  const [systemTheme, setSystemTheme] = React.useState<Theme>(defaultTheme);

  // Setelah mount, sinkronkan dengan kondisi nyata (localStorage + sistem).
  // Sebelum ini, nilai default dipakai agar HTML server dan klien cocok.
  React.useEffect(() => {
    setThemeState(readStoredTheme());
    setSystemTheme(getSystemTheme());

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = theme ?? systemTheme;

  React.useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = React.useCallback((next: Theme | null) => {
    setThemeState(next);
    try {
      if (next === null) {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      }
    } catch {
      // Gagal persist bukan alasan membatalkan perubahan tema di sesi ini.
    }
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, resolvedTheme }),
    [theme, setTheme, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Akses tema aktif. Wajib dipakai di dalam `<ThemeProvider>`. */
export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme harus dipakai di dalam <ThemeProvider>.');
  }
  return context;
}
