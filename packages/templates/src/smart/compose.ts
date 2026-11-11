/**
 * Instant Builder — step 2: turn extracted facts into requirement-form values for a
 * template, fill gaps with prepared text patterns and library photos, and report
 * exactly where every value came from. Deterministic for a given seed.
 */
import { allFields, defaultFeatures } from '../engine';
import type { TemplateDefinition } from '../types';
import type { Analysis, Facts, HoursRow, PricedItem } from './analyse';
import { menuCategory, titleCase } from './analyse';
import { AGENCY_SERVICES, CRM_MODULES, CUISINE_PHRASE, ERP_MODULES, MODULE_LABELS, SAMPLE_MENUS } from './lexicon';

/** Shown in generated text until the customer gives their business name. */
export const NAME_PLACEHOLDER = '[Your business name]';

/** Replace the name placeholder in generated text once the customer types their name. */
export function applyNameToValues(values: Record<string, unknown>, name: string): Record<string, unknown> {
  if (!name.trim()) return values;
  const out = { ...values };
  for (const k of ['tagline', 'description', 'mission']) if (typeof out[k] === 'string') out[k] = (out[k] as string).split(NAME_PLACEHOLDER).join(name.trim());
  return out;
}

export interface StockImage { id: string; url: string; tags: string[]; title?: string }

export type Source = 'description' | 'generated' | 'sample' | 'library' | 'account' | 'template';

export interface Detection {
  /** Form field key the value was written to. */
  field: string;
  label: string;
  /** Human-readable summary of the value. */
  display: string;
  source: Source;
  /** Words from the description that produced it (source = description). */
  evidence?: string;
}

export interface Notice { tone: 'info' | 'warning'; field?: string; message: string }

export interface Draft {
  templateKey: string;
  values: Record<string, unknown>;
  detections: Detection[];
  notices: Notice[];
  /** Sequence shown on the "building" screen — each line is something that really happened. */
  steps: string[];
  imageTags: string[];
}

export interface ComposeOptions {
  seed?: number;
  accountEmail?: string;
  images?: StockImage[];
  now?: Date;
}

// ------------------------------------------------------------------ seeded choice

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = <T>(r: () => number, arr: T[]): T => arr[Math.floor(r() * arr.length) % arr.length];
const fill = (tpl: string, vars: Record<string, string | undefined>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '').replace(/\s+([,.])/g, '$1').replace(/\s{2,}/g, ' ').replace(/\bin\s*([,.])/g, '$1').trim();
const listText = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

// ------------------------------------------------------------------ text patterns

