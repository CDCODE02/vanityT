import init, { VanityEngine } from '../engine/vanity_engine';

let engine: VanityEngine | null = null;
let isInitialized = false;

// Convert hex string to byte array
function parseHexPattern(hexStr: string): Uint8Array {
  let cleanStr = hexStr.toLowerCase().replace(/^0x/, '');
  if (cleanStr.length % 2 !== 0) {
    cleanStr = '0' + cleanStr; // Pad to even length
  }
  const byteLen = cleanStr.length / 2;
  const bytes = new Uint8Array(byteLen);
  
  for (let i = 0; i < byteLen; i++) {
    bytes[i] = parseInt(cleanStr.substring(i * 2, i * 2 + 2), 16);
  }
  
  return bytes;
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    if (isInitialized) return;
    try {
      // Fetch WASM from the public directory for consistent worker access
      await init('/vanity_engine_bg.wasm');
      engine = new VanityEngine();
      isInitialized = true;
      self.postMessage({ type: 'INIT_DONE' });
    } catch (err) {
      console.error("Worker WASM initialization failed:", err);
      self.postMessage({ type: 'ERROR', error: `WASM Init Failed: ${String(err)}` });
    }
  } else if (type === 'START') {
    if (!isInitialized || !engine) {
      self.postMessage({ type: 'ERROR', error: 'Worker not initialized' });
      return;
    }

    const { prefix, suffix, sharedBuffer, batchSize = 25000 } = payload;
    const flagArray = new Int32Array(sharedBuffer);
    
    const prefixBytes = parseHexPattern(prefix || '');
    const suffixBytes = parseHexPattern(suffix || '');

    let totalAttempts = 0;
    let lastReportTime = Date.now();
    
    try {
      while (Atomics.load(flagArray, 0) === 0) {
        const result = engine.search_batch(
          prefixBytes,
          suffixBytes,
          batchSize
        );

        totalAttempts += batchSize;

        if (result) {
          // Atomic check and set to prevent multiple results
          if (Atomics.compareExchange(flagArray, 0, 0, 1) === 0) {
            self.postMessage({
              type: 'FOUND',
              result: {
                address: result.address,
                privateKey: result.private_key
              },
              attempts: totalAttempts
            });
          }
          break;
        }

        // Throttled telemetry
        const now = Date.now();
        if (now - lastReportTime >= 250) {
          self.postMessage({ type: 'PROGRESS', attempts: totalAttempts });
          totalAttempts = 0;
          lastReportTime = now;
        }
      }
      
      // Final progress report if stopped
      if (totalAttempts > 0) {
         self.postMessage({ type: 'PROGRESS', attempts: totalAttempts });
      }

      self.postMessage({ type: 'STOPPED' });
    } catch (err) {
      self.postMessage({ type: 'ERROR', error: String(err) });
    }
  }
};
