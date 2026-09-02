import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X, MapPin } from 'lucide-react';

export const CAMPUS_VENUES: string[] = [
  'Classroom - 201',
  'Classroom - 202',
  'Classroom - 203',
  'Classroom - 204',
  'Classroom - 301',
  'Classroom - 302',
  'Classroom - 303',
  'Classroom - 304',
  'MILE Audi (2nd Floor)',
  'Seminar Hall (3rd Floor)',
  'HyperBuild Lab',
  'Language Lab',
  'School Auditorium',
];

interface SearchableVenueSelectProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export const SearchableVenueSelect: React.FC<SearchableVenueSelectProps> = ({
  value,
  onChange,
  placeholder = 'Select Venue / Classroom',
  required = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  const filteredVenues = CAMPUS_VENUES.filter((v) =>
    v.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  const handleSelect = (v: string) => {
    onChange(v);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Hidden input for HTML5 required form validation */}
      {required && (
        <input
          type="text"
          value={value || ''}
          onChange={() => {}}
          required
          className="sr-only"
          tabIndex={-1}
        />
      )}

      {/* Main trigger button */}
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 flex items-center justify-between cursor-pointer transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-600 focus-within:ring-2 focus-within:ring-cyan-500/40 focus-within:border-cyan-500 ${
          isOpen ? 'ring-2 ring-cyan-500/40 border-cyan-500 dark:border-cyan-400' : ''
        }`}
      >
        <div className="flex items-center space-x-2 truncate">
          <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
          {value ? (
            <span className="font-medium text-slate-900 dark:text-white truncate">{value}</span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center space-x-1 shrink-0 ml-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-cyan-500' : ''
            }`}
          />
        </div>
      </div>

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-fadeIn">
          {/* Search filter input */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search venue (e.g. 201, Audi, Lab)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredVenues.length > 0) {
                      handleSelect(filteredVenues[0]);
                    } else if (searchTerm.trim()) {
                      handleSelect(searchTerm.trim());
                    }
                  } else if (e.key === 'Escape') {
                    setIsOpen(false);
                  }
                }}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
            {filteredVenues.length === 0 ? (
              <div className="p-3 text-center">
                <p className="text-xs text-slate-400 mb-2">No predefined venue matched</p>
                {searchTerm.trim() && (
                  <button
                    type="button"
                    onClick={() => handleSelect(searchTerm.trim())}
                    className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors text-left"
                  >
                    Use custom: <span className="font-bold">"{searchTerm.trim()}"</span>
                  </button>
                )}
              </div>
            ) : (
              filteredVenues.map((venueName) => {
                const isSelected = value === venueName;
                return (
                  <button
                    key={venueName}
                    type="button"
                    onClick={() => handleSelect(venueName)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors text-left cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <MapPin className={`h-3.5 w-3.5 ${isSelected ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`} />
                      <span>{venueName}</span>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