const COPY = {
  restaurant: {
    tagline: {
      withCuisine: ['Authentic {cuisinePhrase} cooking in the heart of {city}', 'Fresh {cuisinePhrase} flavours, made every day', 'Where {city} comes for real {cuisinePhrase} food', '{cuisine} favourites, served with love'],
      plain: ['Fresh food, friendly faces, unforgettable flavours', 'Good food and a warm welcome, every day', 'Made fresh. Served with love.'],
    },
    intro: [
      '{name} is {aCuisine} restaurant in {city}, serving freshly prepared dishes made from quality ingredients.',
      'Welcome to {name} — {aCuisine} kitchen in {city} where every dish is cooked fresh to order.',
      'At {name}, we bring honest {cuisinePhrase} cooking to {city}, made from scratch every single day.',
    ],
    dishes: ['Guests keep coming back for our {dishes}.', 'Our {dishes} are local favourites.', 'Try our {dishes} — you will see why people keep returning.'],
    reservations: ['Book your table online in seconds, or simply drop by.', 'Reserve a table online and we will have it ready for you.'],
    closing: ['Whether it is a quick lunch, a family dinner or a celebration, we would love to host you.', 'Bring your family and friends — there is always a seat for you at our table.'],
    reservationNote: 'Tables are held for 15 minutes after the booking time. For large groups or private events, please call us.',
  },
  business: {
    tagline: ['Trusted {kind} in {city}', 'Quality {kind} services you can rely on', 'Your local {kind} — friendly, fast and professional', 'Professional {kind} services, done right'],
    intro: [
      '{name} is {aKind} in {city} offering {services} with care and attention to detail.',
      'At {name}, we provide {services} for customers across {city}.',
      '{name} is your local {kind}, offering {services} at fair prices.',
    ],
    closing: ['Get in touch today — we are happy to help.', 'Call or message us to book your visit.', 'Visit us or send us a message, and we will take care of the rest.'],
  },
  corporate: {
    tagline: ['Building lasting value since {founded}', 'A trusted partner for businesses in {city} and beyond', 'Reliable solutions. Proven results.', 'Delivering quality and trust since {founded}'],
    intro: [
      '{name} is a {industry} company based in {city}, helping clients with {services}.',
      'Founded in {founded}, {name} has built a reputation for dependable {industry} solutions.',
      '{name} works with organisations across {city} and beyond, providing {services}.',
    ],
    closing: ['We combine experience, integrity and a commitment to quality in everything we do.', 'Our team is focused on long-term relationships and measurable results.'],
    mission: ['To deliver dependable, high-quality solutions that help our clients grow.', 'To create lasting value for our clients, people and communities through integrity and excellence.'],
  },
  agency: {
    tagline: ['We build brands people remember', 'Design, digital and growth for ambitious brands', 'Creative work that moves the numbers', 'Ideas, design and technology under one roof'],
    intro: [
      '{name} is a creative agency in {city} specialising in {services}.',
      '{name} helps brands grow through {services}.',
      '{name} is a team of designers, marketers and developers focused on {services}.',
    ],
    closing: ['From first idea to launch, we partner with you at every step.', 'Tell us about your project and let us make something great together.'],
  },
  portfolio: {
    tagline: ['{role} crafting thoughtful, detailed work', '{role} based in {city}', '{role} creating work that stands out', '{role} — available for new projects'],
    intro: [
      "Hi, I'm {name} — {aRole} based in {city}.",
      "I'm {name}, {aRole} who loves turning ideas into finished work.",
      '{name} is {aRole} working with clients on projects big and small.',
    ],
    closing: ['I enjoy working closely with clients from first sketch to final delivery.', 'Have a project in mind? I would love to hear about it.'],
  },
  workspace: {
    crm: ['{name} CRM workspace for managing {modules}.', 'Central place for the {name} team to manage {modules}.'],
    erp: ['{name} business workspace for {modules}.', 'One system for {name} to manage {modules}.'],
  },
};

// ------------------------------------------------------------------ images

/** Library tags to search, best first, for a template + facts. */
export function imageTagsFor(def: TemplateDefinition, facts: Facts): string[] {
  switch (def.renderer) {
    case 'restaurant': return [...facts.cuisineTags, 'restaurant-interior', 'food-desi', 'food-bbq', 'food-dessert', 'food-cafe'];
    case 'business': return [...(facts.kind?.value.images ?? []), 'business', 'city'];
    case 'corporate': return ['corporate', 'city', 'agency'];
    case 'agency': return ['agency', 'corporate'];
    case 'portfolio': return ['portfolio', 'agency'];
    default: return [];
  }
}

/** Pick a hero + gallery from the library, preferring the earliest tags. Deterministic per seed. */
export function pickImages(library: StockImage[], tags: string[], seed: number, galleryCount = 6): { hero?: StockImage; gallery: StockImage[] } {
  const r = rng(seed);
  const used = new Set<string>();
  const byTag = (t: string) => library.filter((i) => i.tags.includes(t) && !used.has(i.id)).map((i) => ({ i, k: r() })).sort((a, b) => a.k - b.k).map((x) => x.i);
  let hero: StockImage | undefined;
  for (const t of tags) { const c = byTag(t); if (c.length) { hero = c[0]; used.add(hero.id); break; } }
  const gallery: StockImage[] = [];
  // round-robin over the tag list so the gallery mixes dishes / venue
  const pools = tags.map((t) => byTag(t));
  for (let round = 0; gallery.length < galleryCount && round < 12; round++) {
    for (const pool of pools) {
      const next = pool.find((i) => !used.has(i.id));
      if (next && gallery.length < galleryCount) { gallery.push(next); used.add(next.id); }
    }
  }
  return { hero, gallery };
}

export const stockRef = (img: StockImage) => `stock:${img.id}`;

