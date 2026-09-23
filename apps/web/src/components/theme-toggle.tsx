'use client';

import { Button } from '@snapbox/ui';

import { useTheme } from './theme-provider';

export interface ThemeToggleProps {
  className?: string;
  /** Label aksesibel; ganti bila bahasa halaman bukan Indonesia. */
  label?: string;
}

/**
 * Tombol toggle terang/gelap neobrutalism.
 *
 * Ikon melambangkan TUJUAN aksi ("jadi terang"), bukan keadaan saat ini — pola
 * yang paling mudah diprediksi user. `aria-label` wajib karena ikon saja tidak
 * cukup (PRD Bab 4: status aksi tidak boleh hanya lewat visual).
 *
 * ponytail: ikon digambar inline, bukan `lucide-react`. Icon adalah dependency
 * `@snapbox/ui`, BUKAN `apps/web`; mengimpornya langsung dari apps/web
 * bergantung pada hoisting pnpm yang tidak dijamin. Dua `<path>` lebih murah
 * daripada menambah dependency atau memperluas permukaan barrel UI.
 * Ganti ke `lucide-react` bila apps/web resmi mendeklarasikannya sendiri.
 */
export function ThemeToggle({ className, label = 'Ubah tema' }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={className}
      aria-label={isDark ? `${label}: aktifkan terang` : `${label}: aktifkan gelap`}
      aria-pressed={isDark}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? (
        <MoonIcon className="h-5 w-5" />
      ) : (
        <SunIcon className="h-5 w-5" />
      )}
    </Button>
  );
}

interface IconProps {
  className?: string;
}

/** Ikon matahari: stroke tebal 2.25 agar konsisten dengan bobot border neobrutalism. */
function SunIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

/** Ikon bulan. `arihidden` di elemen induk sudah menutup kebutuhan a11y. */
function MoonIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}
