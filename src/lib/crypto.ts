import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard
const TAG_LENGTH = 16;

/**
 * Derive the 32-byte encryption key from the ENCRYPTION_KEY env var.
 * Throws at call-time if the env var is missing — fail fast.
 */
function getKey(): Buffer {
    const raw = process.env.ENCRYPTION_KEY;
    if (!raw) {
        throw new Error('crypto: ENCRYPTION_KEY environment variable is not set');
    }
    // If the env var is a 64-char hex string (32 bytes), use it directly.
    // Otherwise hash it to get a fixed-length key.
    if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
        return Buffer.from(raw, 'hex');
    }
    // Fallback: use SHA-256 of the raw string
    const { createHash } = require('node:crypto');
    return createHash('sha256').update(raw).digest();
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns a single base64 string containing IV + ciphertext + auth tag.
 */
export function encrypt(plaintext: string): string {
    const key = getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    // Pack: IV (12) + encrypted (??) + tag (16)
    const packed = Buffer.concat([iv, encrypted, tag]);
    return packed.toString('base64');
}

/**
 * Decrypt a ciphertext string produced by `encrypt()`.
 * Returns the original plaintext.
 */
export function decrypt(ciphertext: string): string {
    const key = getKey();
    const packed = Buffer.from(ciphertext, 'base64');

    const iv = packed.subarray(0, IV_LENGTH);
    const tag = packed.subarray(packed.length - TAG_LENGTH);
    const encrypted = packed.subarray(IV_LENGTH, packed.length - TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
    ]);
    return decrypted.toString('utf8');
}
