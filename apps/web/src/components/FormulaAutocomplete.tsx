import React, { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FunctionSquare, Database, Hash } from 'lucide-react';

const FUNCTIONS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'WHERE'];

function getCaretCoordinates(element: HTMLTextAreaElement, position: number) {
  const div = document.createElement('div');
  const style = div.style;
  const computed = window.getComputedStyle(element);

  style.whiteSpace = 'pre-wrap';
  style.wordWrap = 'break-word';
  style.position = 'absolute';
  style.visibility = 'hidden';
  
  const properties = [
    'direction', 'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust', 'lineHeight', 'fontFamily',
    'textAlign', 'textTransform', 'textIndent', 'textDecoration', 'letterSpacing', 'wordSpacing',
  ];
  properties.forEach((prop: any) => { style[prop] = computed[prop]; });

  const textBefore = element.value.substring(0, position);
  div.textContent = textBefore;

  const span = document.createElement('span');
  span.textContent = element.value.substring(position) || '.';
  div.appendChild(span);

  document.body.appendChild(div);
  const coordinates = {
    top: span.offsetTop + parseInt(computed.borderTopWidth),
    left: span.offsetLeft + parseInt(computed.borderLeftWidth),
    lineHeight: parseInt(computed.lineHeight) || 20
  };
  document.body.removeChild(div);
  return coordinates;
}

interface DictionaryEntry {
  name: string;
  fields: string[];
}

interface AutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}

export function FormulaAutocomplete({ value, onChange, placeholder, className, rows = 3 }: AutocompleteProps) {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Fetch permitted collections logic
  const { data: dictRes } = useQuery({
    queryKey: ['catalog-dictionary'],
    queryFn: () => fetch('/api/v1/catalog/dictionary', { headers }).then(res => res.json())
  });

  const dictionary: DictionaryEntry[] = dictRes?.data || [];
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState<{ label: string, type: 'function' | 'collection' | 'field', insertText: string }[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [activeWordData, setActiveWordData] = useState({ start: 0, end: 0 });

  const updateSuggestions = (text: string, cursorPosition: number) => {
    // Look backwards from cursor for the current typing sequence
    const textBeforeCursor = text.substring(0, cursorPosition);
    // Regex matches the last contiguous alphanumeric / dot block
    const match = textBeforeCursor.match(/([a-zA-Z0-9_.]+)$/);

    if (!match) {
      setShowOptions(false);
      return;
    }

    const currentWord = match[1];
    const wordStart = cursorPosition - currentWord.length;

    let suggestions: { label: string, type: 'function' | 'collection' | 'field', insertText: string }[] = [];

    if (currentWord.includes('.')) {
      // It's trying to access fields: "collection.fi"
      const parts = currentWord.split('.');
      const collName = parts[0];
      const searchField = parts[1] || '';
      
      const coll = dictionary.find(d => d.name.toLowerCase() === collName.toLowerCase());
      if (coll) {
        suggestions = coll.fields
          .filter(f => f.toLowerCase().includes(searchField.toLowerCase()))
          .map(f => ({ label: f, type: 'field', insertText: `${collName}.${f}` }));
      }
    } else {
      // Suggesting base words: Functions and Collections
      const lowerWord = currentWord.toLowerCase();
      
      const funcMatches = FUNCTIONS
        .filter(f => f.toLowerCase().includes(lowerWord))
        .map(f => ({ label: f, type: 'function' as const, insertText: f }));
        
      const collMatches = dictionary
        .filter(d => d.name.toLowerCase().includes(lowerWord))
        .map(d => ({ label: d.name, type: 'collection' as const, insertText: d.name }));

      suggestions = [...funcMatches, ...collMatches];
    }

    if (suggestions.length > 0) {
      setOptions(suggestions.slice(0, 8)); // Limits to 8
      setSelectedIndex(0);
      setActiveWordData({ start: wordStart, end: cursorPosition });
      
      // Calculate coordinates
      if (textareaRef.current) {
        const coords = getCaretCoordinates(textareaRef.current, cursorPosition);
        // Correct internal scroll adjustments
        setMenuPos({ 
           top: coords.top - textareaRef.current.scrollTop + coords.lineHeight + 5, 
           left: Math.min(coords.left, textareaRef.current.clientWidth - 200) 
        });
      }
      setShowOptions(true);
    } else {
      setShowOptions(false);
    }
  };

  const handleApplySuggestion = (suggestion: any) => {
    const before = value.substring(0, activeWordData.start);
    const after = value.substring(activeWordData.end);
    
    // Add parenthesis for function formatting easily
    const extra = suggestion.type === 'function' && suggestion.label !== 'WHERE' ? '(' : '';
    const newText = before + suggestion.insertText + extra + after;
    
    onChange(newText);
    setShowOptions(false);
    
    // Attempt cursor reposition
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const nextPos = activeWordData.start + suggestion.insertText.length + extra.length;
        textareaRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 0);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);
    updateSuggestions(val, e.target.selectionEnd || 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showOptions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % options.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + options.length) % options.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleApplySuggestion(options[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowOptions(false);
      }
    }
  };

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={(e) => updateSuggestions(value, e.currentTarget.selectionEnd || 0)}
        onBlur={() => setTimeout(() => setShowOptions(false), 200)}
        placeholder={placeholder}
        rows={rows}
        className={className}
        autoComplete="off"
        spellCheck="false"
      />
      
      {showOptions && (
        <div 
          className="absolute z-50 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden py-1 min-w-[200px] animate-in fade-in slide-in-from-top-1 duration-100"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          {options.map((opt, idx) => (
            <div 
              key={idx}
              onClick={() => handleApplySuggestion(opt)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`px-3 py-2 cursor-pointer flex items-center gap-2 text-[13px] border-l-2 transition-colors ${idx === selectedIndex ? 'bg-indigo-50 border-indigo-500' : 'border-transparent hover:bg-slate-50'}`}
            >
              {opt.type === 'function' && <FunctionSquare size={14} className="text-emerald-500 shrink-0" />}
              {opt.type === 'collection' && <Database size={14} className="text-indigo-500 shrink-0" />}
              {opt.type === 'field' && <Hash size={14} className="text-slate-400 shrink-0" />}
              
              <div className="min-w-0 pr-2 flex-1">
                <span className={`font-mono font-bold truncate block ${idx === selectedIndex ? 'text-indigo-900' : 'text-slate-700'}`}>
                  {opt.label}
                </span>
              </div>
              
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider shrink-0">
                {opt.type}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