// ------------------------------------------------------------------ compose

function hoursSummary(rows: HoursRow[]): string {
  const open = rows.filter((r) => !r.closed);
  const same = open.every((r) => r.open === open[0]?.open && r.close === open[0]?.close);
  const closed = rows.filter((r) => r.closed).map((r) => r.day.slice(0, 3));
  return (same && open.length ? `${open[0].open}–${open[0].close}${open.length === 7 ? ' daily' : ''}` : `${open.length} days set`) + (closed.length ? `, closed ${closed.join('/')}` : '');
}

export function composeDraft(def: TemplateDefinition, analysis: Analysis, opts: ComposeOptions = {}): Draft {
  const facts = analysis.facts;
  const seed = opts.seed ?? hashSeed(analysis.text);
  const r = rng(seed);
  const values: Record<string, unknown> = {};
  const detections: Detection[] = [];
  const notices: Notice[] = [];
  const steps: string[] = [];
  const fields = allFields(def);
  const has = (key: string) => fields.some((f) => f.key === key);
  const label = (key: string) => fields.find((f) => f.key === key)?.label ?? key;
  const set = (key: string, value: unknown, source: Source, evidence?: string, display?: string) => {
    if (!has(key) || value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return;
    values[key] = value;
    detections.push({ field: key, label: label(key), display: display ?? (Array.isArray(value) ? `${value.length} item(s)` : String(value)), source, evidence });
  };

  const isSite = def.category === 'WEBSITE';
  const renderer = def.renderer;
  const city = facts.city?.value;
  const name = facts.name?.value ?? (renderer === 'portfolio' ? facts.personName?.value : undefined);
  const supported = new Set(def.features.map((f) => f.key));

  // ---- template + identity
  const templateLine = `Detected: ${def.name}` + (analysis.scores[0]?.matched.length ? ` (from "${analysis.scores.find((s) => s.key === def.key)?.matched.slice(0, 3).join('", "') ?? ''}")` : '');
  steps.push('Reading your description', templateLine);

  const nameKey = has('businessName') ? 'businessName' : has('companyName') ? 'companyName' : undefined;
  if (nameKey) {
    if (name) set(nameKey, name, 'description', renderer === 'portfolio' && !facts.name ? facts.personName?.evidence : facts.name?.evidence);
    else notices.push({ tone: 'warning', field: nameKey, message: `We couldn't find your ${renderer === 'portfolio' ? 'name' : 'business name'} — please add it.` });
  }

  // ---- contact
  if (facts.email) set('email', facts.email.value, 'description', facts.email.evidence);
  else if (opts.accountEmail) set('email', opts.accountEmail, 'account', undefined, `${opts.accountEmail} (your account email)`);
  if (facts.phone) set('phone', facts.phone.value, 'description', facts.phone.evidence);
  if (facts.address) set('address', facts.address.value, 'description', facts.address.evidence);
  const contactBits = [facts.email && 'email', facts.phone && 'phone', facts.address && 'address'].filter(Boolean) as string[];
  steps.push(contactBits.length ? `Found your ${listText(contactBits)}` : 'No contact details found — we will ask you for them');

  // ---- features
  let features = defaultFeatures(def).filter((k) => supported.has(k));
  const turnOn = (k: string, evidence?: string) => { if (supported.has(k) && !features.includes(k)) { features.push(k); if (evidence) detections.push({ field: 'features', label: 'Feature', display: def.features.find((f) => f.key === k)!.label, source: 'description', evidence }); } };
  const turnOff = (k: string) => { features = features.filter((x) => x !== k); };
  for (const [k, ev] of Object.entries(facts.featuresOn)) {
    if (supported.has(k)) { if (!['testimonials', 'team', 'stats'].includes(k)) turnOn(k, ev); }
    else if (isSite && ['reservations', 'menu', 'pipelineBoard', 'lowStockAlerts', 'autoInvoice'].includes(k)) {
      notices.push({ tone: 'info', message: `"${ev}" — ${k === 'reservations' ? 'table reservations are' : `"${k}" is`} not part of the ${def.name}. It has been saved in your notes for our team.` });
    }
  }
  for (const k of Object.keys(facts.featuresOff)) if (supported.has(k) && !def.sections.find((s) => s.feature === k)?.required) turnOff(k);
  if (facts.whatsapp && supported.has('whatsapp')) turnOn('whatsapp');
  if (facts.hours && supported.has('hours')) turnOn('hours');
  if (facts.featuresOn.map && facts.address) turnOn('map');

  // ---- template-specific content
  const cur = facts.currency?.value ?? { code: 'USD', symbol: '$' };
  const fmt = (n: number) => (/^[A-Za-z]/.test(cur.symbol) ? `${cur.symbol} ${n.toLocaleString('en-US')}` : `${cur.symbol}${n.toLocaleString('en-US')}`);
  let highlight: string[] = [];
  let servicesForCopy: string[] = [];

  if (renderer === 'restaurant') {
    if (facts.cuisines) set('cuisine', facts.cuisines.value.join(', '), 'description', facts.cuisines.evidence);
    let menu: PricedItem[] = facts.pricedItems.map((p) => ({ ...p.value, category: p.value.category ?? menuCategory(p.value.name) ?? 'Mains' }));
    if (menu.length) {
      set('menu', menu.map(stripUndefined), 'description', facts.pricedItems.slice(0, 3).map((p) => p.evidence).join(' · '), `${menu.length} dish(es) with prices`);
      steps.push(`Building your menu — ${menu.length} dish${menu.length === 1 ? '' : 'es'}`);
    } else if (facts.listedItems?.value.length) {
      menu = facts.listedItems.value.map((n) => ({ name: n, category: menuCategory(n) ?? 'Mains', price: '' }));
      set('menu', menu.map(stripUndefined), 'description', facts.listedItems.evidence, `${menu.length} dish(es) — prices needed`);
      notices.push({ tone: 'warning', field: 'menu', message: 'We found your dishes but no prices. Add a price for each one.' });
      steps.push(`Building your menu — ${menu.length} dishes (prices needed)`);
    } else if (features.includes('menu')) {
      const tag = facts.cuisineTags.find((t) => SAMPLE_MENUS[t]) ?? 'food-desi';
      menu = SAMPLE_MENUS[tag].map(([n, c, d, p]) => ({ name: n, category: c, description: d, price: fmt(cur.code === 'PKR' || cur.code === 'INR' ? p : tag === 'food-desi' || tag === 'food-bbq' ? Math.max(5, Math.round(p / 100)) : p) }));
      set('menu', menu, 'sample', undefined, `${menu.length} sample dishes`);
      notices.push({ tone: 'warning', field: 'menu', message: 'Your menu has sample dishes and prices. Replace them with your real menu before publishing.' });
      steps.push('Adding a sample menu for you to edit');
    }
    highlight = menu.filter((m) => !/^(drinks|breads)$/i.test(m.category ?? '')).slice(0, 3).map((m) => m.name.toLowerCase());
    if (facts.maxGuests) set('maxGuests', facts.maxGuests.value, 'description', facts.maxGuests.evidence);
    if (features.includes('reservations')) set('reservationNote', COPY.restaurant.reservationNote, 'generated');
  }

  if (renderer === 'business' || renderer === 'corporate' || renderer === 'agency') {
    let services: { title: string; price?: string; description?: string }[] = [];
    let src: Source = 'description';
    let ev: string | undefined;
    if (facts.pricedItems.length && renderer !== 'agency') {
      services = facts.pricedItems.map((p) => ({ title: p.value.name, price: p.value.price, description: p.value.description }));
      ev = facts.pricedItems.slice(0, 2).map((p) => p.evidence).join(' · ');
    } else if (renderer === 'agency' && facts.agencyServices) {
      services = facts.agencyServices.value.map((t) => ({ title: t }));
      ev = facts.agencyServices.evidence;
    } else if (facts.listedItems?.value.length) {
      services = facts.listedItems.value.map((t) => ({ title: t }));
      ev = facts.listedItems.evidence;
    } else if (features.includes('services')) {
      src = 'sample';
      const sample = renderer === 'agency' ? AGENCY_SERVICES.slice(0, 4) : renderer === 'business' ? facts.kind?.value.services ?? ['Consultation', 'Standard service', 'Premium package'] : ['Consulting & advisory', 'Project delivery', 'Support & maintenance'];
      services = sample.map((t) => ({ title: t }));
      notices.push({ tone: 'warning', field: 'services', message: 'We added typical services for your type of business. Check they match what you offer.' });
    }
    if (services.length) {
      set('services', services.map(stripUndefined), src, ev, `${services.length} service(s)${src === 'sample' ? ' (suggested)' : ''}`);
      steps.push(src === 'sample' ? 'Suggesting services for your type of business' : `Adding your ${services.length} service${services.length === 1 ? '' : 's'}`);
      servicesForCopy = services.slice(0, 3).map((s) => s.title.toLowerCase());
    }
  }

  if (renderer === 'corporate') {
    if (facts.founded) set('founded', facts.founded.value, 'description', facts.founded.evidence);
    if (facts.stats.length) { set('stats', facts.stats.slice(0, 6).map((s) => s.value), 'description', facts.stats.map((s) => s.evidence).join(' · ')); turnOn('stats'); }
    else turnOff('stats');
    set('mission', pick(r, COPY.corporate.mission), 'generated');
  }

  if (renderer === 'portfolio') {
    if (facts.role) set('role', facts.role.value, 'description', facts.role.evidence);
    if (facts.skills) set('skills', facts.skills.value, 'description', facts.skills.evidence);
    else turnOff('skills');
    if (facts.website && facts.featuresOn.resume) { set('resumeUrl', facts.website.value, 'description', facts.website.evidence); turnOn('resume'); }
  }

  if (facts.featuresOn.testimonials && supported.has('testimonials')) {
    notices.push({ tone: 'info', field: 'testimonials', message: 'Add real customer reviews in the editor to show a testimonials section. We never make up reviews.' });
  }
  if (facts.featuresOn.team && supported.has('team')) {
    notices.push({ tone: 'info', field: 'team', message: 'Add your team members (name, role, photo) in the editor to show the team section.' });
  }

  // ---- hours / whatsapp
  if (facts.hours && has('hours')) { set('hours', facts.hours.value, 'description', facts.hours.evidence, hoursSummary(facts.hours.value)); steps.push('Setting your opening hours'); }
  else if (features.includes('hours')) notices.push({ tone: 'info', field: 'hours', message: 'Opening hours are set to 09:00–18:00. Change them if yours are different.' });
  if (features.includes('whatsapp') && has('whatsapp')) {
    if (facts.whatsapp) set('whatsapp', facts.whatsapp.value, 'description', facts.whatsapp.evidence);
    else if (facts.phone) set('whatsapp', facts.phone.value, 'description', facts.phone.evidence, `${facts.phone.value} (same as phone)`);
  }

  // ---- workspace (CRM / ERP)
  if (!isSite) {
    const optional = def.modules;
    const required = def.requiredModules ?? [];
    const defaults = (def.defaults.modules as string[] | undefined) ?? optional;
    const mentioned = Object.keys(facts.modulesMentioned);
    const chosen = Array.from(new Set([...required, ...defaults, ...mentioned.filter((m) => optional.includes(m))]));
    const family = def.key.startsWith('crm') ? CRM_MODULES : ERP_MODULES;
    const unsupported = mentioned.filter((m) => !optional.includes(m) && family.includes(m));
    const byMention = mentioned.filter((m) => optional.includes(m) && !defaults.includes(m) && !required.includes(m));
    set('modules', chosen, byMention.length ? 'description' : 'template', byMention.map((m) => facts.modulesMentioned[m]).join(' · ') || undefined, chosen.map((m) => MODULE_LABELS[m] ?? m).join(', '));
    for (const m of unsupported) notices.push({ tone: 'warning', message: `You mentioned ${MODULE_LABELS[m]} ("${facts.modulesMentioned[m]}"), which the ${def.name} does not include. Choose a larger plan template if you need it.` });
    steps.push(`Setting up modules: ${chosen.map((m) => MODULE_LABELS[m] ?? m).join(', ')}`);
    const roles = Array.from(new Set(['admin', ...Object.keys(facts.roleWords).filter((k) => def.roles.some((x) => x.key === k))]));
    set('roles', roles, roles.length > 1 ? 'description' : 'template', Object.values(facts.roleWords).slice(0, 3).join(' · ') || undefined, roles.map((k) => def.roles.find((x) => x.key === k)?.name ?? k).join(', '));
    if (roles.length > 1) steps.push(`Creating user roles: ${roles.map((k) => def.roles.find((x) => x.key === k)?.name ?? k).join(', ')}`);
    if (facts.businessType) set('businessType', facts.businessType.value, 'description', facts.businessType.evidence);
    else if (facts.kind) set('businessType', facts.kind.value.businessType, 'description', facts.kind.evidence);
    if (facts.employees) set('employees', facts.employees.value, 'description', facts.employees.evidence);
    if (facts.currency) set('currency', facts.currency.value.code, 'description', facts.currency.evidence);
    if (facts.pipelineStages) set('pipelineStages', facts.pipelineStages.value, 'description', facts.pipelineStages.evidence);
    if (facts.leadSources) set('leadSources', facts.leadSources.value, 'description', facts.leadSources.evidence);
    if (facts.departments) set('departments', facts.departments.value, 'description', facts.departments.evidence);
    // route each sentence to the matching requirement note (ERP)
    const noteFields: [string, RegExp][] = [['inventoryNotes', /inventory|stock|product|warehouse|item/i], ['salesNotes', /\bsales?\b|selling|orders?|customers?/i], ['purchaseNotes', /purchas|supplier|vendor/i], ['accountingNotes', /account|invoice|billing|expense|payment|tax/i], ['hrNotes', /employee|staff|payroll|salar|attendance|\bhr\b/i]];
    const routed: Record<string, string[]> = {};
    for (const sentence of facts.sentences) {
      if (sentence.length < 12) continue;
      const hit = noteFields.find(([key, re]) => has(key) && re.test(sentence));
      if (hit) (routed[hit[0]] ??= []).push(sentence);
    }
    for (const [key, list] of Object.entries(routed)) set(key, list.join(' ').slice(0, 1000), 'description', list[0].slice(0, 80));
    const kindWord = def.key.startsWith('crm') ? 'crm' : 'erp';
    if (name) set('description', fill(pick(r, COPY.workspace[kindWord]), { name, modules: listText(chosen.map((m) => (MODULE_LABELS[m] ?? m).toLowerCase())) }), 'generated');
  }

  // ---- branding
  const themes = def.themes;
  const mood = facts.moods.find((m) => themes.includes(m.value));
  const unsupportedMood = facts.moods.find((m) => !themes.includes(m.value));
  const theme = mood?.value ?? (def.defaults.branding?.theme as string) ?? def.defaultTheme;
  set('theme', theme, mood ? 'description' : 'template', mood?.evidence, titleCase(theme));
  if (!mood && unsupportedMood) notices.push({ tone: 'info', field: 'theme', message: `The "${unsupportedMood.value}" style isn't available for the ${def.name}, so we used "${theme}". You can try the others in the editor.` });
  if (has('layout')) {
    const layouts = def.layoutVariants.map((l) => l.key);
    const layout = facts.wantsLarge && layouts.includes('fullbleed') ? 'fullbleed' : (def.defaults.branding?.layout as string) ?? layouts[0];
    if (layout) set('layout', layout, facts.wantsLarge ? 'description' : 'template', facts.wantsLarge?.evidence, def.layoutVariants.find((l) => l.key === layout)?.label ?? layout);
  }
  if (has('font') && def.defaults.branding?.font) set('font', def.defaults.branding.font as string, 'template');
  if (facts.colours[0]) set('primaryColor', facts.colours[0].value, 'description', facts.colours[0].evidence);
  if (facts.colours[1] && has('accentColor')) set('accentColor', facts.colours[1].value, 'description', facts.colours[1].evidence);
  steps.push(`Applying the ${titleCase(theme)} theme${facts.colours.length ? ' with your colours' : ''}`);

  // ---- images
  const tags = imageTagsFor(def, facts);
  if (isSite && opts.images?.length) {
    const wantGallery = features.includes('gallery') ? (renderer === 'restaurant' ? 6 : 4) : 0;
    const chosen = pickImages(opts.images, tags, seed, wantGallery);
    if (chosen.hero) set('heroImage', stockRef(chosen.hero), 'library', undefined, chosen.hero.title ?? 'Library photo');
    if (chosen.gallery.length) set('gallery', chosen.gallery.map(stockRef), 'library', undefined, `${chosen.gallery.length} library photos`);
    if (chosen.hero || chosen.gallery.length) {
      const what = renderer === 'restaurant' ? (facts.cuisines ? `${facts.cuisines.value[0]} food and dining room` : 'food and dining room') : renderer === 'business' ? (facts.kind?.value.label ?? 'business') : renderer;
      steps.push(`Choosing photos: ${what}`);
      notices.push({ tone: 'info', field: 'heroImage', message: 'Photos come from our library so your site looks complete. Replace them with your own photos any time.' });
    }
  }

  // ---- written copy (tagline + description)
  if (isSite) {
    const cuisine = facts.cuisines?.value[0];
    const kind = facts.kind?.value.label ?? 'business';
    const vars: Record<string, string | undefined> = {
      name: name ?? NAME_PLACEHOLDER, city: city ?? 'your city', cuisine, cuisinePhrase: cuisine ? CUISINE_PHRASE[cuisine] ?? cuisine : 'home-style',
      aCuisine: withArticle(cuisine ? CUISINE_PHRASE[cuisine] ?? cuisine : 'family'), kind, aKind: withArticle(kind), aRole: withArticle((facts.role?.value ?? 'creative professional').toLowerCase()), founded: facts.founded ? String(facts.founded.value) : undefined,
      services: servicesForCopy.length ? listText(servicesForCopy) : renderer === 'agency' ? 'branding, design and digital marketing' : 'quality services',
      industry: facts.businessType?.value.toLowerCase().replace(/ \/.*$/, '') ?? 'professional services',
      role: facts.role?.value ?? 'Designer', roleLower: (facts.role?.value ?? 'creative professional').toLowerCase(), dishes: listText(highlight),
    };
    const cityOk = !!city;
    const pickVariant = (arr: string[]) => {
      const ok = arr.filter((t) => (cityOk || !t.includes('{city}')) && (vars.founded || !t.includes('{founded}')) && (cuisine || !t.includes('{cuisine}')));
      return pick(r, ok.length ? ok : arr);
    };
    if (has('tagline')) {
      if (facts.tagline) set('tagline', facts.tagline.value.slice(0, 120), 'description', facts.tagline.evidence);
      else {
        const pool = renderer === 'restaurant' ? (cuisine ? COPY.restaurant.tagline.withCuisine : COPY.restaurant.tagline.plain) : COPY[renderer as 'business' | 'corporate' | 'agency' | 'portfolio'].tagline;
        set('tagline', fill(pickVariant(pool), vars).slice(0, 120), 'generated');
      }
    }
    if (has('description')) {
      if (facts.about) set('description', facts.about.value.slice(0, 2000), 'description', facts.about.evidence);
      else {
        const parts: string[] = [];
        if (renderer === 'restaurant') {
          parts.push(fill(pickVariant(COPY.restaurant.intro), vars));
          if (highlight.length >= 2) parts.push(fill(pick(r, COPY.restaurant.dishes), vars));
          if (features.includes('reservations')) parts.push(pick(r, COPY.restaurant.reservations));
          parts.push(pick(r, COPY.restaurant.closing));
        } else {
          const c = COPY[renderer as 'business' | 'corporate' | 'agency' | 'portfolio'];
          parts.push(fill(pickVariant(c.intro), vars), pick(r, c.closing));
        }
        set('description', parts.join(' ').replace(/\bin your city\b/g, 'in your area').replace(/\bto your city\b/g, 'to your area'), 'generated', undefined, parts[0]);
      }
    }
    steps.push('Writing your homepage text');
  }

  if (has('features')) {
    values.features = features;
  }
  steps.push('Your preview is ready');
  return { templateKey: def.key, values, detections, notices, steps, imageTags: tags };
}

const withArticle = (w: string) => `${/^[aeiou]/i.test(w) ? 'an' : 'a'} ${w}`;

function stripUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T;
}

