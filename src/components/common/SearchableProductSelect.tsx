import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import type { Product } from '../../types/product.types';

type Props = {
  value?: string;
  options: Product[];
  selectedIds?: Set<string>;
  placeholder?: string;
  onChange: (product?: Product) => void;
};

export default function SearchableProductSelect({
  value,
  options,
  selectedIds,
  placeholder = 'Select product',
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number } | null>(null);

  const selected = useMemo(() => options.find((p) => p.id === value), [options, value]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) return;
      const target = event.target as Node;
      const clickedInsideTrigger = rootRef.current.contains(target);
      const clickedInsidePanel = panelRef.current?.contains(target) ?? false;
      if (!clickedInsideTrigger && !clickedInsidePanel) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;

    const updatePanelPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 260), 360);
      const maxLeft = Math.max(8, window.innerWidth - width - 8);
      const left = Math.min(Math.max(8, rect.left + window.scrollX), maxLeft + window.scrollX);
      const top = rect.bottom + window.scrollY + 4;
      setPanelStyle({ top, left, width });
    };

    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [open]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rank = (p: Product) => {
      if (!q) return 2;
      const name = (p.name || '').toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      if (name.startsWith(q) || sku.startsWith(q)) return 0;
      if (name.includes(q) || sku.includes(q)) return 1;
      return 3;
    };

    return [...options]
      .filter((p) => {
        if (!q) return true;
        const name = (p.name || '').toLowerCase();
        const sku = (p.sku || '').toLowerCase();
        return name.includes(q) || sku.includes(q);
      })
      .sort((a, b) => {
        const r = rank(a) - rank(b);
        if (r !== 0) return r;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [options, query]);

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white text-left flex items-center justify-between"
      >
        <span className="block min-w-0 flex-1 truncate pr-2">{selected ? selected.name : placeholder}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
      </button>

      {open && panelStyle && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            top: panelStyle.top,
            left: panelStyle.left,
            width: panelStyle.width,
            zIndex: 1200,
          }}
          className="rounded-lg border border-slate-300 bg-white shadow-xl"
        >
          <div className="p-2 border-b border-slate-200">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search product..."
                className="w-full border border-slate-200 rounded-md pl-7 pr-2 py-1.5 text-[11px]"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-auto py-1">
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
              className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50"
            >
              {placeholder}
            </button>
            {filteredOptions.map((p) => {
              const disabled = selectedIds?.has(p.id) && p.id !== value;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(p);
                    setQuery(p.name || '');
                    setOpen(false);
                  }}
                  className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {p.name}
                  {disabled ? ' (Selected)' : ''}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
