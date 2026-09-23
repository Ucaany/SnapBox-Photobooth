/**
 * @snapbox/shared: kontrak bersama untuk web, desktop, dan DB.
 *
 * Modul ini hanya boleh berisi tipe, skema Zod, dan konstanta murni. Tidak ada
 * akses jaringan, tidak ada I/O, dan tidak ada import `next/*` atau Drizzle,
 * supaya aman dipakai di runtime browser, Node, dan Rust bridge.
 */
export * from './auth';
export * from './domain';
export * from './env';
export * from './errors';
export * from './events';
