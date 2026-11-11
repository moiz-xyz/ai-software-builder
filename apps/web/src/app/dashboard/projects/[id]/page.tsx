'use client';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ExternalLink, Eye, Pencil, Rocket, LayoutDashboard } from 'lucide-react';
import type { TemplateDefinition } from '@sf/templates';
import { PlatformShell, RequireAuth } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/form';
import { Alert, Badge, JsonView, Loading, PageHeader, StatusBadge, Tabs } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api, useApi } from '@/lib/api';
import { fmtDate } from '@/lib/utils';
import { Team } from '@/components/team';

export interface ProjectDetail {
  id: string; name: string; slug: string; category: 'WEBSITE' | 'CRM' | 'ERP'; status: string; config: any; configVersion: number; publishedVersion: number | null;
  requirements: Record<string, unknown>; customerNotes: string | null; rejectionReason: string | null; hasUnpublishedChanges: boolean; createdAt: string;
  template: { key: string; name: string; currentVersion?: { version: string } }; templateVersion: { id: string; version: string; definition: TemplateDefinition };
  urls: { previewUrl: string; liveUrl: string; pathUrl: string; workspaceUrl: string };
  domains: { id: string; hostname: string; type: string; verified: boolean; sslStatus: string; verificationToken: string }[];
  deployments: { id: string; status: string; configVersion: number; createdAt: string; log: string[] }[];
  themes: any[]; modulesInfo: any[]; domainInstructions: { cnameTarget: string; txtPrefix: string };
}

