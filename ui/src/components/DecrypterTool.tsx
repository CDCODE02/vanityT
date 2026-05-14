'use client';
import { useState } from 'react';

export function DecrypterTool() {
  const [payload, setPayload] = useState('');
  const [password, setPassword] = useState('');
  const [decryptedKey, setDecryptedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDecrypt = async () => {
    setError(null);
    setDecryptedKey(null);

    if (!payload || !password) {
      setError('Both payload and password are required.');
      return;
    }

    try {
      // 1. Decode Base64 safely
      const binaryString = atob(payload.trim());
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      if (bytes.length < 28) {
        throw new Error('Invalid payload format.');
      }

      // 2. Extract Salt (16 bytes), Nonce (12 bytes), and Ciphertext
      const salt = bytes.slice(0, 16);
      const nonce = bytes.slice(16, 28);
      const ciphertext = bytes.slice(28);

      // 3. Derive Key using PBKDF2
      const encoder = new TextEncoder();
      const passwordKey = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      const cryptoKey = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256',
        },
        passwordKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      // 4. Decrypt
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: nonce,
        },
        cryptoKey,
        ciphertext
      );

      // 5. Decode to string
      const decoder = new TextDecoder();
      setDecryptedKey(decoder.decode(decryptedBuffer));
    } catch (err: any) {
      console.error("Decryption error:", err);
      setError('Decryption failed. Please check the payload and password.');
    }
  };

  return (
    <div className="glass-panel p-6 mt-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center">
        <span className="bg-purple-500 w-1.5 h-6 rounded-full mr-3"></span>
        Offline Decrypter Tool
      </h2>
      <p className="text-sm text-slate-400 mb-6">
        Paste the encrypted output from your cloud server here. Decryption happens entirely offline in your browser.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Encrypted Payload (Base64)</label>
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl p-3 text-mono text-sm h-24 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
            placeholder="Enter the Base64 payload..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Decryption Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
            placeholder="Enter the password used on the server"
          />
        </div>

        <button
          onClick={handleDecrypt}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-purple-500/20"
        >
          Decrypt Private Key
        </button>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-in fade-in">
            {error}
          </div>
        )}

        {decryptedKey && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl animate-in slide-in-from-top-2 fade-in">
            <label className="block text-xs font-bold text-green-400 mb-1 uppercase tracking-wider">Decrypted Private Key</label>
            <div className="font-mono text-sm break-all text-green-300">
              {decryptedKey}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
