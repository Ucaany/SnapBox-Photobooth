import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Menggabungkan class Tailwind dengan aman.
 *
 * `clsx` menangani nilai kondisional; `twMerge` memastikan class yang bentrok
 * (mis. `p-2` dan `p-4`) tidak keduanya lolos, sehingga prop `className` dari
 * pemanggil selalu menang atas default komponen.
 *
 * @param inputs Daftar class, boleh string, array, objek kondisional, atau falsy.
 * @returns Satu string class yang sudah dinormalisasi.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
