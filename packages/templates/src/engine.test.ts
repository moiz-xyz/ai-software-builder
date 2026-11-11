import { describe, expect, it } from 'vitest';
import {
  MASTER_TEMPLATES, restaurantWebsite, salesCrm, businessErp, basicErp,
  validateSubmission, buildProjectConfig, validateConfig, validateTemplateDefinition, collectAssetRefs, mapStrings,
} from './index';

const restaurantValues = {
  businessName: 'Royal Bites',
  description: 'Charcoal grill and family dining.',
  email: 'hello@royalbites.test',
  phone: '+92 300 1234567',
  theme: 'warm',
  layout: 'fullbleed',
  features: ['menu', 'hours', 'reservations', 'whatsapp', 'gallery', 'contactForm'],
  whatsapp: '+92 300 1234567',
  menu: [{ name: 'Chicken Tikka', price: '1200', category: 'Grill' }],
  logo: 'asset:abc123',
  gallery: ['asset:def456'],
};

describe('master templates', () => {
  it('all ship valid definitions', () => {
    for (const t of MASTER_TEMPLATES) {
      const r = validateTemplateDefinition(t);
      expect(r.errors, t.key).toEqual([]);
    }
  });
  it('cover 5 website, 3 CRM and 3 ERP templates', () => {
    expect(MASTER_TEMPLATES.filter((t) => t.category === 'WEBSITE')).toHaveLength(5);
    expect(MASTER_TEMPLATES.filter((t) => t.category === 'CRM')).toHaveLength(3);
    expect(MASTER_TEMPLATES.filter((t) => t.category === 'ERP')).toHaveLength(3);
  });
});

describe('validateSubmission', () => {
  it('accepts a valid restaurant submission', () => {
    expect(validateSubmission(restaurantWebsite, { values: restaurantValues }).errors).toEqual([]);
  });
  it('rejects unsupported features with a helpful message', () => {
    const r = validateSubmission(restaurantWebsite, { values: { ...restaurantValues, features: ['menu', 'projects'] } });
    expect(r.valid).toBe(false);
    expect(r.errors[0].code).toBe('unsupported_feature');
    expect(r.errors[0].message).toContain('not supported by the Restaurant Website template');
  });
  it('rejects unsupported themes and modules', () => {
    expect(validateSubmission(restaurantWebsite, { values: { ...restaurantValues, theme: 'bold' } }).errors[0].code).toBe('unsupported_theme');
    const crm = validateSubmission(salesCrm, { values: { companyName: 'Acme', businessType: 'Retail', employees: 12, email: 'a@b.co', theme: 'modern', layout: 'sidebar', modules: ['contacts', 'inventory'], roles: ['admin'] } });
    expect(crm.errors.map((e) => e.code)).toContain('unsupported_module');
  });
  it('enforces feature dependencies', () => {
    const r = validateSubmission(businessErp, { values: { companyName: 'X', businessType: 'Retail', employees: 3, email: 'x@y.io', currency: 'USD', theme: 'classic', layout: 'sidebar', modules: ['inventory'], roles: ['admin'], features: ['autoInvoice'] } });
    expect(r.errors.map((e) => e.code)).toContain('missing_dependency');
  });
  it('requires fields and validates formats', () => {
    const r = validateSubmission(restaurantWebsite, { values: { ...restaurantValues, businessName: '', email: 'nope' } });
    expect(r.errors.map((e) => e.path)).toEqual(expect.arrayContaining(['businessName', 'email']));
  });
  it('skips fields hidden by unselected features', () => {
    const r = validateSubmission(restaurantWebsite, { values: { ...restaurantValues, features: ['contactForm'], menu: 'garbage' } });
    expect(r.valid).toBe(true);
  });
});

describe('buildProjectConfig', () => {
  it('maps form answers into config and derives sections', () => {
    const cfg = buildProjectConfig(restaurantWebsite, { values: restaurantValues });
    expect(cfg.business.name).toBe('Royal Bites');
    expect(cfg.branding.theme).toBe('warm');
    expect((cfg.content.menu as unknown[]).length).toBe(1);
    expect(cfg.sections.find((s) => s.key === 'reservation')?.enabled).toBe(true);
    expect(cfg.sections.find((s) => s.key === 'testimonials')?.enabled).toBe(false);
    expect(cfg.navigation.map((n) => n.section)).toContain('menu');
    expect(validateConfig(restaurantWebsite, mapStrings(cfg, (s) => s.replace(/^asset:/, '/api/files/')) as typeof cfg).errors).toEqual([]);
  });
  it('never mutates the master template', () => {
    const before = JSON.stringify(restaurantWebsite);
    const a = buildProjectConfig(restaurantWebsite, { values: restaurantValues });
    const b = buildProjectConfig(restaurantWebsite, { values: { ...restaurantValues, businessName: 'Food House', theme: 'midnight' } });
    (a.content.menu as unknown[]).push({ name: 'mutated' });
    a.business.hours![0].open = '00:00';
    expect(JSON.stringify(restaurantWebsite)).toBe(before);
    expect(b.business.name).toBe('Food House');
    expect(b.business.hours![0].open).toBe('09:00');
  });
  it('always includes required modules and the admin role', () => {
    const cfg = buildProjectConfig(basicErp, { values: { companyName: 'Shop', businessType: 'Retail', employees: 4, email: 's@s.io', currency: 'PKR', theme: 'classic', layout: 'sidebar', modules: ['sales'], roles: ['sales_staff'] } });
    expect(cfg.modules).toEqual(expect.arrayContaining(['inventory', 'sales']));
    expect(cfg.roles.map((r) => r.key)).toEqual(['admin', 'sales_staff']);
    expect(cfg.content.currency).toBe('PKR');
  });
  it('collects asset references', () => {
    expect(collectAssetRefs(restaurantValues).sort()).toEqual(['abc123', 'def456']);
  });
});

describe('validateConfig', () => {
  it('blocks enabling a section whose feature is off', () => {
    const cfg = buildProjectConfig(restaurantWebsite, { values: { ...restaurantValues, logo: undefined, gallery: undefined } });
    cfg.sections = cfg.sections.map((s) => (s.key === 'testimonials' ? { ...s, enabled: true } : s));
    expect(validateConfig(restaurantWebsite, cfg).errors[0].code).toBe('missing_dependency');
  });
  it('blocks disabling required modules', () => {
    const cfg = buildProjectConfig(basicErp, { values: { companyName: 'Shop', businessType: 'Retail', employees: 4, email: 's@s.io', currency: 'PKR', theme: 'classic', layout: 'sidebar', modules: ['inventory'], roles: ['admin'] } });
    cfg.modules = ['sales'];
    expect(validateConfig(basicErp, cfg).valid).toBe(false);
  });
});
