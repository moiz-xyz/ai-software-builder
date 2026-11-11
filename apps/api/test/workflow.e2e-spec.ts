/**
 * End-to-end workflow against a running API (API_URL, default http://localhost:4100)
 * with Postgres, Redis (BullMQ worker) and S3 storage up, and the seed applied.
 *
 *   ADMIN creates/publishes templates → CUSTOMER picks template → fills requirements →
 *   uploads images → backend validates → independent project → preview → approve → published.
 */
import { analyseDescription, composeDraft } from '@sf/templates';

const API = process.env.API_URL || 'http://localhost:4100';
const run = Date.now().toString(36);

type Res = { status: number; body: any };

class Client {
  token?: string;
  async req(method: string, path: string, body?: unknown, raw?: FormData): Promise<Res> {
    const headers: Record<string, string> = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const r = await fetch(API + path, { method, headers, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
    const text = await r.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* not json */ }
    return { status: r.status, body: parsed };
  }
  get = (p: string) => this.req('GET', p);
  post = (p: string, b?: unknown) => this.req('POST', p, b ?? {});
  put = (p: string, b: unknown) => this.req('PUT', p, b);
  patch = (p: string, b: unknown) => this.req('PATCH', p, b);
  del = (p: string) => this.req('DELETE', p);
  async upload(path: string, name: string, type = 'image/png') {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const fd = new FormData();
    fd.append('file', new Blob([png], { type }), name);
    return this.req('POST', path, undefined, fd);
  }
}

async function signup(name: string): Promise<Client> {
  const c = new Client();
  const r = await c.post('/auth/register', { email: `${name}-${run}@test.local`, password: 'Password123!', name });
  expect(r.status).toBe(201);
  c.token = r.body.token;
  return c;
}

async function waitFor<T>(fn: () => Promise<T>, ok: (v: T) => boolean, ms = 20000): Promise<T> {
  const start = Date.now();
  let v = await fn();
  while (!ok(v)) {
    if (Date.now() - start > ms) throw new Error('timeout waiting for condition: ' + JSON.stringify(v).slice(0, 300));
    await new Promise((r) => setTimeout(r, 400));
    v = await fn();
  }
  return v;
}

const restaurantValues = (name: string, extra: Record<string, unknown> = {}) => ({
  businessName: name,
  description: `${name} serves charcoal grills and family platters.`,
  email: 'hello@example.com',
  phone: '+92 300 1234567',
  address: '12 Food Street, Lahore',
  theme: 'warm',
  layout: 'fullbleed',
  features: ['menu', 'hours', 'reservations', 'whatsapp', 'gallery', 'contactForm'],
  whatsapp: '+92 300 7654321',
  menu: [{ name: 'Chicken Tikka', category: 'Grill', price: '1200' }, { name: 'Mint Lemonade', category: 'Drinks', price: '350' }],
  maxGuests: 8,
  ...extra,
});

describe('template-based software factory — full workflow', () => {
  const admin = new Client();
  let a: Client, b: Client;
  let projectA: any, projectB: any;

  beforeAll(async () => {
    const r = await admin.post('/auth/login', { email: process.env.ADMIN_EMAIL || 'admin@factory.local', password: process.env.ADMIN_PASSWORD || 'Admin123!' });
    expect(r.status).toBe(200);
    admin.token = r.body.token;
    a = await signup('alice');
    b = await signup('bob');
    for (const c of [a, b]) {
      const me = await c.get('/auth/me');
      await admin.put(`/admin/subscriptions/${me.body.id}`, { plan: 'PRO', status: 'ACTIVE' });
    }
  });

  it('catalog lists 5 website, 3 CRM and 3 ERP templates and nothing AI-related', async () => {
    const all = await new Client().get('/catalog/templates');
    expect(all.status).toBe(200);
    const count = (c: string) => all.body.filter((t: any) => t.category === c).length;
    expect([count('WEBSITE'), count('CRM'), count('ERP')]).toEqual([5, 3, 3]);
    expect(JSON.stringify(all.body)).not.toMatch(/openai|gemini|anthropic|llm|prompt/i);
    const t = (await new Client().get('/catalog/templates/website-restaurant')).body;
    expect(t.definition.formSchema.length).toBeGreaterThan(3);
    expect(t.unsupportedFeatures.map((f: any) => f.key)).toContain('services');
  });

  it('rejects unsupported features / themes with clear messages', async () => {
    const r = await a.post('/projects', { templateKey: 'website-restaurant', values: restaurantValues('Bad', { features: ['menu', 'projects'], theme: 'bold' }) });
    expect(r.status).toBe(422);
    const codes = r.body.issues.map((i: any) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['unsupported_feature', 'unsupported_theme']));
    expect(r.body.issues.find((i: any) => i.code === 'unsupported_feature').message).toMatch(/not supported by the Restaurant Website template/);
    const live = await new Client().post('/catalog/templates/website-restaurant/validate', { values: { businessName: '' } });
    expect(live.body.valid).toBe(false);
  });

  it('customer A uploads images and gets an independent project', async () => {
    const logo = await a.upload('/assets?kind=logo', 'logo.png');
    const food = await a.upload('/assets', 'food.png');
    expect(logo.status).toBe(201);
    expect(logo.body.ref).toMatch(/^asset:/);
    const r = await a.post('/projects', {
      templateKey: 'website-restaurant',
      values: restaurantValues('Royal Bites', { logo: logo.body.ref, heroImage: food.body.ref, gallery: [food.body.ref] }),
      notes: 'Please make the menu look premium.',
    });
    expect(r.status).toBe(201);
    projectA = r.body;
    expect(projectA.status).toBe('PREVIEW_READY');
    expect(projectA.config.business.name).toBe('Royal Bites');
    expect(projectA.config.branding.logo).toMatch(new RegExp(`^/api/files/projects/${projectA.id}/`));
    expect(projectA.config.images.gallery[0]).toMatch(new RegExp(`^/api/files/projects/${projectA.id}/`));
    const file = await fetch(API + projectA.config.branding.logo.replace('/api', ''));
    expect(file.status).toBe(200);
    expect(projectA.urls.previewUrl).toContain('/preview/');
    expect(projectA.customerNotes).toBe('Please make the menu look premium.');
  });

  it('customer B gets a different project from the same template', async () => {
    const r = await b.post('/projects', { templateKey: 'website-restaurant', values: restaurantValues('Food House', { theme: 'midnight', layout: 'split', features: ['menu', 'contactForm'] }) });
    expect(r.status).toBe(201);
    projectB = r.body;
    expect(projectB.slug).not.toBe(projectA.slug);
    expect(projectB.config.branding.theme).toBe('midnight');
    expect(projectA.templateVersion.id).toBe(projectB.templateVersion.id);
  });

  it('isolates customers from each other', async () => {
    expect((await b.get(`/projects/${projectA.id}`)).status).toBe(404);
    expect((await b.put(`/projects/${projectA.id}/config`, { config: projectB.config })).status).toBe(404);
    expect((await b.get(`/projects/${projectA.id}/workspace/records/inquiry`)).status).toBe(404);
    expect((await b.upload(`/assets?projectId=${projectA.id}`, 'x.png')).status).toBe(404);
    const list = await b.get('/projects');
    expect(list.body.map((p: any) => p.id)).toEqual([projectB.id]);
    expect((await b.get('/admin/projects')).status).toBe(403);
  });

  it('editor saves validated changes with version history, undo and restore', async () => {
    const cfg = JSON.parse(JSON.stringify(projectA.config));
    cfg.business.name = 'Royal Bites Grill';
    cfg.branding.primaryColor = '#aa2200';
    cfg.sections = cfg.sections.map((s: any) => (s.key === 'about' ? { ...s, enabled: false } : s));
    const saved = await a.put(`/projects/${projectA.id}/config`, { config: cfg, baseVersion: 1, message: 'Rename' });
    expect(saved.status).toBe(200);
    expect(saved.body.configVersion).toBe(2);
    expect(saved.body.config.navigation.map((n: any) => n.section)).not.toContain('about');

    const stale = await a.put(`/projects/${projectA.id}/config`, { config: cfg, baseVersion: 1 });
    expect(stale.status).toBe(409);

    const bad = JSON.parse(JSON.stringify(cfg));
    bad.branding.theme = 'bold';
    bad.sections = bad.sections.map((s: any) => (s.key === 'testimonials' ? { ...s, enabled: true } : s));
    const rejected = await a.put(`/projects/${projectA.id}/config`, { config: bad });
    expect(rejected.status).toBe(422);
    expect(rejected.body.issues.map((i: any) => i.code)).toEqual(expect.arrayContaining(['unsupported_theme', 'missing_dependency']));

    const foreign = JSON.parse(JSON.stringify(cfg));
    foreign.images.hero = `/api/files/projects/${projectB.id}/stolen.png`;
    expect((await a.put(`/projects/${projectA.id}/config`, { config: foreign })).status).toBe(422);

    const undo = await a.post(`/projects/${projectA.id}/undo`);
    expect(undo.body.configVersion).toBe(3);
    expect(undo.body.config.business.name).toBe('Royal Bites');
    const restored = await a.post(`/projects/${projectA.id}/versions/2/restore`);
    expect(restored.body.config.business.name).toBe('Royal Bites Grill');
    const versions = await a.get(`/projects/${projectA.id}/versions`);
    expect(versions.body.map((v: any) => v.version)).toEqual([4, 3, 2, 1]);
  });

  it('preview renders the draft config via an unguessable token', async () => {
    const token = projectA.urls.previewUrl.split('/preview/')[1];
    const p = await new Client().get(`/public/preview/${token}`);
    expect(p.status).toBe(200);
    expect(p.body.template.renderer).toBe('restaurant');
    expect(p.body.config.business.name).toBe('Royal Bites Grill');
    expect((await new Client().get(`/public/sites/resolve?slug=${projectA.slug}`)).status).toBe(404);
  });

  it('customer approves → BullMQ deployment publishes the site', async () => {
    const r = await a.post(`/projects/${projectA.id}/approve`);
    expect(r.status).toBe(201);
    const p = await waitFor(() => a.get(`/projects/${projectA.id}`), (x) => x.body.status === 'PUBLISHED');
    expect(p.body.publishedVersion).toBe(4);
    const host = `${projectA.slug}.${process.env.ROOT_DOMAIN || 'localtest.me'}`;
    const site = await new Client().get(`/public/sites/resolve?host=${host}`);
    expect(site.status).toBe(200);
    expect(site.body.config.business.name).toBe('Royal Bites Grill');
    const deps = await a.get(`/projects/${projectA.id}/deployments`);
    expect(deps.body[0].status).toBe('SUCCEEDED');
  });

  it('edits after publishing do not change the live site until republished', async () => {
    const p = (await a.get(`/projects/${projectA.id}`)).body;
    const cfg = { ...p.config, business: { ...p.config.business, tagline: 'Draft only' } };
    expect((await a.put(`/projects/${projectA.id}/config`, { config: cfg })).status).toBe(200);
    const site = await new Client().get(`/public/sites/resolve?slug=${projectA.slug}`);
    expect(site.body.config.business.tagline).toBeUndefined();
    expect((await a.get(`/projects/${projectA.id}`)).body.hasUnpublishedChanges).toBe(true);
  });

  it('website visitors can book a table; the booking lands only in A’s workspace', async () => {
    const date = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
    const ok = await new Client().post(`/public/sites/${projectA.id}/forms/reservation`, { name: 'Sara', phone: '+92 301 0000000', date, time: '19:30', guests: 4 });
    expect(ok.status).toBe(201);
    const tooMany = await new Client().post(`/public/sites/${projectA.id}/forms/reservation`, { name: 'Big', phone: '+92 301 0000000', date, time: '19:30', guests: 30 });
    expect(tooMany.status).toBe(400);
    const notPublished = await new Client().post(`/public/sites/${projectB.id}/forms/inquiry`, { name: 'X', message: 'hi' });
    expect(notPublished.status).toBe(403);
    const list = await a.get(`/projects/${projectA.id}/workspace/records/reservation`);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].data.status).toBe('Pending');
  });

  it('master template is unchanged and new template versions do not affect existing projects', async () => {
    const templates = (await admin.get('/admin/templates')).body;
    const t = templates.find((x: any) => x.key === 'website-restaurant');
    const detail = (await admin.get(`/admin/templates/${t.id}`)).body;
    expect(JSON.stringify(detail.draft)).not.toContain('Royal Bites');
    expect(JSON.stringify(detail.currentVersion.definition)).not.toContain('Royal Bites');

    const key = `website-bakery-${run}`;
    const dup = await admin.post(`/admin/templates/${t.id}/duplicate`, { key, name: 'Bakery Website' });
    expect(dup.status).toBe(201);
    const draft = (await admin.get(`/admin/templates/${dup.body.id}`)).body.draft;
    draft.description = 'Bakery template';
    draft.themes = ['warm', 'fresh'];
    draft.defaultTheme = 'fresh';
    expect((await admin.put(`/admin/templates/${dup.body.id}`, draft)).status).toBe(200);
    expect((await admin.put(`/admin/templates/${dup.body.id}`, { ...draft, themes: ['nope'] })).status).toBe(422);
    expect((await new Client().get(`/catalog/templates/${key}`)).status).toBe(404);
    const pub = await admin.post(`/admin/templates/${dup.body.id}/publish`, { bump: 'major', changelog: 'First' });
    expect(pub.body.currentVersion.version).toBe('1.0.0');
    expect((await new Client().get(`/catalog/templates/${key}`)).status).toBe(200);
    await admin.post(`/admin/templates/${dup.body.id}/unpublish`);
    expect((await new Client().get(`/catalog/templates/${key}`)).status).toBe(404);
    expect((await admin.del(`/admin/templates/${dup.body.id}`)).status).toBe(200);

    const pinned = projectA.templateVersion.version;
    const r1 = await admin.post(`/admin/templates/${t.id}/publish`, { bump: 'patch', changelog: 'test bump' });
    expect(r1.body.currentVersion.version).not.toBe(pinned);
    expect((await a.get(`/projects/${projectA.id}`)).body.templateVersion.version).toBe(pinned);
    // Roll the catalog back to what was current before this test.
    await admin.post(`/admin/templates/${t.id}/versions/${detail.currentVersion.id}/make-current`);
  });

  let crm: any;
  it('CRM: provisions an isolated workspace with modules, roles and lead conversion', async () => {
    const r = await a.post('/projects', {
      templateKey: 'crm-sales',
      values: { companyName: 'Acme Sales', businessType: 'Retail', employees: 25, email: 'ops@acme.test', theme: 'modern', layout: 'sidebar', modules: ['contacts', 'deals', 'leads', 'tasks'], roles: ['sales_rep'], pipelineStages: ['Prospect', 'Demo', 'Won', 'Lost'], features: ['pipelineBoard', 'leadConversion', 'dashboard'] },
    });
    expect(r.status).toBe(201);
    crm = r.body;
    expect(crm.config.roles.map((x: any) => x.key)).toEqual(['admin', 'sales_rep']);
    const meta = await a.get(`/projects/${crm.id}/workspace/meta`);
    expect(meta.body.entities.map((e: any) => e.key)).toEqual(expect.arrayContaining(['contact', 'company', 'deal', 'lead', 'task']));
    expect(meta.body.entities.find((e: any) => e.key === 'deal').fields.find((f: any) => f.key === 'stage').options).toEqual(['Prospect', 'Demo', 'Won', 'Lost']);

    expect((await a.post(`/projects/${crm.id}/workspace/records/deal`, { title: 'X', stage: 'Negotiation' })).status).toBe(400);
    const lead = await a.post(`/projects/${crm.id}/workspace/records/lead`, { name: 'Lena Lead', email: 'lena@x.io', source: 'Website' });
    expect(lead.status).toBe(201);
    const conv = await a.post(`/projects/${crm.id}/workspace/leads/${lead.body.id}/convert`, { createDeal: true });
    expect(conv.status).toBe(201);
    expect(conv.body.deal.data.stage).toBe('Prospect');
    expect(conv.body.deal.data.contact).toBe(conv.body.contact.id);

    // Relations pointing outside the project are rejected.
    expect((await a.post(`/projects/${crm.id}/workspace/records/deal`, { title: 'Y', stage: 'Demo', contact: projectA.id })).status).toBe(400);

    const add = await a.post(`/projects/${crm.id}/members`, { email: `rep-${run}@test.local`, name: 'Rep', roleKey: 'sales_rep' });
    expect(add.status).toBe(201);
    const rep = new Client();
    rep.token = (await rep.post('/auth/login', { email: `rep-${run}@test.local`, password: add.body.tempPassword })).body.token;
    expect((await rep.get(`/projects/${crm.id}/workspace/records/deal`)).status).toBe(200);
    expect((await rep.put(`/projects/${crm.id}/config`, { config: crm.config })).status).toBe(403);
    expect((await rep.get(`/projects/${crm.id}/members`)).status).toBe(403);
    expect((await rep.get(`/projects/${projectA.id}`)).status).toBe(404);
    expect((await b.get(`/projects/${crm.id}/workspace/records/contact`)).status).toBe(404);
  });

  it('ERP: stock moves automatically on purchase receipt and sales fulfilment', async () => {
    const r = await a.post('/projects', {
      templateKey: 'erp-business',
      values: { companyName: 'Shop Co', businessType: 'Retail', employees: 8, email: 'erp@shop.test', currency: 'PKR', theme: 'classic', layout: 'sidebar', modules: ['inventory', 'sales', 'purchases', 'accounting', 'hr'], roles: ['manager', 'accountant'], features: ['dashboard', 'lowStockAlerts', 'autoStockOnSale', 'autoStockOnPurchase', 'autoInvoice'] },
    });
    expect(r.status).toBe(201);
    const id = r.body.id;
    const W = `/projects/${id}/workspace/records`;
    const product = (await a.post(`${W}/product`, { sku: 'TEA-1', name: 'Green tea', price: 500, cost: 300, quantity: 0, reorderLevel: 5 })).body;
    const supplier = (await a.post(`${W}/supplier`, { name: 'Tea Farms' })).body;
    const customer = (await a.post(`${W}/customer`, { name: 'Walk-in' })).body;

    const po = (await a.post(`${W}/purchaseOrder`, { number: 'PO-1', supplier: supplier.id, product: product.id, quantity: 20, unitCost: 300, status: 'Ordered' })).body;
    expect(po.data.total).toBe(6000);
    expect((await a.patch(`${W}/purchaseOrder/${po.id}`, { status: 'Received' })).status).toBe(200);
    expect((await a.get(`${W}/product/${product.id}`)).body.data.quantity).toBe(20);

    const so = (await a.post(`${W}/salesOrder`, { number: 'SO-1', customer: customer.id, product: product.id, quantity: 17, unitPrice: 500 })).body;
    expect((await a.patch(`${W}/salesOrder/${so.id}`, { status: 'Fulfilled' })).status).toBe(200);
    expect((await a.get(`${W}/product/${product.id}`)).body.data.quantity).toBe(3);

    const tooMuch = (await a.post(`${W}/salesOrder`, { number: 'SO-2', customer: customer.id, product: product.id, quantity: 10, unitPrice: 500 })).body;
    expect((await a.patch(`${W}/salesOrder/${tooMuch.id}`, { status: 'Fulfilled' })).status).toBe(400);
    expect((await a.get(`${W}/product/${product.id}`)).body.data.quantity).toBe(3);

    const invoices = (await a.get(`${W}/invoice`)).body;
    expect(invoices.items[0].data).toMatchObject({ number: 'INV-SO-1', amount: 8500 });
    const dash = (await a.get(`/projects/${id}/workspace/dashboard`)).body;
    expect(dash.inventory.lowStock.map((p: any) => p.sku)).toEqual(['TEA-1']);
    expect(dash.sales.fulfilledTotal).toBe(8500);
    expect(dash.currency).toBe('PKR');
    expect((await a.get(`${W}/stockMovement`)).body.total).toBe(2);
    expect((await a.del(`${W}/product/${product.id}`)).status).toBe(400); // referenced by orders
  });

  it('admin can inspect requirements, approve, unpublish and read audit logs', async () => {
    const p = (await admin.get(`/admin/projects/${projectA.id}`)).body;
    expect(p.requirements.businessName).toBe('Royal Bites');
    expect(p.customerNotes).toBe('Please make the menu look premium.');
    expect(p.assets.length).toBeGreaterThanOrEqual(2);
    expect(p.logs.map((l: any) => l.action)).toEqual(expect.arrayContaining(['project.create', 'project.published']));
    await admin.post(`/admin/projects/${projectA.id}/unpublish`);
    expect((await new Client().get(`/public/sites/resolve?slug=${projectA.slug}`)).status).toBe(404);
    await admin.post(`/admin/projects/${projectA.id}/approve`);
    await waitFor(() => admin.get(`/admin/projects/${projectA.id}`), (x) => x.body.status === 'PUBLISHED');
    expect((await new Client().get(`/public/sites/resolve?slug=${projectA.slug}`)).body.config.business.tagline).toBe('Draft only');
    const stats = (await admin.get('/admin/stats')).body;
    expect(stats.projects).toBeGreaterThanOrEqual(4);
    expect((await admin.get('/admin/audit-logs')).body.length).toBeGreaterThan(5);
  });

  it('instant builder: description → rule-based draft → project with its own copies of library photos', async () => {
    const tag = `e2e-${run}`;
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const form = () => { const fd = new FormData(); fd.append('file', new Blob([png], { type: 'image/png' }), 'dish.png'); fd.append('tags', `${tag}, food-desi`); fd.append('title', 'E2E dish'); return fd; };
    const img = (await admin.req('POST', '/admin/stock-images', undefined, form())).body;
    expect(img.tags).toEqual([tag, 'food-desi']);
    const c = await signup('builder');
    expect((await c.req('POST', '/admin/stock-images', undefined, form())).status).toBe(403);
    expect((await new Client().get(`/stock-images?tags=${tag}`)).body.map((x: any) => x.id)).toEqual([img.id]);

    // The browser runs exactly this rule engine; no AI or external service is involved.
    const text = `I have a Desi restaurant called Builder Bites ${run} in Gulberg Lahore. Phone 0300 1234567, email bb@example.com. Open 12pm to 11pm daily. Table booking please. Menu: Chicken Karahi Rs 1,650, Biryani Rs 1100`;
    const def = (await c.get('/catalog/templates/website-restaurant')).body.definition;
    const analysis = analyseDescription(text, undefined);
    expect(analysis.templateKey).toBe('website-restaurant');
    const draft = composeDraft(def, analysis, { images: [{ id: img.id, url: img.url, tags: ['food-desi'] }] });
    expect(draft.values.heroImage).toBe(`stock:${img.id}`);
    const res = await c.post('/projects', { templateKey: 'website-restaurant', values: draft.values, prompt: text });
    expect(res.status).toBe(201);
    const cfg = res.body.config;
    expect(cfg.business).toMatchObject({ name: `Builder Bites ${run}`, phone: '0300 1234567', email: 'bb@example.com' });
    expect(cfg.content.menu.map((m: any) => m.price)).toEqual(['Rs 1,650', 'Rs 1,100']);
    expect(cfg.features).toContain('reservations');
    expect(cfg.images.hero).toMatch(new RegExp(`^/api/files/projects/${res.body.id}/`));
    expect((await admin.get(`/admin/projects/${res.body.id}`)).body.sourcePrompt).toBe(text);

    // Removing the photo from the library never breaks an existing site…
    expect((await admin.del(`/admin/stock-images/${img.id}`)).status).toBe(200);
    expect((await fetch(API + cfg.images.hero.replace(/^\/api/, ''))).status).toBe(200);
    // …and it can no longer be picked for new projects.
    const again = await admin.post('/projects', { templateKey: 'website-restaurant', values: draft.values });
    expect(again.status).toBe(422);
  });
});
