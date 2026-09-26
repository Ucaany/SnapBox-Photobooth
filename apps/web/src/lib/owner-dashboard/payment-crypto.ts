import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { parseEnv, secretEnvSchema } from '@snapbox/shared/env';

const VERSION = 1;
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
function key(): Buffer {
  const parsed = parseEnv(secretEnvSchema, process.env);
  if (!parsed.success || !parsed.data) throw new Error('ENCRYPTION_KEY_INVALID');
  const value = Buffer.from(parsed.data.ENCRYPTION_MASTER_KEY, 'base64');
  if (value.length !== 32) throw new Error('ENCRYPTION_KEY_INVALID');
  return value;
}
export function encryptPaymentSecret(value: string): Uint8Array {
  const iv = randomBytes(NONCE_LENGTH);
  const actual = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([actual.update(value, 'utf8'), actual.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, ciphertext, actual.getAuthTag()]);
}
export function decryptPaymentSecret(input: Uint8Array): string {
  const data = Buffer.from(input);
  if (data.length < 1 + NONCE_LENGTH + TAG_LENGTH || data[0] !== VERSION)
    throw new Error('PAYMENT_SECRET_INVALID');
  const iv = data.subarray(1, 1 + NONCE_LENGTH);
  const tag = data.subarray(data.length - TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(data.subarray(1 + NONCE_LENGTH, data.length - TAG_LENGTH)),
    decipher.final(),
  ]).toString('utf8');
}
export const encryptPaymentCredential = encryptPaymentSecret;
export const decryptPaymentCredential = decryptPaymentSecret;
