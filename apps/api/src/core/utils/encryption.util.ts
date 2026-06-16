import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKeyBuffer(): Buffer {
  const secret =
    process.env.ODOO_ENCRYPTION_KEY ||
    'bulog-wms-odoo-secret-encryption-key-fallback';
  // Use SHA-256 to hash the key to exactly 32 bytes to avoid algorithm compatibility issues
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts cleartext using AES-256-GCM.
 * Returns a colon-separated string: IV:AUTH_TAG:CIPHERTEXT
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKeyBuffer();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a colon-separated GCM payload (IV:AUTH_TAG:CIPHERTEXT) into cleartext.
 */
export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Format password terenkripsi tidak valid');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const key = getKeyBuffer();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
