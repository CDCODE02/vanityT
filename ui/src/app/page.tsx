'use client';

import { useState } from 'react';
import { HexInput } from '@/components/HexInput';
import { DifficultyBadge } from '@/components/DifficultyBadge';
import { useVanityEngine } from '@/hooks/useVanityEngine';
import { Play, Square, Copy, Download, Cpu, Clock, Activity, ShieldCheck } from 'lucide-react';

export default function Home() {
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [chain, setChain] = useState<'ethereum' | 'base'>('ethereum');
  const [copied, setCopied] = useState(false);

  const { startSearch, stopSearch, stats, result, workerCount } = useVanityEngine();

  const isSearching = stats.status === 'searching';
  const totalChars = prefix.length + suffix.length;
  const isInvalid = totalChars === 0 || (prefix.length > 4) || (suffix.length > 4) || totalChars > 8;

  const handleStart = () => {
    if (isInvalid) return;
    setCopied(false);
    startSearch(prefix, suffix);
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(`Address: ${result.address}\nPrivateKey: ${result.privateKey}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (result) {
      const data = `Address: ${result.address}\nPrivateKey: ${result.privateKey}`;
      const blob = new Blob([data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vanity-wallet-${result.address.substring(0, 6)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);
  const formatTime = (ms: number) => (ms / 1000).toFixed(1) + 's';

  return (
    <main className="max-w-4xl mx-auto p-4 md:p-8 pt-12 md:pt-20">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center p-3 bg-brand-500/10 rounded-2xl mb-4 border border-brand-500/20">
          <ShieldCheck className="w-8 h-8 text-brand-400" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-brand-300 via-brand-100 to-white">
          VanityEngine
        </h1>
        <p className="text-lg text-slate-400 max-w-xl mx-auto">
          High-performance, purely client-side vanity address generator for EVM chains.
        </p>
        <div className="mt-4 flex items-center justify-center space-x-2 text-sm text-green-400 bg-green-400/10 w-fit mx-auto px-4 py-1.5 rounded-full border border-green-400/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span>Runs locally. Your keys never leave your device.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="glass-panel p-6 flex flex-col h-full">
          <h2 className="text-xl font-semibold mb-6 flex items-center">
            <span className="bg-brand-500 w-1.5 h-6 rounded-full mr-3"></span>
            Configuration
          </h2>

          <div className="space-y-5 flex-grow">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Target Chain</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setChain('ethereum')}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    chain === 'ethereum' ? 'bg-brand-600 border-brand-500 text-white shadow-[0_0_15px_rgba(124,58,237,0.3)]' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Ethereum
                </button>
                <button
                  onClick={() => setChain('base')}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    chain === 'base' ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Base
                </button>
              </div>
            </div>

            <HexInput
              label="Prefix"
              value={prefix}
              onChange={setPrefix}
              placeholder="e.g. c0ffee"
              maxLength={4}
              disabled={isSearching}
            />
            
            <HexInput
              label="Suffix"
              value={suffix}
              onChange={setSuffix}
              placeholder="e.g. b0b"
              maxLength={4}
              disabled={isSearching}
            />

            <DifficultyBadge prefix={prefix} suffix={suffix} />
          </div>

          <div className="mt-8 pt-6 border-t border-slate-700/50">
            {isSearching ? (
              <button
                onClick={stopSearch}
                className="w-full flex items-center justify-center space-x-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 py-3.5 rounded-xl font-semibold transition-all group"
              >
                <Square className="w-5 h-5 group-hover:scale-90 transition-transform" />
                <span>Stop Generation</span>
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={isInvalid}
                className="w-full flex items-center justify-center space-x-2 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700 text-white py-3.5 rounded-xl font-semibold transition-all shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] disabled:shadow-none border border-brand-500 group"
              >
                <Play className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                <span>Start Searching</span>
              </button>
            )}
            {totalChars > 8 && (
              <p className="text-red-400 text-xs text-center mt-3">Maximum constraint is 8 characters total.</p>
            )}
            {stats.status === 'stopped' && !result && (
              <p className="text-slate-400 text-xs text-center mt-3">Search stopped by user.</p>
            )}
          </div>
        </div>

          {/* Live Stats Panel */}
          <div className="glass-panel p-6 flex flex-col h-full">
            <h2 className="text-xl font-semibold mb-6 flex items-center">
              <span className="bg-blue-500 w-1.5 h-6 rounded-full mr-3"></span>
              Live Telemetry
            </h2>

            {stats.status === 'error' && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                <strong>Engine Error:</strong> {stats.errorMessage}
              </div>
            )}

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
              <div className="flex items-center text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
                <Activity className="w-4 h-4 mr-2 text-brand-400" />
                Speed
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100">
                {formatNumber(stats.attemptsPerSecond)} <span className="text-sm font-normal text-slate-500 tracking-normal">h/s</span>
              </div>
            </div>
            
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
              <div className="flex items-center text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
                <Cpu className="w-4 h-4 mr-2 text-blue-400" />
                Workers
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100">
                {workerCount} <span className="text-sm font-normal text-slate-500 tracking-normal">threads</span>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 col-span-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-amber-400" />
                  Elapsed Time
                </div>
                <div>Attempts: {formatNumber(stats.totalAttempts)}</div>
              </div>
              <div className="text-3xl font-bold font-mono text-slate-100">
                {formatTime(stats.elapsedMs)}
              </div>
            </div>
          </div>

          {/* Result Area */}
          <div className="flex-grow flex flex-col justify-end">
            {result ? (
              <div className="bg-brand-900/20 border border-brand-500/30 rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-3xl translate-x-10 -translate-y-10"></div>
                
                <h3 className="text-brand-300 font-semibold mb-3 flex items-center">
                  <span className="text-xl mr-2">🎉</span> Match Found!
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Address</div>
                    <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800 font-mono text-sm text-brand-100 break-all">
                      {result.address}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1 flex justify-between">
                      Private Key <span className="text-red-400 text-[10px] uppercase font-bold tracking-wider">Secret</span>
                    </div>
                    <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800 font-mono text-sm text-slate-300 break-all filter blur-[2px] hover:blur-none transition-all duration-300 cursor-help">
                      {result.privateKey}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button onClick={handleCopy} className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors border border-slate-700">
                    <Copy className="w-4 h-4" />
                    <span>{copied ? 'Copied!' : 'Copy Info'}</span>
                  </button>
                  <button onClick={handleDownload} className="flex items-center justify-center space-x-2 bg-brand-600 hover:bg-brand-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-brand-500/20">
                    <Download className="w-4 h-4" />
                    <span>Save .txt</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full border-2 border-dashed border-slate-700/50 rounded-xl flex items-center justify-center text-slate-500 text-sm flex-col p-6 min-h-[220px]">
                {isSearching ? (
                  <>
                    <div className="relative mb-4">
                      <div className="w-12 h-12 border-4 border-slate-800 border-t-brand-500 rounded-full animate-spin"></div>
                    </div>
                    <div className="animate-pulse">Searching the elliptic curve...</div>
                  </>
                ) : (
                  <>
                    <Cpu className="w-8 h-8 mb-3 opacity-50" />
                    <div className="text-center">
                      Configure constraints and<br/>start the engine
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