function Versions({ p, reload }: { p: ProjectDetail; reload: () => void }) {
  const { data, reload: r2 } = useApi<{ version: number; message: string; createdAt: string }[]>(`/projects/${p.id}/versions`);
  const restore = async (v: number) => { await api(`/projects/${p.id}/versions/${v}/restore`, { method: 'POST' }); reload(); r2(); };
  return (
    <Table>
      <THead><TR><TH>Version</TH><TH>Change</TH><TH>Date</TH><TH /></TR></THead>
      <TBody>
        {data?.map((v) => (
          <TR key={v.version}>
            <TD>v{v.version} {v.version === p.configVersion && <Badge tone="blue">current</Badge>} {v.version === p.publishedVersion && <Badge tone="green">live</Badge>}</TD>
            <TD>{v.message}</TD>
            <TD className="text-muted-foreground">{fmtDate(v.createdAt)}</TD>
            <TD className="text-right">{v.version !== p.configVersion && <Button size="xs" variant="outline" onClick={() => restore(v.version)}>Restore</Button>}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

function Domains({ p, reload }: { p: ProjectDetail; reload: () => void }) {
  const [host, setHost] = useState('');
  const [msg, setMsg] = useState<{ tone: 'error' | 'success' | 'info'; text: string }>();
  const add = async () => {
    try { await api(`/projects/${p.id}/domains`, { method: 'POST', json: { hostname: host } }); setHost(''); reload(); setMsg(undefined); }
    catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); }
  };
  const verify = async (id: string) => {
    const r = await api<{ verified: boolean; detail: string }>(`/projects/${p.id}/domains/${id}/verify`, { method: 'POST' });
    setMsg({ tone: r.verified ? 'success' : 'info', text: r.detail });
    reload();
  };
  const remove = async (id: string) => { await api(`/projects/${p.id}/domains/${id}`, { method: 'DELETE' }); reload(); };
  return (
    <div className="space-y-4">
      <Table>
        <THead><TR><TH>Domain</TH><TH>Type</TH><TH>DNS</TH><TH>SSL</TH><TH /></TR></THead>
        <TBody>
          {p.domains.map((d) => (
            <TR key={d.id}>
              <TD className="font-mono text-xs">{d.hostname}</TD>
              <TD>{d.type === 'SUBDOMAIN' ? 'Platform subdomain' : 'Custom'}</TD>
              <TD>{d.verified ? <Badge tone="green">verified</Badge> : <Badge tone="amber">pending</Badge>}</TD>
              <TD><StatusBadge status={d.sslStatus} /></TD>
              <TD className="space-x-2 text-right">
                {d.type === 'CUSTOM' && !d.verified && <Button size="xs" variant="outline" onClick={() => verify(d.id)}>Check DNS</Button>}
                {d.type === 'CUSTOM' && <Button size="xs" variant="ghost" onClick={() => remove(d.id)}>Remove</Button>}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {p.domains.filter((d) => d.type === 'CUSTOM' && !d.verified).map((d) => (
        <Alert key={d.id} tone="info">
          <p className="font-medium">To connect {d.hostname}, add these DNS records at your registrar:</p>
          <p className="mt-1 font-mono text-xs">CNAME {d.hostname} → {p.domainInstructions.cnameTarget}</p>
          <p className="font-mono text-xs">TXT {p.domainInstructions.txtPrefix}.{d.hostname} = {d.verificationToken}</p>
          <p className="mt-1 text-xs">Then click “Check DNS”. SSL is issued automatically once verified.</p>
        </Alert>
      ))}
      <div className="flex max-w-lg gap-2">
        <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="www.yourbusiness.com" />
        <Button onClick={add} disabled={!host}>Add domain</Button>
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}

function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const { data: p, loading, reload, error } = useApi<ProjectDetail>(`/projects/${id}`);
  const [tab, setTab] = useState('overview');
  const [msg, setMsg] = useState<{ tone: 'error' | 'success' | 'info'; text: string }>();

  useEffect(() => {
    if (p?.status !== 'PUBLISHING') return;
    const t = setInterval(reload, 1500);
    return () => clearInterval(t);
  }, [p?.status, reload]);

  if (loading && !p) return <Loading />;
  if (error || !p) return <Alert tone="error">{error?.message ?? 'Not found'}</Alert>;

  const approve = async () => {
    try {
      const r = await api<{ status: string; message?: string }>(`/projects/${id}/approve`, { method: 'POST' });
      setMsg({ tone: 'success', text: r.message ?? 'Publishing… this takes a few seconds.' });
      reload();
    } catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); }
  };
  const unpublish = async () => {
    if (!confirm('Take this project offline?')) return;
    await api(`/projects/${id}/unpublish`, { method: 'POST' });
    reload();
  };
  const canPublish = !['PUBLISHING', 'AWAITING_APPROVAL'].includes(p.status) && (p.status !== 'PUBLISHED' || p.hasUnpublishedChanges);
  const tabs = [{ key: 'overview', label: 'Overview' }, { key: 'versions', label: 'Version history' }, { key: 'domains', label: 'Domains' }, { key: 'deployments', label: 'Deployments' }, ...(p.category !== 'WEBSITE' ? [{ key: 'team', label: 'Team & roles' }] : [])];

  return (
    <>
      {params.get('created') && <Alert tone="success" className="mb-6">Your project was created as an independent copy of the {p.template.name} template. Preview it, adjust it in the editor, then approve to publish.</Alert>}
      <PageHeader
        title={p.name}
        description={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={p.status} /> {p.template.name} · template v{p.templateVersion.version} · config v{p.configVersion}{p.publishedVersion ? ` · live v${p.publishedVersion}` : ''}</span>}
        actions={
          <>
            <Link href={`/dashboard/projects/${id}/editor`}><Button variant="outline"><Pencil className="h-4 w-4" /> Edit</Button></Link>
            <a href={p.urls.previewUrl} target="_blank" rel="noreferrer"><Button variant="outline"><Eye className="h-4 w-4" /> Preview</Button></a>
            <Link href={`/workspace/${id}`}><Button variant="outline"><LayoutDashboard className="h-4 w-4" /> {p.category === 'WEBSITE' ? 'Inbox' : 'Workspace'}</Button></Link>
            {canPublish && <Button onClick={approve}><Rocket className="h-4 w-4" /> {p.status === 'PUBLISHED' ? 'Publish changes' : 'Approve & publish'}</Button>}
            {p.status === 'PUBLISHED' && <Button variant="ghost" onClick={unpublish}>Unpublish</Button>}
          </>
        }
      />
      {msg && <Alert tone={msg.tone} className="mb-4">{msg.text}</Alert>}
      {p.status === 'AWAITING_APPROVAL' && <Alert tone="warning" className="mb-4">Waiting for an administrator to review and publish your project.</Alert>}
      {p.status === 'REJECTED' && <Alert tone="error" className="mb-4">Changes requested: {p.rejectionReason}</Alert>}
      {p.hasUnpublishedChanges && p.status === 'PUBLISHED' && <Alert tone="info" className="mb-4">You have saved changes that are not live yet. Click “Publish changes”.</Alert>}

      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <div className="mt-5">
        {tab === 'overview' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Addresses</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Preview: <a className="underline" href={p.urls.previewUrl} target="_blank" rel="noreferrer">{p.urls.previewUrl}</a></p>
                <p>Live: {p.status === 'PUBLISHED' ? <a className="underline" href={p.urls.liveUrl} target="_blank" rel="noreferrer">{p.urls.liveUrl} <ExternalLink className="inline h-3 w-3" /></a> : <span className="text-muted-foreground">{p.urls.liveUrl} (after publishing)</span>}</p>
                {p.status === 'PUBLISHED' && <p>Alternate: <a className="underline" href={p.urls.pathUrl} target="_blank" rel="noreferrer">{p.urls.pathUrl}</a></p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Your instructions</CardTitle></CardHeader>
              <CardContent className="whitespace-pre-line text-sm text-muted-foreground">{p.customerNotes || 'None'}</CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Submitted requirements</CardTitle></CardHeader>
              <CardContent><JsonView value={p.requirements} /></CardContent>
            </Card>
          </div>
        )}
        {tab === 'versions' && <Versions p={p} reload={reload} />}
        {tab === 'domains' && <Domains p={p} reload={reload} />}
        {tab === 'deployments' && (
          <div className="space-y-3">
            {p.deployments.length === 0 && <p className="text-sm text-muted-foreground">No deployments yet.</p>}
            {p.deployments.map((d) => (
              <Card key={d.id}>
                <CardHeader className="pb-2"><div className="flex items-center gap-2"><StatusBadge status={d.status} /><span className="text-sm">config v{d.configVersion} · {fmtDate(d.createdAt)}</span></div></CardHeader>
                <CardContent><pre className="overflow-x-auto rounded bg-muted p-3 text-xs">{d.log.join('\n')}</pre></CardContent>
              </Card>
            ))}
          </div>
        )}
        {tab === 'team' && <Team projectId={p.id} />}
      </div>
    </>
  );
}

export default function Page() {
  return <PlatformShell><RequireAuth><Suspense fallback={<Loading />}><ProjectPage /></Suspense></RequireAuth></PlatformShell>;
}
