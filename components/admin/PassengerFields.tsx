'use client';

import { useState, useRef, useEffect } from 'react';

// ─── RUT ─────────────────────────────────────────────────────────────────────

export function formatRut(raw: string): string {
  const clean = raw.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length === 0) return '';
  const body = clean.slice(0, -1);
  const dv   = clean.slice(-1);
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return body.length > 0 ? `${formatted}-${dv}` : dv;
}

export function validateRut(rut: string): boolean {
  const clean   = rut.replace(/[.\s]/g, '').toUpperCase();
  const dashIdx = clean.lastIndexOf('-');
  if (dashIdx < 1) return false;
  const body = clean.slice(0, dashIdx);
  const dv   = clean.slice(dashIdx + 1);
  if (!/^\d+$/.test(body) || body.length < 6) return false;
  let sum = 0, mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const rem      = sum % 11;
  const expected = rem === 1 ? 'K' : rem === 0 ? '0' : String(11 - rem);
  return dv === expected;
}

export function DocNumberInput({
  idType, value, onChange, onBlur, required, className,
}: {
  idType:     'rut' | 'passport';
  value:      string;
  onChange:   (v: string) => void;
  onBlur?:    React.FocusEventHandler<HTMLInputElement>;
  required?:  boolean;
  className?: string;
}) {
  const isRut = idType === 'rut';

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (isRut) {
      onChange(formatRut(e.target.value));
    } else {
      onChange(e.target.value.toUpperCase());
    }
  }

  const minLen    = isRut ? 8 : 5;
  const showFb    = value.replace(/[^0-9kKa-zA-Z]/g, '').length >= minLen;
  const isValid   = isRut ? validateRut(value) : value.trim().length >= 5;
  const borderCls = showFb
    ? isValid ? 'border-green-300 focus:border-green-400' : 'border-red-300 focus:border-red-400'
    : '';

  return (
    <div className="relative">
      <input
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        placeholder={isRut ? '12.345.678-9' : 'AB1234567'}
        required={required}
        className={`${className ?? ''} ${borderCls} pr-8`}
      />
      {showFb && (
        <span className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-bold pointer-events-none ${
          isValid ? 'text-green-500' : 'text-red-400'
        }`}>
          {isValid ? '✓' : '✗'}
        </span>
      )}
    </div>
  );
}

// ─── Teléfono ─────────────────────────────────────────────────────────────────

export const DIAL_CODES = [
  { dial: '+56',  flag: '🇨🇱', name: 'Chile'           },
  { dial: '+54',  flag: '🇦🇷', name: 'Argentina'       },
  { dial: '+55',  flag: '🇧🇷', name: 'Brasil'          },
  { dial: '+1',   flag: '🇺🇸', name: 'EE.UU. / Canadá' },
  { dial: '+52',  flag: '🇲🇽', name: 'México'          },
  { dial: '+57',  flag: '🇨🇴', name: 'Colombia'        },
  { dial: '+51',  flag: '🇵🇪', name: 'Perú'            },
  { dial: '+591', flag: '🇧🇴', name: 'Bolivia'         },
  { dial: '+593', flag: '🇪🇨', name: 'Ecuador'         },
  { dial: '+598', flag: '🇺🇾', name: 'Uruguay'         },
  { dial: '+595', flag: '🇵🇾', name: 'Paraguay'        },
  { dial: '+58',  flag: '🇻🇪', name: 'Venezuela'       },
  { dial: '+34',  flag: '🇪🇸', name: 'España'          },
  { dial: '+44',  flag: '🇬🇧', name: 'Reino Unido'     },
  { dial: '+33',  flag: '🇫🇷', name: 'Francia'         },
  { dial: '+49',  flag: '🇩🇪', name: 'Alemania'        },
  { dial: '+39',  flag: '🇮🇹', name: 'Italia'          },
  { dial: '+31',  flag: '🇳🇱', name: 'Países Bajos'    },
  { dial: '+351', flag: '🇵🇹', name: 'Portugal'        },
  { dial: '+41',  flag: '🇨🇭', name: 'Suiza'           },
  { dial: '+61',  flag: '🇦🇺', name: 'Australia'       },
  { dial: '+64',  flag: '🇳🇿', name: 'Nueva Zelanda'   },
  { dial: '+81',  flag: '🇯🇵', name: 'Japón'           },
  { dial: '+86',  flag: '🇨🇳', name: 'China'           },
  { dial: '+82',  flag: '🇰🇷', name: 'Corea del Sur'   },
  { dial: '+972', flag: '🇮🇱', name: 'Israel'          },
] as const;

type DialEntry = typeof DIAL_CODES[number];

export function parsePhone(value: string): { dial: string; local: string; flag: string } {
  if (!value) return { dial: '+56', local: '', flag: '🇨🇱' };
  if (value.startsWith('+')) {
    const sorted = [...DIAL_CODES].sort((a, b) => b.dial.length - a.dial.length);
    for (const d of sorted) {
      if (value.startsWith(d.dial)) {
        return { dial: d.dial, local: value.slice(d.dial.length).trimStart(), flag: d.flag };
      }
    }
  }
  return { dial: '+56', local: value, flag: '🇨🇱' };
}

export function PhoneInput({
  value, onChange, required, placeholder,
}: {
  value:        string;
  onChange:     (v: string) => void;
  required?:    boolean;
  placeholder?: string;
}) {
  const parsed                        = parsePhone(value);
  const [dialCode,   setDialCode]     = useState(parsed.dial);
  const [local,      setLocal]        = useState(parsed.local);
  const [dropOpen,   setDropOpen]     = useState(false);
  const [search,     setSearch]       = useState('');
  const [customDial, setCustomDial]   = useState('');
  const containerRef                  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = parsePhone(value);
    setDialCode(p.dial);
    setLocal(p.local);
  }, [value]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleDialSelect(d: DialEntry) {
    setDialCode(d.dial);
    setDropOpen(false);
    setSearch('');
    onChange(local ? `${d.dial} ${local}` : '');
  }

  function handleLocalChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setLocal(v);
    onChange(v ? `${dialCode} ${v}` : '');
  }

  const filtered = search.trim().length === 0
    ? DIAL_CODES
    : DIAL_CODES.filter(d =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.dial.includes(search)
      );

  const selected = DIAL_CODES.find(d => d.dial === dialCode) ?? DIAL_CODES[0];

  return (
    <div ref={containerRef} className="relative flex">
      <button
        type="button"
        onClick={() => { setDropOpen(o => !o); setSearch(''); }}
        className="flex items-center gap-1.5 border border-r-0 border-gray-200 rounded-l-lg px-2.5 py-2 bg-gray-50 hover:bg-gray-100 transition-colors flex-shrink-0"
      >
        <span className="text-base leading-none">{selected.flag}</span>
        <span className="text-xs font-medium text-gray-600">{selected.dial}</span>
        <svg className={`w-3 h-3 text-gray-400 transition-transform ${dropOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <input
        type="tel"
        value={local}
        onChange={handleLocalChange}
        required={required}
        placeholder={placeholder ?? '9 1234 5678'}
        className="border border-gray-200 rounded-r-lg px-3 py-2 text-sm focus:outline-none focus:border-teal w-full min-w-0"
      />
      {dropOpen && (
        <div className="absolute left-0 top-full mt-1 z-30 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar país…"
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-teal"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-xs text-gray-400 px-3 py-2">Sin resultados</p>
            )}
            {filtered.map(d => (
              <button
                key={d.dial}
                type="button"
                onMouseDown={() => handleDialSelect(d)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-teal/5 transition-colors ${
                  d.dial === dialCode ? 'bg-teal/5 font-semibold text-teal' : 'text-gray-700'
                }`}
              >
                <span className="text-base leading-none">{d.flag}</span>
                <span className="flex-1 text-left">{d.name}</span>
                <span className="text-gray-400 font-medium">{d.dial}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100 px-3 py-2 flex items-center gap-2">
            <span className="text-[11px] text-gray-400 flex-shrink-0">Otro:</span>
            <input
              value={customDial}
              onChange={e => setCustomDial(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const normalized = customDial.trim().startsWith('+')
                    ? customDial.trim()
                    : `+${customDial.trim()}`;
                  if (/^\+\d{1,4}$/.test(normalized)) {
                    setDialCode(normalized);
                    onChange(local ? `${normalized} ${local}` : '');
                    setDropOpen(false);
                    setSearch('');
                    setCustomDial('');
                  }
                }
              }}
              placeholder="+376"
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-teal w-20"
            />
            <span className="text-[10px] text-gray-300">Enter para confirmar</span>
          </div>
        </div>
      )}
    </div>
  );
}
