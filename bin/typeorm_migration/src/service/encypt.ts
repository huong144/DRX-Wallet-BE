export const userId = 1;
export const indexOfHotWallet = 0;
export const algorithm = 'aes-192-cbc';
export const iv = Buffer.alloc(16, 0);
export const UNSIGNED = 'unsigned';
export const kmsId = 0;
const crypto = require('crypto');

export function encrypt(msg: string, pass: string) {
  const key = crypto.scryptSync(pass, 'salt', 24);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  return (cipher.update(msg, 'utf8', 'hex') + cipher.final('hex')).toString();
}
