'use strict';
/* CIVITAS crypto.js — native Web Crypto API only.
   AES-GCM 256 with a passphrase-derived key (PBKDF2-SHA256, 250k iterations).
   Dispatch payload format: { v:1, alg:'AES-GCM', kdf:'PBKDF2', iter, salt, iv, data } (all b64). */

const CivCrypto = {

  ITERATIONS: 250000,

  _bytesToB64(bytes) {
    let s = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(s);
  },

  _b64ToBytes(b64) {
    const s = atob(b64);
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes;
  },

  async _deriveKey(passphrase, salt, iterations) {
    const base = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },

  /** Encrypt any JSON-serialisable object with a shared passphrase. */
  async encrypt(obj, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this._deriveKey(passphrase, salt, this.ITERATIONS);
    const plain = new TextEncoder().encode(JSON.stringify(obj));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
    return {
      v: 1, alg: 'AES-GCM', kdf: 'PBKDF2', iter: this.ITERATIONS,
      salt: this._bytesToB64(salt),
      iv: this._bytesToB64(iv),
      data: this._bytesToB64(new Uint8Array(cipher)),
    };
  },

  /** Decrypt a payload produced by encrypt(). Throws on wrong passphrase (GCM auth failure). */
  async decrypt(payload, passphrase) {
    const salt = this._b64ToBytes(payload.salt);
    const iv = this._b64ToBytes(payload.iv);
    const key = await this._deriveKey(passphrase, salt, payload.iter || this.ITERATIONS);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv }, key, this._b64ToBytes(payload.data));
    return JSON.parse(new TextDecoder().decode(plain));
  },

  /** Hex SHA-256 of a string — evidence dedup hashes + challenge answers. */
  async sha256hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  },
};
