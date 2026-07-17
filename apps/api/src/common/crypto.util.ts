import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

const ALGO = 'aes-256-gcm';

function deriveKey(): Buffer {
  const secret = process.env.CLUSTER_SECRET_KEY;
  if (!secret) {
    throw new Error(
      'CLUSTER_SECRET_KEY env var is required to encrypt cluster credentials',
    );
  }
  return scryptSync(secret, 'mongoops-cluster-secrets', 32);
}

export function encryptSecret(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

export function decryptSecret(payload: string): string {
  const key = deriveKey();
  const [ivHex, authTagHex, dataHex] = payload.split(':');
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
