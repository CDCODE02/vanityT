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

  // Initialize workers
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    const numWorkers = Math.max(1, (navigator.hardwareConcurrency || 4) - 1); // leave 1 core for UI
    
    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(new URL('../workers/vanity.worker.ts', import.meta.url), { type: 'module' });
      worker.postMessage({ type: 'INIT' });
      workersRef.current.push(worker);
    }

    return () => {
      workersRef.current.forEach(w => w.terminate());
      workersRef.current = [];
    };
  }, []);

  const startSearch = useCallback((prefix: string, suffix: string) => {
    if (workersRef.current.length === 0) return;

    // Reset stats
    startTimeRef.current = performance.now();
    totalAttemptsRef.current = 0;
    setResult(null);
    setStats({
      attemptsPerSecond: 0,
      totalAttempts: 0,
      elapsedMs: 0,
      status: 'searching'
    });

    // Create shared stop flag
    const buffer = new SharedArrayBuffer(1);
    const flagArray = new Uint8Array(buffer);
    flagArray[0] = 0; // 0 = running, 1 = stop
    sharedBufferRef.current = buffer;

    // Setup message handlers and start workers
    workersRef.current.forEach(worker => {
      worker.onmessage = (e) => {
        const { type, payload, attempts, result: foundResult, error } = e.data;
        
        if (type === 'PROGRESS') {
          totalAttemptsRef.current += attempts;
        } else if (type === 'FOUND') {
          setResult(foundResult);
          setStats(prev => ({ ...prev, status: 'found' }));
          stopSearch();
        } else if (type === 'ERROR') {
          console.error("Worker error:", error);
          setStats(prev => ({ ...prev, status: 'error', errorMessage: error }));
          stopSearch();
        }
      };

      worker.postMessage({
        type: 'START',
        payload: { prefix, suffix, sharedBuffer: buffer, batchSize: 10000 }
      });
    });

    // Stats update timer
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
    }, 100);

  }, []);

  const stopSearch = useCallback(() => {
    if (sharedBufferRef.current) {
      const flagArray = new Uint8Array(sharedBufferRef.current);
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

  return { startSearch, stopSearch, stats, result, workerCount: workersRef.current.length };
}
