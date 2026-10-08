import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

interface Option {
  id: string;
  name: string;
  [key: string]: any;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    (opt.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleSelect = (optId: string) => {
    onChange(optId);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        onClick={handleToggle}
        className={`w-full px-3 py-2.5 text-xs rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
          disabled 
            ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200' 
            : 'bg-white border-slate-300 hover:border-amber-400 hover:shadow-sm shadow-xs active:scale-[0.99]'
        } ${isOpen ? 'ring-2 ring-amber-500/20 border-amber-500 shadow-lg' : ''}`}
      >
        <span className={`truncate font-semibold ${!selectedOption ? 'text-slate-400' : 'text-slate-900'}`}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-amber-500' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden flex flex-col min-w-[240px] animate-in fade-in zoom-in-95 duration-150">
          <div className="p-3 border-b border-slate-100 flex items-center gap-2.5 bg-slate-50/50">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to filter options..."
              className="w-full bg-transparent border-none focus:outline-none text-xs text-slate-800 font-medium placeholder-slate-400"
            />
            {search && (
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); setSearch(''); }}
                className="p-1 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto py-1.5 custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => handleSelect(opt.id)}
                  className={`px-4 py-2.5 text-xs cursor-pointer transition-all flex items-center justify-between ${
                    value === opt.id
                      ? 'bg-amber-50 text-amber-900 font-bold border-l-4 border-amber-500'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="truncate">{opt.name}</span>
                  {value === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>}
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-xs text-slate-400 text-center flex flex-col items-center gap-2">
                <Search className="w-8 h-8 text-slate-100" />
                <span>No matching results found</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
