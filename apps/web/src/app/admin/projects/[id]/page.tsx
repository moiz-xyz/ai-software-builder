'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/form';
import { Alert, Badge, JsonView, Loading, PageHeader, StatusBadge, Tabs } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api, useApi } from '@/lib/api';
import { fmtDate } from '@/lib/utils';

export default function AdminProject() {
  const { id } = useParams<{ id: string }>();
  const { data: p, reload } = useApi<any>(`/admin/projects/${id}`);
  const [tab, setTab] = useState('requirements');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string }>();
  useEffect(() => { if (p) setNotes(p.adminNotes ?? ''); }, [p]);
  useEffect(() => {
    if (p?.status !== 'PUBLISHING') return;
    const t = setInterval(reload, 1500);
    return () => clearInterval(t);
  }, [p?.status, reload]);
  if (!p) return <Loading />;

  const act = async (path: string, body?: unknown, text = 'Done.') => {
    try { await api(`/admin/projects/${id}/${path}`, { method: 'POST', json: body ?? {} }); setMsg({ tone: 'success', text }); reload(); }
    catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); }
  };

  return (
    <>
      <PageHeader
        title={p.name}
        description={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={p.status} /><Badge>{p.category}</Badge> {p.template.name} pinned to v{p.templateVersion.version} (catalog v{p.template.currentVersion?.version}) · config v{p.configVersion}{p.publishedVersion ? ` · live v${p.publishedVersion}` : ''} · owner <Link className="underline" href={`/admin/customers/${p.owner.id}`}>{p.owner.email}</Link></span>}
        actions={
          <>
            <a href={p.urls.previewUrl} target="_blank" rel="noreferrer"><Button variant="outline">Preview</Button></a>
            {p.status === 'PUBLISHED' && <a href={p.urls.liveUrl} target="_blank" rel="noreferrer"><Button variant="outline">Live site</Button></a>}
            {p.status !== 'PUBLISHING' && <Button onClick={() => act('approve', undefined, 'Approved — deployment queued.')}>Approve & publish</Button>}
            {p.status === 'AWAITING_APPROVAL' && <Button variant="outline" onClick={() => { const reason = prompt('What should the customer change?'); if (reason) act('reject', { reason }, 'Changes requested.'); }}>Request changes</Button>}
            {p.status === 'PUBLISHED' && <Button variant="ghost" onClick={() => act('unpublish', undefined, 'Unpublished.')}>Unpublish</Button>}
          </>
        }
      />
      {msg && <Alert tone={msg.tone} className="mb-4">{msg.text}</Alert>}
      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        {p.sourcePrompt && (
          <Card>
            <CardHeader><CardTitle className="text-base">Instant Builder description</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="whitespace-pre-line rounded bg-muted p-3">{p.sourcePrompt}</p>
              <p className="text-xs text-muted-foreground">What the customer typed. Compare it with the requirements below to spot words the builder&apos;s rules missed.</p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader><CardTitle className="text-base">Customer instructions (not auto-applied)</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-line text-sm">{p.customerNotes || <span className="text-muted-foreground">None</span>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Admin notes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            <Button size="sm" variant="outline" onClick={async () => { await api(`/admin/projects/${id}/notes`, { method: 'PATCH', json: { adminNotes: notes } }); setMsg({ tone: 'success', text: 'Notes saved.' }); }}>Save notes</Button>
          </CardContent>
        </Card>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'requirements', label: 'Requirements' }, { key: 'config', label: 'Current config' }, { key: 'published', label: 'Live config' }, { key: 'assets', label: `Assets (${p.assets.length})` }, { key: 'workspace', label: 'Workspace' }, { key: 'deployments', label: 'Deployments' }, { key: 'versions', label: 'Versions' }, { key: 'audit', label: 'Audit' }]} />
      <div className="mt-4">
        {tab === 'requirements' && <JsonView value={p.requirements} />}
        {tab === 'config' && <JsonView value={p.config} />}
        {tab === 'published' && (p.publishedConfig ? <JsonView value={p.publishedConfig} /> : <p className="text-sm text-muted-foreground">Not published yet.</p>)}
        {tab === 'assets' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {p.assets.map((a: any) => (
              <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded border text-xs">
                {a.mimeType.startsWith('image/') ? <img src={a.url} alt="" className="aspect-square w-full object-cover" /> : <div className="flex aspect-square items-center justify-center bg-muted">PDF</div>}
                <div className="truncate p-1">{a.originalName}</div>
              </a>
            ))}
          </div>
        )}
        {tab === 'workspace' && (
          <div className="space-y-4 text-sm">
            <div><strong>Records:</strong> {Object.entries(p.recordCounts).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'none'}</div>
            <div><strong>Roles:</strong> {p.roles.map((r: any) => r.name).join(', ')}</div>
            <Table>
              <THead><TR><TH>Member</TH><TH>Role</TH></TR></THead>
              <TBody>{p.members.map((m: any) => <TR key={m.id}><TD>{m.user.email}</TD><TD>{m.role.name}</TD></TR>)}</TBody>
            </Table>
            <div><strong>Domains:</strong> {p.domains.map((d: any) => `${d.hostname} (${d.verified ? 'verified' : 'pending'}, SSL ${d.sslStatus})`).join(' · ')}</div>
          </div>
        )}
        {tab === 'deployments' && p.deployments.map((d: any) => (
          <Card key={d.id} className="mb-3">
            <CardHeader className="pb-2"><div className="flex items-center gap-2 text-sm"><StatusBadge status={d.status} /> config v{d.configVersion} · {fmtDate(d.createdAt)}</div></CardHeader>
            <CardContent><pre className="overflow-x-auto rounded bg-muted p-3 text-xs">{d.log.join('\n')}</pre></CardContent>
          </Card>
        ))}
        {tab === 'versions' && (
          <Table>
            <THead><TR><TH>Version</TH><TH>Message</TH><TH>Date</TH></TR></THead>
            <TBody>{p.configVersions.map((v: any) => <TR key={v.version}><TD>v{v.version}</TD><TD>{v.message}</TD><TD>{fmtDate(v.createdAt)}</TD></TR>)}</TBody>
          </Table>
        )}
        {tab === 'audit' && (
          <Table>
            <THead><TR><TH>Action</TH><TH>Actor</TH><TH>Details</TH><TH>Date</TH></TR></THead>
            <TBody>{p.logs.map((l: any) => <TR key={l.id}><TD><code>{l.action}</code></TD><TD>{l.actor?.email ?? 'visitor/system'}</TD><TD className="max-w-xs truncate font-mono text-xs">{l.meta ? JSON.stringify(l.meta) : ''}</TD><TD className="whitespace-nowrap">{fmtDate(l.createdAt)}</TD></TR>)}</TBody>
          </Table>
        )}
      </div>
    </>
  );
}
