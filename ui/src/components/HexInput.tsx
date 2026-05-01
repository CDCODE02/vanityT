import { ChangeEvent } from 'react';

interface HexInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
}

export function HexInput({ label, value, onChange, placeholder, maxLength, disabled }: HexInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toLowerCase();
    
    // Remove "0x" if the user types it, we'll handle it visually or structurally
    if (val.startsWith('0x')) {
      val = val.slice(2);
    }
    
    // Validate hex characters
    if (/^[0-9a-f]*$/.test(val)) {
      if (!maxLength || val.length <= maxLength) {
        onChange(val);
      }
    }
  };

  return (
    <div className="flex flex-col space-y-1.5">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span className="text-slate-500 font-mono text-lg">0x</span>
        </div>
        <input
          type="text"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-lg font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed group-hover:border-slate-600"
          placeholder={placeholder}
          spellCheck={false}
        />
        {value.length > 0 && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-xs text-slate-500">{value.length} chars</span>
          </div>
        )}
      </div>
    </div>
  );
}
