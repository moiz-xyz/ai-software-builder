import { describe, expect, it } from 'vitest';
import { analyseDescription, applyNameToValues, composeDraft, MASTER_TEMPLATES, NAME_PLACEHOLDER, pickImages, StockImage, validateSubmission } from './index';

const def = (key: string) => MASTER_TEMPLATES.find((t) => t.key === key)!;
const draftFor = (text: string, opts = {}) => {
  const a = analyseDescription(text);
  const d = composeDraft(def(a.templateKey), a, { accountEmail: 'owner@example.com', ...opts });
  return { a, d, v: (k: string) => d.values[k] };
};

const RESTAURANT = `I have a Desi restaurant called Saffron & Ember in Gulberg Lahore. Phone 0300 1234567, email hello@saffronember.com.
Open 12pm to 12am every day. I want online table booking and a WhatsApp button, warm red colours.
Menu: Chicken Karahi Rs 1,650, Nihari Rs 1850, Chicken Biryani Rs 1100, Mango Lassi Rs 450`;

describe('Instant Builder (rule-based description reader)', () => {
  it('reads a restaurant description into a valid submission', () => {
    const { a, d, v } = draftFor(RESTAURANT);
    expect(a.templateKey).toBe('website-restaurant');
    expect(a.confidence).toBe('high');
    expect(v('businessName')).toBe('Saffron & Ember');
    expect(v('email')).toBe('hello@saffronember.com');
    expect(v('phone')).toBe('0300 1234567');
    expect(v('whatsapp')).toBe('0300 1234567');
    expect(v('address')).toBe('Gulberg, Lahore');
    expect(v('cuisine')).toBe('Desi');
    expect(v('theme')).toBe('warm');
    expect(v('primaryColor')).toBe('#C0392B');
    const menu = v('menu') as { name: string; price: string; category: string }[];
    expect(menu.map((m) => m.name)).toEqual(['Chicken Karahi', 'Nihari', 'Chicken Biryani', 'Mango Lassi']);
    expect(menu[0].price).toBe('Rs 1,650');
    expect(menu[3].category).toBe('Drinks');
    const hours = v('hours') as { open: string; close: string; closed: boolean }[];
    expect(hours.every((h) => h.open === '12:00' && h.close === '00:00' && !h.closed)).toBe(true);
    expect(v('features')).toEqual(expect.arrayContaining(['menu', 'reservations', 'whatsapp', 'hours']));
    expect(validateSubmission(def('website-restaurant'), { values: d.values }).valid).toBe(true);
    // every value from the description can be traced back to the customer's words
    for (const det of d.detections.filter((x) => x.source === 'description')) expect(det.evidence).toBeTruthy();
  });

  it('is deterministic for the same text and seed', () => {
    expect(draftFor(RESTAURANT).d).toEqual(draftFor(RESTAURANT).d);
    const a = draftFor(RESTAURANT, { seed: 1 }).d.values.tagline;
    const b = draftFor(RESTAURANT, { seed: 2 }).d.values.tagline;
    expect(typeof a).toBe('string');
    expect(typeof b).toBe('string');
  });

  it('picks the right template for different businesses', () => {
    const cases: [string, string][] = [
      ['Glow Beauty Salon in DHA Karachi. Haircut Rs 1500, Facial Rs 3000. Mon-Sat 11am-8pm, closed Sunday.', 'website-business'],
      ['We are Pixel Forge, a digital marketing agency in Dubai. We do branding, web design and SEO.', 'website-agency'],
      ["I'm Sara Khan, a freelance photographer based in Islamabad.", 'website-portfolio'],
      ['Al-Noor Textiles Pvt Ltd, established in 1995, exports to 30 countries.', 'website-corporate'],
      ['Need a CRM for my company. Our sales team tracks deals in a pipeline.', 'crm-sales'],
      ['We want a CRM to capture and qualify leads from Facebook and convert them.', 'crm-leads'],
      ['Inventory system for our shop with invoices.', 'erp-basic'],
      ['Wholesale distributor needs inventory with suppliers and purchase orders.', 'erp-inventory-sales'],
      ['Full ERP: inventory, suppliers, accounting, expenses, payroll and HR.', 'erp-business'],
      ['I want a CRM for my restaurant customers', 'crm-basic'],
    ];
    for (const [text, key] of cases) expect([text, analyseDescription(text).templateKey]).toEqual([text, key]);
  });

  it('parses salon services, weekly hours and closed days', () => {
    const { v } = draftFor('Glow Beauty Salon is a ladies salon in DHA Karachi. Haircut Rs 1500, Facial Rs 3000. Mon-Sat 11am-8pm, closed Sunday. Call 0321-5550000');
    expect((v('services') as { title: string }[]).map((s) => s.title)).toEqual(['Haircut', 'Facial']);
    const hours = v('hours') as { day: string; open: string; close: string; closed: boolean }[];
    expect(hours[0]).toMatchObject({ day: 'Monday', open: '11:00', close: '20:00', closed: false });
    expect(hours[6]).toMatchObject({ day: 'Sunday', closed: true });
    expect(draftFor('Glow Beauty Salon is a ladies salon in DHA Phase 6, Karachi.').v('address')).toBe('DHA Phase 6, Karachi');
  });

  it('never invents reviews and flags sample content', () => {
    const { d, v } = draftFor('A pizza restaurant in London with customer reviews on the site.');
    expect(v('testimonials')).toBeUndefined();
    expect(d.values.features).not.toContain('testimonials');
    expect(d.notices.some((n) => n.field === 'testimonials')).toBe(true);
    expect(d.detections.find((x) => x.field === 'menu')?.source).toBe('sample');
    expect(d.notices.some((n) => n.field === 'menu' && n.tone === 'warning')).toBe(true);
  });

  it('respects "no …" requests', () => {
    const { d } = draftFor('pizza place in london, margherita £9 and pepperoni £11, open 5pm-11pm, no reservations');
    expect(d.values.features).not.toContain('reservations');
  });

  it('uses a name placeholder until the customer gives a name', () => {
    const { d, v } = draftFor('pizza place in london, margherita £9');
    expect(String(v('description'))).toContain(NAME_PLACEHOLDER);
    expect(d.notices.some((n) => n.field === 'businessName')).toBe(true);
    expect(String(applyNameToValues(d.values, 'Luigi’s').description)).toContain('Luigi’s');
  });

  it('builds workspace values: modules, roles, stages, sources, employees', () => {
    const { v } = draftFor('Need a CRM for my real estate company Prime Homes. Our sales team of 8 people tracks leads from Facebook, Instagram and referrals. Stages: New, Site visit, Negotiation, Closed. Sales manager and sales reps need logins.');
    expect(v('companyName')).toBe('Prime Homes');
    expect(v('employees')).toBe(8);
    expect(v('businessType')).toBe('Real estate');
    expect(v('pipelineStages')).toEqual(['New', 'Site visit', 'Negotiation', 'Closed']);
    expect(v('leadSources')).toEqual(['Facebook', 'Instagram', 'Referral']);
    expect(v('roles')).toEqual(expect.arrayContaining(['admin', 'sales_manager', 'sales_rep']));
    expect(v('modules')).toEqual(expect.arrayContaining(['contacts', 'deals', 'leads']));
  });

  it('reports modules the chosen template does not include', () => {
    const a = analyseDescription('Basic ERP with inventory, invoices and payroll for staff', undefined, 'erp-basic');
    const d = composeDraft(def('erp-basic'), a);
    expect(d.values.modules).not.toContain('hr');
    expect(d.notices.some((n) => /Employees \(HR\)/.test(n.message))).toBe(true);
  });

  it('picks library photos by tag, distinct and stable per seed', () => {
    const lib: StockImage[] = [
      ...Array.from({ length: 5 }, (_, i) => ({ id: `d${i}`, url: `/d${i}.jpg`, tags: ['food-desi'] })),
      ...Array.from({ length: 3 }, (_, i) => ({ id: `r${i}`, url: `/r${i}.jpg`, tags: ['restaurant-interior'] })),
      { id: 'x', url: '/x.jpg', tags: ['agency'] },
    ];
    const p = pickImages(lib, ['food-desi', 'restaurant-interior'], 7, 6);
    expect(p.hero?.tags).toContain('food-desi');
    const ids = [p.hero!.id, ...p.gallery.map((g) => g.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain('x');
    expect(p.gallery.some((g) => g.tags.includes('restaurant-interior'))).toBe(true);
    expect(pickImages(lib, ['food-desi', 'restaurant-interior'], 7, 6)).toEqual(p);
    const { d } = draftFor(RESTAURANT, { images: lib });
    expect(String(d.values.heroImage)).toMatch(/^stock:d\d$/);
    expect(validateSubmission(def('website-restaurant'), { values: d.values }).valid).toBe(true);
  });
});
