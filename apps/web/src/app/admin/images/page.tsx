'use client';
import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Switch } from '@/components/ui/form';
import { Alert, Badge, Loading, PageHeader } from '@/components/ui/misc';
import { api, useApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface StockImage { id: string; url: string; tags: string[]; title: string; creator: string; license: string; sourceUrl: string; active: boolean; size: number }

/** Tags the Instant Builder looks for (see packages/templates/src/smart/compose.ts → imageTagsFor). */
const KNOWN_TAGS = [
  'restaurant-interior', 'food-desi', 'food-bbq', 'food-italian', 'food-cafe', 'food-burger', 'food-chinese', 'food-seafood', 'food-dessert',
  'business', 'business-salon', 'business-barber', 'business-gym', 'business-retail', 'business-bakery', 'business-clinic', 'business-repair',
  'corporate', 'city', 'agency', 'portfolio',
];

export default function ImageLibrary() {
  const [tag, setTag] = useState('');
  const { data, reload } = useApi<{ items: StockImage[]; tags: { tag: string; count: number }[] }>(`/admin/stock-images${tag ? `?tag=${encodeURIComponent(tag)}` : ''}`);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [newTags, setNewTags] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMsg(null);
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', f);
        fd.append('tags', newTags);
        if (title) fd.append('title', title);
        await api('/admin/stock-images', { method: 'POST', body: fd });
      }
      setMsg({ tone: 'success', text: `${files.length} photo(s) added to the library.` });
      setTitle('');
      reload();
    } catch (e) {
      setMsg({ tone: 'error', text: (e as Error).message });
    } finally {
      setBusy(false);
      if (file.current) file.current.value = '';
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    try {
      await api(`/admin/stock-images/${id}`, { method: 'PATCH', json: body });
      reload();
    } catch (e) {
      setMsg({ tone: 'error', text: (e as Error).message });
    }
  }

  if (!data) return <Loading />;
  const counts = Object.fromEntries(data.tags.map((t) => [t.tag, t.count]));
  const allTags = Array.from(new Set([...KNOWN_TAGS, ...data.tags.map((t) => t.tag)]));
  return (
    <>
      <PageHeader title="Image library" description="Photos the Instant Builder picks for new websites by tag. Each project gets its own copy, so editing or removing a photo here never changes an existing customer site." />
      {msg && <Alert tone={msg.tone} className="mb-4">{msg.text}</Alert>}
      <div className="mb-6 rounded-lg border p-4">
        <p className="mb-3 font-medium">Add photos</p>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Field label="Tags" help="Comma separated, e.g. food-desi, restaurant-interior">
            <Input value={newTags} onChange={(e) => setNewTags(e.target.value)} placeholder="food-desi" list="known-tags" />
          </Field>
          <Field label="Title (optional)">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chicken biryani" />
          </Field>
          <Button onClick={() => file.current?.click()} disabled={busy || !newTags.trim()}><Upload className="h-4 w-4" /> {busy ? 'Uploading…' : 'Choose photos'}</Button>
        </div>
        <datalist id="known-tags">{KNOWN_TAGS.map((t) => <option key={t} value={t} />)}</datalist>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => uploadFiles(e.target.files)} />
        <p className="mt-2 text-xs text-muted-foreground">Use photos you own or that are licensed for commercial use (e.g. public domain / CC0). Landscape, at least 1200px wide, under 8 MB.</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <button onClick={() => setTag('')} className={cn('rounded-full border px-2.5 py-1 text-xs', !tag && 'bg-foreground text-background')}>All</button>
        {allTags.map((t) => (
          <button key={t} onClick={() => setTag(t)} className={cn('rounded-full border px-2.5 py-1 text-xs', tag === t && 'bg-foreground text-background', !counts[t] && 'border-dashed text-muted-foreground')}>
            {t} <span className="opacity-60">{counts[t] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {data.items.map((img) => (
          <div key={img.id} className={cn('overflow-hidden rounded-lg border text-xs', !img.active && 'opacity-50')}>
            <a href={img.url} target="_blank" rel="noreferrer"><img src={img.url} alt={img.title} className="aspect-[4/3] w-full object-cover" loading="lazy" /></a>
            <div className="space-y-2 p-2">
              <div className="truncate font-medium" title={img.title}>{img.title || 'Untitled'}</div>
              <div className="flex flex-wrap gap-1">{img.tags.map((t) => <Badge key={t} tone="gray">{t}</Badge>)}</div>
              <Input defaultValue={img.tags.join(', ')} className="h-7 text-xs" onBlur={(e) => { if (e.target.value !== img.tags.join(', ')) patch(img.id, { tags: e.target.value }); }} />
              <div className="truncate text-muted-foreground" title={`${img.license} — ${img.creator}`}>
                {img.license}{img.creator ? ` · ${img.creator}` : ''}{img.sourceUrl && <> · <a className="underline" href={img.sourceUrl} target="_blank" rel="noreferrer">source</a></>}
              </div>
              <div className="flex items-center justify-between">
                <Switch checked={img.active} onChange={(v) => patch(img.id, { active: v })} label={img.active ? 'In use' : 'Hidden'} />
                <Button size="xs" variant="ghost" className="text-destructive" onClick={async () => { if (confirm('Remove this photo from the library? Existing sites keep their copy.')) { await api(`/admin/stock-images/${img.id}`, { method: 'DELETE' }); reload(); } }}>Delete</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {!data.items.length && <p className="py-10 text-center text-sm text-muted-foreground">No photos{tag ? ` tagged “${tag}”` : ''} yet.</p>}
    </>
  );
}
