import { useState, useEffect, useRef, useCallback } from 'react';

export interface MatchResult {
  address: string;
  privateKey: string;
}

export interface EngineStats {
  attemptsPerSecond: number;
  totalAttempts: number;
  elapsedMs: number;
  status: 'idle' | 'searching' | 'found' | 'stopped' | 'error';
  errorMessage?: string;
}

export function useVanityEngine() {
  const [stats, setStats] = useState<EngineStats>({
    attemptsPerSecond: 0,
    totalAttempts: 0,
    elapsedMs: 0,
    status: 'idle',
  });
  const [result, setResult] = useState<MatchResult | null>(null);
  
  const workersRef = useRef<Worker[]>([]);
  const sharedBufferRef = useRef<SharedArrayBuffer | null>(null);
  const startTimeRef = useRef<number>(0);
  const totalAttemptsRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize workers once
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Use ALL logical CPU threads
    const numWorkers = navigator.hardwareConcurrency || 4;
    
    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(new URL('../workers/vanity.worker.ts', import.meta.url), { type: 'module' });
      
      worker.onmessage = (e) => {
        const { type, attempts, result: foundResult, error } = e.data;
        if (type === 'PROGRESS') {
          totalAttemptsRef.current += attempts;
        } else if (type === 'FOUND') {
          setResult(foundResult);
          setStats(prev => ({ ...prev, status: 'found' }));
          stopSearch();
        } else if (type === 'ERROR') {
          console.error(`Worker error:`, error);
          setStats(prev => ({ ...prev, status: 'error', errorMessage: error }));
          stopSearch();
        }
      };

      worker.postMessage({ type: 'INIT' });
      workersRef.current.push(worker);
    }

    return () => {
      workersRef.current.forEach(w => w.terminate());
      workersRef.current = [];
    };
  }, []);

  const stopSearch = useCallback(() => {
    if (sharedBufferRef.current) {
      const flagArray = new Int32Array(sharedBufferRef.current);
      Atomics.store(flagArray, 0, 1); // Signal all workers to stop
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setStats(prev => ({
      ...prev,
      status: prev.status === 'searching' ? 'stopped' : prev.status
    }));
  }, []);

  const startSearch = useCallback((prefix: string, suffix: string) => {
    if (workersRef.current.length === 0) return;

    startTimeRef.current = performance.now();
    totalAttemptsRef.current = 0;
    setResult(null);
    setStats({
      attemptsPerSecond: 0,
      totalAttempts: 0,
      elapsedMs: 0,
      status: 'searching'
    });

    // Check for SharedArrayBuffer support (requires COOP/COEP headers)
    if (typeof SharedArrayBuffer === 'undefined') {
      setStats(prev => ({ 
        ...prev, 
        status: 'error', 
        errorMessage: 'SharedArrayBuffer is not supported. Ensure the page is cross-origin isolated.' 
      }));
      return;
    }

    // Create shared stop flag (Int32Array is better for Atomics)
    const buffer = new SharedArrayBuffer(4);
    const flagArray = new Int32Array(buffer);
    flagArray[0] = 0; // 0 = running, 1 = stop
    sharedBufferRef.current = buffer;

    workersRef.current.forEach(worker => {
      worker.postMessage({
        type: 'START',
        payload: { prefix, suffix, sharedBuffer: buffer, batchSize: 50000 }
      });
    });

    // Throttled stats update (250ms)
    timerRef.current = setInterval(() => {
      const now = performance.now();
      const elapsed = now - startTimeRef.current;
      const total = totalAttemptsRef.current;
      
      setStats(prev => ({
        ...prev,
        totalAttempts: total,
        elapsedMs: elapsed,
        attemptsPerSecond: elapsed > 0 ? Math.floor((total / elapsed) * 1000) : 0
      }));
    }, 250);

  }, [stopSearch]);

  return { startSearch, stopSearch, stats, result, workerCount: workersRef.current.length };
}
