import type { ProjectConfig, ThemeDef } from '@sf/templates';

/** Branded preview of a CRM / ERP workspace (the real workspace is at /workspace/<id>). */
export function WorkspacePreview({ config, theme, projectId, name }: { config: ProjectConfig; theme: ThemeDef; projectId: string; name: string }) {
  const t = theme.tokens;
  const primary = config.branding.primaryColor || t.primary;
  const top = config.branding.layout === 'topbar';
  const mods = config.modules.map((m) => m.charAt(0).toUpperCase() + m.slice(1));
  const nav = ['Dashboard', ...mods];
  return (
    <div style={{ minHeight: '100vh', background: t.background, color: t.text, fontFamily: `"${config.branding.font}", ui-sans-serif, system-ui`, display: 'flex', flexDirection: top ? 'column' : 'row' }}>
      <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(config.branding.font)}:wght@400;600&display=swap`} />
      <aside style={{ background: primary, color: '#fff', padding: 20, width: top ? 'auto' : 240, display: 'flex', flexDirection: top ? 'row' : 'column', gap: top ? 20 : 8, alignItems: top ? 'center' : 'stretch' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: top ? 0 : 20 }}>
          {config.branding.logo && <img src={config.branding.logo} alt="" style={{ height: 32, background: '#fff', borderRadius: 6, padding: 2 }} />}
          <strong>{config.business.name}</strong>
        </div>
        {nav.map((n, i) => (
          <div key={n} style={{ padding: '8px 12px', borderRadius: 6, background: i === 0 ? 'rgba(255,255,255,.18)' : 'transparent', fontSize: 14 }}>{n}</div>
        ))}
      </aside>
      <main style={{ flex: 1, padding: 32 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>Dashboard</h1>
        <p style={{ color: t.muted }}>Preview of {name}. Sign in to open the live workspace and start adding records.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16, marginTop: 24 }}>
          {mods.map((m) => (
            <div key={m} style={{ background: t.surface, borderRadius: t.radius, padding: 20, borderTop: `3px solid ${config.branding.accentColor || t.accent}` }}>
              <div style={{ color: t.muted, fontSize: 13 }}>{m}</div>
              <div style={{ fontSize: 28, fontWeight: 600 }}>0</div>
            </div>
          ))}
        </div>
        <a href={`/workspace/${projectId}`} style={{ display: 'inline-block', marginTop: 28, background: primary, color: '#fff', padding: '10px 18px', borderRadius: t.radius, textDecoration: 'none' }}>Open workspace →</a>
      </main>
    </div>
  );
}
