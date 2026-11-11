'use client';
/**
 * Renders a customer's website from a master template renderer + the project's config.
 * The renderers are reusable, tested code; customers only change configuration.
 */
import type { ProjectConfig, ThemeDef } from '@sf/templates';
import { Clock, Mail, MapPin, Menu as MenuIcon, MessageCircle, Phone, X } from 'lucide-react';
import { CSSProperties, FormEvent, ReactNode, useState } from 'react';

/** Project id used for Instant Builder previews before the project exists. */
export const DRAFT_PROJECT_ID = '__draft__';

export type Renderer = 'restaurant' | 'corporate' | 'business' | 'agency' | 'portfolio';

export interface SitePayload {
  mode: 'preview' | 'live';
  project: { id: string; name: string; slug: string; category: string };
  template: { key: string; renderer: Renderer | 'workspace'; name: string; sections: { key: string; label: string }[] };
  theme: ThemeDef;
  config: ProjectConfig;
}

type Ctx = { cfg: ProjectConfig; r: Renderer; projectId: string; previewToken?: string; title: (k: string) => string };

const FONT_STACK: Record<string, string> = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'ui-sans-serif, system-ui, sans-serif',
  display: 'Impact, "Arial Black", ui-sans-serif, sans-serif',
  mono: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
};

const C = {
  bg: 'var(--s-bg)', surface: 'var(--s-surface)', text: 'var(--s-text)', muted: 'var(--s-muted)',
  primary: 'var(--s-primary)', secondary: 'var(--s-secondary)', accent: 'var(--s-accent)', radius: 'var(--s-radius)',
};

function Img({ src, alt, className, style, label }: { src?: string; alt: string; className?: string; style?: CSSProperties; label?: string }) {
  if (src) return <img src={src} alt={alt} className={className} style={{ objectFit: 'cover', ...style }} loading="lazy" />;
  return (
    <div className={className} style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.85)', fontWeight: 600, ...style }} aria-label={alt}>
      {label ?? alt.slice(0, 1)}
    </div>
  );
}

