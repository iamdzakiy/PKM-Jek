'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { suggestNoteTitles } from '@/app/actions/notes';
import { Textarea } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Textarea biasa (tetap terkirim lewat form) yang menawarkan judul catatan saat mengetik [[. */
export function WikiTextarea({ name, id, defaultValue, rows }: { name: string; id?: string; defaultValue: string; rows: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [active, setActive] = useState(0);

  function detect() {
    const el = ref.current;
    if (!el) return;
    const before = el.value.slice(0, el.selectionStart);
    const m = /\[\[([^[\]|#\n]{0,80})$/.exec(before);
    setQuery(m ? m[1] : null);
  }

  useEffect(() => {
    if (query === null) return setOptions([]);
    let live = true;
    const t = window.setTimeout(() => {
      suggestNoteTitles(query)
        .then((r) => {
          if (!live) return;
          const typed = query.trim();
          setOptions(typed && !r.some((x) => x.toLowerCase() === typed.toLowerCase()) ? [...r, typed] : r);
          setActive(0);
        })
        .catch(() => undefined);
    }, 120);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [query]);

  function pick(title: string) {
    const el = ref.current;
    if (!el || query === null) return;
    const caret = el.selectionStart;
    const start = caret - query.length;
    const closes = el.value.slice(caret, caret + 2) === ']]';
    el.setRangeText(`${title}${closes ? '' : ']]'}`, start, caret, 'end');
    if (closes) el.setSelectionRange(start + title.length + 2, start + title.length + 2);
    setQuery(null);
    el.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (query === null || options.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      pick(options[active]);
    } else if (e.key === 'Escape') {
      setQuery(null);
    }
  }

  return (
    <div className="relative">
      <Textarea ref={ref} id={id} name={name} defaultValue={defaultValue} rows={rows} onInput={detect} onClick={detect} onKeyDown={onKeyDown} onBlur={() => window.setTimeout(() => setQuery(null), 150)} className="font-[inherit]" />
      {query !== null && options.length > 0 && (
        <ul role="listbox" aria-label="Tautkan catatan" className="glass absolute inset-x-2 bottom-2 z-10 max-h-52 overflow-y-auto rounded-xl p-1 shadow-lift">
          {options.map((o, i) => (
            <li key={o} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)} onMouseEnter={() => setActive(i)} className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm', i === active ? 'bg-brand-soft text-ink' : 'text-ink-soft')}>
                <FileText size={14} className="shrink-0 text-ink-faint" />
                <span className="truncate">{o}</span>
                {i === options.length - 1 && query.trim() && o === query.trim() && !options.slice(0, -1).includes(o) && <span className="ml-auto shrink-0 text-[11px] text-ink-faint">baru</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 text-[11px] text-ink-faint">Ketik [[ buat nautin catatan lain.</p>
    </div>
  );
}
