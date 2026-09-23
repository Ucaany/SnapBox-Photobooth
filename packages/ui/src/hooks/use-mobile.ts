'use client';

import * as React from 'react';

/** Lebar viewport di bawah nilai ini dianggap perangkat mobile. */
const MOBILE_BREAKPOINT = 768;

/**
 * Mendeteksi apakah viewport saat ini mobile (lebar < 768px).
 *
 * Nilai awal `undefined` (dianggap desktop) supaya render server dan render
 * pertama client tidak berbeda; nilai sebenarnya di-set di efek lewat
 * `matchMedia` dan di-update saat viewport berubah.
 *
 * @returns `true` bila viewport lebih sempit dari breakpoint mobile.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener('change', onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !!isMobile;
}
