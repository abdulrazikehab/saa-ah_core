import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012'; // 32 chars
const IV_LENGTH = 16;
// Fixed IV for deterministic encryption (IDs)
const DETERMINISTIC_IV = Buffer.alloc(IV_LENGTH, 0); 

export class EncryptionUtil {
  // Random IV - for sensitive data fields (not IDs)
  static encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('base64');
  }

  static decrypt(text: string): string {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }

  // Deterministic - for IDs (allows joins/lookups)
  static encryptDeterministic(text: string): string {
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), DETERMINISTIC_IV);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    // Encode as hex so IDs are alphanumeric-only (no special characters)
    return encrypted.toString('hex');
  }

  static decryptDeterministic(text: string): string {
    // Support both new hex-encoded IDs and old base64-encoded IDs for backward compatibility
    let encryptedText: Buffer;

    const looksLikeHex = /^[0-9a-fA-F]+$/.test(text) && text.length % 2 === 0;
    if (looksLikeHex) {
      encryptedText = Buffer.from(text, 'hex');
    } else {
      encryptedText = Buffer.from(text, 'base64');
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), DETERMINISTIC_IV);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }
  
  static isEncrypted(text: string): boolean {
      // Basic check: Random IV format (hex:base64) OR Deterministic (base64)
      // It's hard to distinguish deterministic base64 from normal string, but we can try.
      // For this task, we rely on the middleware logic to know when to encrypt.
      return text.includes(':') && text.split(':')[0].length === 32;
  }
}