function SectionShell({ id, title, subtitle, children, r, alt }: { id: string; title?: string; subtitle?: string; children: ReactNode; r: Renderer; alt?: boolean }) {
  const agency = r === 'agency';
  const centered = r === 'restaurant' || r === 'business';
  return (
    <section id={id} style={{ background: alt ? C.surface : C.bg, padding: agency ? '96px 0' : '72px 0' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 20px' }}>
        {title && (
          <div style={{ textAlign: centered ? 'center' : 'left', marginBottom: 40 }}>
            {r === 'corporate' && <div style={{ width: 48, height: 4, background: C.primary, marginBottom: 14 }} />}
            <h2 className="s-heading" style={{ fontSize: agency ? 'clamp(2.2rem,5vw,4rem)' : 'clamp(1.7rem,3vw,2.4rem)', textTransform: agency ? 'uppercase' : undefined, letterSpacing: agency ? '-0.02em' : undefined, margin: 0, lineHeight: 1.1 }}>
              {title}
            </h2>
            {r === 'restaurant' && <div style={{ width: 60, height: 2, background: C.accent, margin: '16px auto 0' }} />}
            {subtitle && <p style={{ color: C.muted, marginTop: 12, maxWidth: 640, marginInline: centered ? 'auto' : undefined }}>{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ header & hero

function Header({ ctx, overlay }: { ctx: Ctx; overlay: boolean }) {
  const [open, setOpen] = useState(false);
  const { cfg } = ctx;
  const color = overlay ? '#fff' : C.text;
  return (
    <header style={{ position: overlay ? 'absolute' : 'sticky', top: 0, left: 0, right: 0, zIndex: 20, background: overlay ? 'transparent' : C.bg, borderBottom: overlay ? 'none' : `1px solid color-mix(in srgb, ${C.text} 10%, transparent)` }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <a href="#hero" style={{ display: 'flex', alignItems: 'center', gap: 10, color, textDecoration: 'none' }}>
          {cfg.branding.logo && <img src={cfg.branding.logo} alt={`${cfg.business.name} logo`} style={{ height: 40, width: 'auto', maxWidth: 140, objectFit: 'contain' }} />}
          <span className="s-heading" style={{ fontSize: 20, fontWeight: 700 }}>{cfg.business.name}</span>
        </a>
        <nav className="s-desktop-nav" style={{ display: 'flex', gap: 22 }}>
          {cfg.navigation.map((n) => (
            <a key={n.section} href={`#${n.section}`} style={{ color, textDecoration: 'none', fontSize: 15, opacity: 0.9 }}>{n.label}</a>
          ))}
        </nav>
        <button className="s-mobile-toggle" onClick={() => setOpen(!open)} aria-label="Menu" style={{ background: 'none', border: 0, color, display: 'none' }}>
          {open ? <X /> : <MenuIcon />}
        </button>
      </div>
      {open && (
        <nav style={{ background: C.bg, padding: '8px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cfg.navigation.map((n) => (
            <a key={n.section} href={`#${n.section}`} onClick={() => setOpen(false)} style={{ color: C.text, textDecoration: 'none' }}>{n.label}</a>
          ))}
        </nav>
      )}
    </header>
  );
}

function Hero({ ctx }: { ctx: Ctx }) {
  const { cfg, r } = ctx;
  const layout = cfg.branding.layout;
  const cta = cfg.sections.find((s) => s.key === 'reservation' && s.enabled) ? { href: '#reservation', label: 'Book a table' } : { href: '#contact', label: r === 'portfolio' ? 'Work with me' : 'Get in touch' };
  const role = (cfg.content.role as string) || (cfg.content.cuisine as string);
  const big = r === 'agency' || r === 'portfolio';
  const headline = (
    <>
      {role && <p style={{ textTransform: 'uppercase', letterSpacing: '0.18em', fontSize: 13, marginBottom: 14, opacity: 0.85 }}>{role}</p>}
      <h1 className="s-heading" style={{ fontSize: big ? 'clamp(2.6rem,7vw,5.5rem)' : 'clamp(2.2rem,5vw,3.8rem)', lineHeight: 1.05, margin: 0, textTransform: r === 'agency' ? 'uppercase' : undefined }}>
        {cfg.business.tagline || cfg.business.name}
      </h1>
      {cfg.business.tagline && r !== 'agency' && <p style={{ fontSize: 18, marginTop: 10, opacity: 0.9 }}>{cfg.business.name}</p>}
      <p style={{ fontSize: 17, maxWidth: 560, marginTop: 18, opacity: 0.85, lineHeight: 1.6, marginInline: layout === 'centered' || layout === 'fullbleed' ? 'auto' : undefined }}>{(cfg.business.description || '').slice(0, 220)}</p>
      <div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: layout === 'split' ? 'flex-start' : 'center' }}>
        <a href={cta.href} style={{ background: C.primary, color: '#fff', padding: '13px 26px', borderRadius: C.radius, textDecoration: 'none', fontWeight: 600 }}>{cta.label}</a>
        {cfg.sections.some((s) => s.key === 'menu' && s.enabled) && (
          <a href="#menu" style={{ border: '1px solid currentColor', padding: '12px 24px', borderRadius: C.radius, textDecoration: 'none', color: 'inherit', fontWeight: 600 }}>View menu</a>
        )}
      </div>
    </>
  );

  if (layout === 'split') {
    return (
      <section id="hero" style={{ background: C.surface }}>
        <div className="s-split" style={{ maxWidth: 1120, margin: '0 auto', padding: '72px 20px', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 48, alignItems: 'center' }}>
          <div style={{ color: C.text }}>{headline}</div>
          <Img src={cfg.images.hero} alt={cfg.business.name} style={{ width: '100%', aspectRatio: '4/3', borderRadius: C.radius }} />
        </div>
      </section>
    );
  }
  if (layout === 'fullbleed') {
    return (
      <section id="hero" style={{ position: 'relative', minHeight: '88vh', display: 'flex', alignItems: 'center', color: '#fff', overflow: 'hidden' }}>
        <Img src={cfg.images.hero} alt={cfg.business.name} label=" " style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.55), rgba(0,0,0,.35) 50%, rgba(0,0,0,.65))' }} />
        <div style={{ position: 'relative', maxWidth: 900, margin: '0 auto', padding: '120px 20px 80px', textAlign: 'center' }}>{headline}</div>
      </section>
    );
  }
  return (
    <section id="hero" style={{ background: `linear-gradient(160deg, ${C.secondary}, ${C.bg})`, color: C.text }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '96px 20px 72px', textAlign: 'center' }}>
        {headline}
        {cfg.images.hero && <Img src={cfg.images.hero} alt={cfg.business.name} style={{ width: '100%', aspectRatio: '16/7', borderRadius: C.radius, marginTop: 48 }} />}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ sections

const grid = (min: number): CSSProperties => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 24 });
const card: CSSProperties = { background: C.bg, borderRadius: C.radius, padding: 24, border: `1px solid color-mix(in srgb, ${C.text} 10%, transparent)` };

function About({ ctx }: { ctx: Ctx }) {
  const { cfg, r } = ctx;
  const mission = cfg.content.mission as string | undefined;
  const founded = cfg.content.founded as number | undefined;
  return (
    <SectionShell id="about" title={ctx.title('about')} r={r}>
      <div className="s-split" style={{ display: 'grid', gridTemplateColumns: cfg.images.gallery[0] ? '1fr 1fr' : '1fr', gap: 40, alignItems: 'center' }}>
        <div style={{ fontSize: 17, lineHeight: 1.75, color: C.text, whiteSpace: 'pre-line' }}>
          {cfg.business.description}
          {mission && <blockquote style={{ borderLeft: `3px solid ${C.accent}`, paddingLeft: 16, marginTop: 24, color: C.muted, fontStyle: 'italic' }}>{mission}</blockquote>}
          {founded && <p style={{ color: C.muted, marginTop: 16 }}>Since {founded}</p>}
        </div>
        {cfg.images.gallery[0] && <Img src={cfg.images.gallery[0]} alt="About" style={{ width: '100%', aspectRatio: '4/3', borderRadius: C.radius }} />}
      </div>
    </SectionShell>
  );
}

function MenuSection({ ctx }: { ctx: Ctx }) {
  const items = (ctx.cfg.content.menu as { name: string; category?: string; description?: string; price: string; image?: string }[]) ?? [];
  const groups = items.reduce<Record<string, typeof items>>((acc, i) => ((acc[i.category || 'Menu'] ??= []).push(i), acc), {});
  return (
    <SectionShell id="menu" title={ctx.title('menu')} r={ctx.r} alt>
      {items.length === 0 && <p style={{ textAlign: 'center', color: C.muted }}>Menu coming soon.</p>}
      <div className="s-split" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px 56px' }}>
        {Object.entries(groups).map(([cat, list]) => (
          <div key={cat}>
            <h3 className="s-heading" style={{ color: C.primary, fontSize: 22, borderBottom: `1px solid ${C.accent}`, paddingBottom: 8 }}>{cat}</h3>
            {list.map((i, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 14, padding: '14px 0', alignItems: 'flex-start' }}>
                {i.image && <Img src={i.image} alt={i.name} style={{ width: 64, height: 64, borderRadius: C.radius, flexShrink: 0 }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <strong>{i.name}</strong>
                    <span style={{ flex: 1, borderBottom: `1px dotted ${C.muted}`, transform: 'translateY(-4px)' }} />
                    <strong style={{ color: C.primary }}>{i.price}</strong>
                  </div>
                  {i.description && <p style={{ color: C.muted, fontSize: 14, margin: '4px 0 0' }}>{i.description}</p>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function Services({ ctx }: { ctx: Ctx }) {
  const items = (ctx.cfg.content.services as { title: string; description?: string; price?: string }[]) ?? [];
  const r = ctx.r;
  return (
    <SectionShell id="services" title={ctx.title('services')} r={r} alt={r !== 'agency'}>
      {items.length === 0 && <p style={{ color: C.muted }}>Services will be listed here.</p>}
      <div style={grid(r === 'agency' ? 300 : 240)}>
        {items.map((s, i) => (
          <div key={i} style={{ ...card, ...(r === 'agency' ? { background: 'transparent', border: 0, borderTop: `3px solid ${C.text}`, borderRadius: 0, padding: '20px 0' } : {}) }}>
            <div style={{ color: C.accent, fontWeight: 700, fontSize: r === 'agency' ? 14 : 13, marginBottom: 8 }}>{String(i + 1).padStart(2, '0')}</div>
            <h3 className="s-heading" style={{ fontSize: r === 'agency' ? 26 : 20, margin: '0 0 8px' }}>{s.title}</h3>
            {s.description && <p style={{ color: C.muted, lineHeight: 1.6, margin: 0 }}>{s.description}</p>}
            {s.price && <p style={{ color: C.primary, fontWeight: 700, marginTop: 12 }}>{s.price}</p>}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function Stats({ ctx }: { ctx: Ctx }) {
  const items = (ctx.cfg.content.stats as { value: string; label: string }[]) ?? [];
  if (!items.length) return null;
  return (
    <section id="stats" style={{ background: C.primary, color: '#fff', padding: '56px 0' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 20px', ...grid(180), textAlign: 'center' }}>
        {items.map((s, i) => (
          <div key={i}>
            <div className="s-heading" style={{ fontSize: 44, fontWeight: 700 }}>{s.value}</div>
            <div style={{ opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 13 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Team({ ctx }: { ctx: Ctx }) {
  const items = (ctx.cfg.content.team as { name: string; role?: string; photo?: string }[]) ?? [];
  return (
    <SectionShell id="team" title={ctx.title('team')} r={ctx.r}>
      <div style={grid(200)}>
        {items.map((m, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <Img src={m.photo} alt={m.name} style={{ width: '100%', aspectRatio: '1', borderRadius: ctx.r === 'agency' ? 0 : C.radius }} />
            <h3 style={{ margin: '12px 0 2px' }}>{m.name}</h3>
            {m.role && <p style={{ color: C.muted, margin: 0, fontSize: 14 }}>{m.role}</p>}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function Projects({ ctx }: { ctx: Ctx }) {
  const items = (ctx.cfg.content.projects as { title: string; client?: string; description?: string; image?: string; link?: string }[]) ?? [];
  const r = ctx.r;
  return (
    <SectionShell id="projects" title={ctx.title('projects')} r={r} alt={r === 'portfolio'}>
      {items.length === 0 && <p style={{ color: C.muted }}>Projects will appear here.</p>}
      <div style={grid(r === 'agency' ? 420 : 300)}>
        {items.map((p, i) => (
          <a key={i} href={p.link || undefined} target={p.link ? '_blank' : undefined} rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}>
            <Img src={p.image} alt={p.title} style={{ width: '100%', aspectRatio: r === 'agency' ? '16/10' : '4/3', borderRadius: C.radius }} />
            <div style={{ padding: '14px 2px' }}>
              {p.client && <div style={{ color: C.accent, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{p.client}</div>}
              <h3 className="s-heading" style={{ margin: '4px 0', fontSize: r === 'agency' ? 26 : 19 }}>{p.title}</h3>
              {p.description && <p style={{ color: C.muted, margin: 0, lineHeight: 1.55 }}>{p.description}</p>}
            </div>
          </a>
        ))}
      </div>
    </SectionShell>
  );
}

function Process({ ctx }: { ctx: Ctx }) {
  const steps = (ctx.cfg.content.process as string[]) ?? [];
  return (
    <SectionShell id="process" title={ctx.title('process')} r={ctx.r} alt>
      <div style={grid(200)}>
        {steps.map((s, i) => (
          <div key={i}>
            <div className="s-heading" style={{ fontSize: 64, color: C.primary, lineHeight: 1 }}>{i + 1}</div>
            <div style={{ fontSize: 20, fontWeight: 600, marginTop: 8 }}>{s}</div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function Skills({ ctx }: { ctx: Ctx }) {
  const skills = (ctx.cfg.content.skills as string[]) ?? [];
  const resume = ctx.cfg.features.includes('resume') ? (ctx.cfg.content.resumeUrl as string | undefined) : undefined;
  return (
    <SectionShell id="skills" title={ctx.title('skills')} r={ctx.r}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {skills.map((s) => (
          <span key={s} style={{ border: `1px solid ${C.text}`, padding: '8px 16px', borderRadius: 999, fontSize: 15 }}>{s}</span>
        ))}
      </div>
      {resume && (
        <a href={resume} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 28, color: C.primary, fontWeight: 600 }}>Download CV →</a>
      )}
    </SectionShell>
  );
}

function Gallery({ ctx }: { ctx: Ctx }) {
  const imgs = ctx.cfg.images.gallery ?? [];
  return (
    <SectionShell id="gallery" title={ctx.title('gallery')} r={ctx.r} alt={ctx.r === 'restaurant'}>
      {imgs.length === 0 && <p style={{ color: C.muted, textAlign: 'center' }}>Photos coming soon.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {imgs.map((src, i) => (
          <Img key={i} src={src} alt={`Gallery ${i + 1}`} style={{ width: '100%', aspectRatio: i % 3 === 0 ? '1' : '4/3', borderRadius: C.radius }} />
        ))}
      </div>
    </SectionShell>
  );
}

function Testimonials({ ctx }: { ctx: Ctx }) {
  const items = (ctx.cfg.content.testimonials as { name: string; quote: string }[]) ?? [];
  return (
    <SectionShell id="testimonials" title={ctx.title('testimonials')} r={ctx.r} alt>
      <div style={grid(280)}>
        {items.map((t, i) => (
          <figure key={i} style={{ ...card, margin: 0 }}>
            <blockquote style={{ margin: 0, fontSize: 17, lineHeight: 1.6 }}>“{t.quote}”</blockquote>
            <figcaption style={{ marginTop: 14, color: C.muted, fontWeight: 600 }}>— {t.name}</figcaption>
          </figure>
        ))}
      </div>
    </SectionShell>
  );
}

function Hours({ ctx }: { ctx: Ctx }) {
  const hours = ctx.cfg.business.hours ?? [];
  return (
    <SectionShell id="hours" title={ctx.title('hours')} r={ctx.r}>
      <div style={{ maxWidth: 460, margin: '0 auto', ...card }}>
        {hours.map((h) => (
          <div key={h.day} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px dashed color-mix(in srgb, ${C.text} 15%, transparent)` }}>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Clock size={15} /> {h.day}</span>
            <span style={{ color: h.closed ? C.muted : C.text }}>{h.closed ? 'Closed' : `${h.open} – ${h.close}`}</span>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function useSubmit(ctx: Ctx, kind: 'inquiry' | 'reservation') {
  const [state, setState] = useState<{ status: 'idle' | 'sending' | 'done' | 'error'; message?: string }>({ status: 'idle' });
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.guests) (data as Record<string, unknown>).guests = Number(data.guests);
    if (ctx.projectId === DRAFT_PROJECT_ID) {
      setState({ status: 'error', message: 'This is a draft preview — forms start working once your website is created.' });
      return;
    }
    setState({ status: 'sending' });
    const q = ctx.previewToken ? `?preview=${ctx.previewToken}` : '';
    try {
      const res = await fetch(`/api/public/sites/${ctx.projectId}/forms/${kind}${q}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'Something went wrong');
      form.reset();
      setState({ status: 'done' });
    } catch (err) {
      setState({ status: 'error', message: (err as Error).message });
    }
  };
  return { state, submit };
}

const inputStyle: CSSProperties = { width: '100%', padding: '11px 13px', borderRadius: C.radius, border: `1px solid color-mix(in srgb, ${C.text} 20%, transparent)`, background: C.bg, color: C.text, font: 'inherit' };

function Reservation({ ctx }: { ctx: Ctx }) {
  const { state, submit } = useSubmit(ctx, 'reservation');
  const max = Number((ctx.cfg.content.reservation as { maxGuests?: number })?.maxGuests ?? 10);
  const note = (ctx.cfg.content.reservation as { note?: string })?.note;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <SectionShell id="reservation" title={ctx.title('reservation')} subtitle={note} r={ctx.r} alt>
      <form onSubmit={submit} style={{ maxWidth: 620, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="s-form">
        <input name="name" required placeholder="Your name" style={inputStyle} />
        <input name="phone" required placeholder="Phone" style={inputStyle} />
        <input name="email" type="email" placeholder="Email (optional)" style={inputStyle} />
        <input name="guests" type="number" min={1} max={max} defaultValue={2} required style={inputStyle} aria-label="Guests" />
        <input name="date" type="date" min={today} required style={inputStyle} aria-label="Date" />
        <input name="time" type="time" required style={inputStyle} aria-label="Time" />
        <button disabled={state.status === 'sending'} style={{ gridColumn: '1 / -1', background: C.primary, color: '#fff', border: 0, padding: 14, borderRadius: C.radius, fontWeight: 600, cursor: 'pointer' }}>
          {state.status === 'sending' ? 'Sending…' : 'Request reservation'}
        </button>
        {state.status === 'done' && <p style={{ gridColumn: '1 / -1', color: C.primary, textAlign: 'center' }}>Thank you! We will confirm your booking shortly.</p>}
        {state.status === 'error' && <p style={{ gridColumn: '1 / -1', color: '#c0392b', textAlign: 'center' }}>{state.message}</p>}
      </form>
    </SectionShell>
  );
}

function Contact({ ctx }: { ctx: Ctx }) {
  const { cfg } = ctx;
  const { state, submit } = useSubmit(ctx, 'inquiry');
  const b = cfg.business;
  const form = cfg.features.includes('contactForm');
  const map = cfg.features.includes('map') && b.address;
  return (
    <SectionShell id="contact" title={ctx.title('contact')} r={ctx.r}>
      <div className="s-split" style={{ display: 'grid', gridTemplateColumns: form ? '1fr 1.2fr' : '1fr', gap: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 16 }}>
          {b.phone && <a href={`tel:${b.phone}`} style={{ color: C.text, display: 'flex', gap: 10, textDecoration: 'none' }}><Phone size={18} color={C.primary as string} /> {b.phone}</a>}
          {b.email && <a href={`mailto:${b.email}`} style={{ color: C.text, display: 'flex', gap: 10, textDecoration: 'none' }}><Mail size={18} color={C.primary as string} /> {b.email}</a>}
          {b.address && <p style={{ display: 'flex', gap: 10, margin: 0, whiteSpace: 'pre-line' }}><MapPin size={18} color={C.primary as string} style={{ flexShrink: 0 }} /> {b.address}</p>}
          {map && <iframe title="Map" src={`https://maps.google.com/maps?q=${encodeURIComponent(b.address!)}&output=embed`} style={{ border: 0, width: '100%', height: 240, borderRadius: C.radius, marginTop: 8 }} loading="lazy" />}
        </div>
        {form && (
          <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
            <input name="name" required placeholder="Name" style={inputStyle} />
            <input name="email" type="email" placeholder="Email" style={inputStyle} />
            <input name="phone" placeholder="Phone" style={inputStyle} />
            <textarea name="message" required rows={5} placeholder="Message" style={inputStyle} />
            <button disabled={state.status === 'sending'} style={{ background: C.primary, color: '#fff', border: 0, padding: 14, borderRadius: C.radius, fontWeight: 600, cursor: 'pointer' }}>
              {state.status === 'sending' ? 'Sending…' : 'Send message'}
            </button>
            {state.status === 'done' && <p style={{ color: C.primary }}>Thanks — we will get back to you soon.</p>}
            {state.status === 'error' && <p style={{ color: '#c0392b' }}>{state.message}</p>}
          </form>
        )}
      </div>
    </SectionShell>
  );
}

const SECTIONS: Record<string, (p: { ctx: Ctx }) => ReactNode> = {
  about: About, menu: MenuSection, services: Services, stats: Stats, team: Team, projects: Projects,
  process: Process, skills: Skills, gallery: Gallery, testimonials: Testimonials, hours: Hours, reservation: Reservation, contact: Contact,
};

export function SiteRenderer({ payload, previewToken }: { payload: SitePayload; previewToken?: string }) {
  const { config: cfg, theme, template } = payload;
  const r = (template.renderer === 'workspace' ? 'business' : template.renderer) as Renderer;
  const labels = Object.fromEntries(template.sections.map((s) => [s.key, s.label]));
  const ctx: Ctx = {
    cfg, r, projectId: payload.project.id, previewToken,
    title: (k) => cfg.sections.find((s) => s.key === k)?.title || labels[k] || k,
  };
  const t = theme.tokens;
  const vars = {
    '--s-bg': t.background, '--s-surface': t.surface, '--s-text': t.text, '--s-muted': t.muted,
    '--s-primary': cfg.branding.primaryColor || t.primary, '--s-secondary': cfg.branding.secondaryColor || t.secondary, '--s-accent': cfg.branding.accentColor || t.accent,
    '--s-radius': t.radius,
    background: t.background, color: t.text,
    fontFamily: `"${cfg.branding.font}", ${FONT_STACK.sans}`,
    minHeight: '100vh',
  } as CSSProperties;
  const overlay = cfg.branding.layout === 'fullbleed';
  const fontHref = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(cfg.branding.font)}:wght@400;600;700&display=swap`;
  const wa = cfg.features.includes('whatsapp') && cfg.business.whatsapp ? cfg.business.whatsapp.replace(/[^\d]/g, '') : null;

  return (
    <div style={vars} className="s-root">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={fontHref} />
      <style>{`
        .s-root .s-heading { font-family: ${theme.tokens.heading === 'sans' ? `"${cfg.branding.font}", ${FONT_STACK.sans}` : FONT_STACK[theme.tokens.heading]}; font-weight: 700; }
        .s-root a:hover { opacity: .85 }
        @media (max-width: 760px) {
          .s-root .s-split { grid-template-columns: 1fr !important; }
          .s-root .s-form { grid-template-columns: 1fr !important; }
          .s-root .s-desktop-nav { display: none !important; }
          .s-root .s-mobile-toggle { display: block !important; }
        }
      `}</style>
      <div style={{ position: 'relative' }}>
        <Header ctx={ctx} overlay={overlay} />
        <Hero ctx={ctx} />
      </div>
      <main>
        {cfg.sections
          .filter((s) => s.enabled && s.key !== 'hero')
          .map((s) => {
            const Comp = SECTIONS[s.key];
            return Comp ? <Comp key={s.key} ctx={ctx} /> : null;
          })}
      </main>
      <footer style={{ background: r === 'agency' || r === 'portfolio' ? t.text : C.primary, color: '#fff', padding: '28px 20px', textAlign: 'center', fontSize: 14 }}>
        © {new Date().getFullYear()} {cfg.business.name}
      </footer>
      {wa && (
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp" style={{ position: 'fixed', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 999, background: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(0,0,0,.25)', zIndex: 30 }}>
          <MessageCircle />
        </a>
      )}
    </div>
  );
}
