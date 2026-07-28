import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  CSSProperties,
  KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import type { Product } from '../../types/product.types';

export interface ProductDropdownProps {
  rowId: string;
  value: string;
  products: Product[];
  selectedProductIds: Set<string>;
  currentProductId?: string;
  onSelect: (product: Product) => void;
  onChange: (value: string) => void;
}

const MAX_DROPDOWN_WIDTH = 420;
const MIN_DROPDOWN_WIDTH = 260;
const MAX_DROPDOWN_HEIGHT = 210;
const VIEWPORT_GAP = 8;

export default function ProductDropdown({
  rowId,
  value,
  products,
  selectedProductIds,
  currentProductId,
  onSelect,
  onChange,
}: ProductDropdownProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [visibleCount, setVisibleCount] = useState(30);
  const [floatingStyle, setFloatingStyle] =
    useState<CSSProperties>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(30);
    setHighlighted(0);
  }, [value, products.length, currentProductId]);

  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();

    const available = products.filter(
      (product) =>
        !selectedProductIds.has(product.id) ||
        product.id === currentProductId,
    );

    return available
      .filter((product) => {
        if (!query) return true;

        return (
          product.name.toLowerCase().includes(query) ||
          (product.sku || '')
            .toLowerCase()
            .includes(query)
        );
      })
      .sort((first, second) => {
        if (!query) {
          return first.name.localeCompare(second.name);
        }

        const firstStarts = first.name
          .toLowerCase()
          .startsWith(query)
          ? 0
          : 1;

        const secondStarts = second.name
          .toLowerCase()
          .startsWith(query)
          ? 0
          : 1;

        return (
          firstStarts -
            secondStarts ||
          first.name.localeCompare(second.name)
        );
      });
  }, [
    products,
    value,
    selectedProductIds,
    currentProductId,
  ]);

  const visibleItems = filtered.slice(
    0,
    visibleCount,
  );

  const updatePosition = useCallback(() => {
    const container = containerRef.current;

    if (!container) return;

    const rect = container.getBoundingClientRect();

    const width = Math.min(
      MAX_DROPDOWN_WIDTH,
      Math.max(
        MIN_DROPDOWN_WIDTH,
        rect.width,
      ),
    );

    const left = Math.min(
      Math.max(
        VIEWPORT_GAP,
        rect.left,
      ),
      Math.max(
        VIEWPORT_GAP,
        window.innerWidth -
          width -
          VIEWPORT_GAP,
      ),
    );

    const availableBelow =
      window.innerHeight -
      rect.bottom -
      VIEWPORT_GAP;

    const availableAbove =
      rect.top - VIEWPORT_GAP;

    const dropUp =
      availableBelow < 180 &&
      availableAbove > availableBelow;

    const maxHeight = Math.max(
      120,
      Math.min(
        MAX_DROPDOWN_HEIGHT,
        dropUp
          ? availableAbove
          : availableBelow,
      ),
    );

    setFloatingStyle({
      position: 'fixed',
      left,
      width,
      top: dropUp
        ? undefined
        : rect.bottom + 4,
      bottom: dropUp
        ? window.innerHeight -
          rect.top +
          4
        : undefined,
      maxHeight,
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    const handleOutsideClick = (
      event: MouseEvent,
    ) => {
      const target = event.target as Node;

      if (
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener(
      'mousedown',
      handleOutsideClick,
    );

    return () =>
      document.removeEventListener(
        'mousedown',
        handleOutsideClick,
      );
  }, []);

  useEffect(() => {
    if (!open) return;

    updatePosition();

    window.addEventListener(
      'resize',
      updatePosition,
    );

    window.addEventListener(
      'scroll',
      updatePosition,
      true,
    );

    return () => {
      window.removeEventListener(
        'resize',
        updatePosition,
      );

      window.removeEventListener(
        'scroll',
        updatePosition,
        true,
      );
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open || !listRef.current) return;

    const item = listRef.current.children[
      highlighted
    ] as HTMLElement | undefined;

    item?.scrollIntoView({
      block: 'nearest',
    });
  }, [highlighted, open]);

  const selectProduct = (
    product: Product,
  ) => {
    onSelect(product);
    setOpen(false);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (
      !open &&
      (event.key === 'ArrowDown' ||
        event.key === 'Enter')
    ) {
      event.preventDefault();
      setOpen(true);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();

      setHighlighted((current) =>
        Math.min(
          current + 1,
          Math.max(filtered.length - 1, 0),
        ),
      );

      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();

      setHighlighted((current) =>
        Math.max(current - 1, 0),
      );

      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();

      const selected = filtered[highlighted];

      if (selected) {
        selectProduct(selected);
      }

      return;
    }

    if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      data-row-id={rowId}
    >
      <div
        className={`relative flex h-8 items-center border bg-white transition ${
          open
            ? 'border-slate-950 ring-1 ring-slate-950/10'
            : 'border-slate-300 hover:border-slate-500'
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          title={value}
          placeholder="Search product..."
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setHighlighted(0);
          }}
          onFocus={() => {
            setOpen(true);
            setHighlighted(0);
          }}
          onKeyDown={handleKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent px-2 pr-7 text-[13px] font-medium text-slate-950 outline-none placeholder:text-slate-400"
        />

        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setOpen((current) => !current);
            inputRef.current?.focus();
          }}
          className="absolute right-1 inline-flex h-6 w-6 items-center justify-center text-slate-400 transition hover:bg-slate-100 hover:text-slate-950"
          aria-label={
            open
              ? 'Close products'
              : 'Open products'
          }
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${
              open
                ? 'rotate-180 text-slate-950'
                : ''
            }`}
          />
        </button>
      </div>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="overflow-hidden border border-slate-300 bg-white shadow-xl"
            style={floatingStyle}
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <p className="text-xs font-bold text-slate-700">
                  No products found
                </p>
              </div>
            ) : (
              <ul
                ref={listRef}
                className="max-h-[210px] overflow-y-auto overflow-x-hidden overscroll-contain"
                style={{
                  scrollbarWidth: 'thin',
                }}
                onScroll={(event) => {
                  const target =
                    event.currentTarget;

                  const nearBottom =
                    target.scrollHeight -
                      target.scrollTop -
                      target.clientHeight <
                    32;

                  if (
                    nearBottom &&
                    visibleCount <
                      filtered.length
                  ) {
                    setVisibleCount(
                      (current) =>
                        Math.min(
                          current + 30,
                          filtered.length,
                        ),
                    );
                  }
                }}
              >
                {visibleItems.map(
                  (product, index) => (
                    <li
                      key={product.id}
                      title={product.name}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectProduct(product);
                      }}
                      onMouseEnter={() =>
                        setHighlighted(index)
                      }
                      className={`cursor-pointer border-b border-slate-100 px-2.5 py-1.5 last:border-b-0 ${
                        index === highlighted
                          ? 'bg-slate-950 text-white'
                          : 'text-slate-950 hover:bg-slate-100'
                      }`}
                    >
                      <p className="truncate text-[13px] font-medium">
                        {product.name}
                      </p>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}