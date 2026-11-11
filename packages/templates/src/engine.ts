/**
 * Rule-based configuration engine.
 *
 * Everything here is deterministic: a template definition + a customer submission
 * always produce the same validation result and the same project config.
 * Free-text "additional instructions" are never interpreted — they are stored
 * as notes for the administrator.
 */
import { getModule, MODULES } from './modules';
import { getTheme, THEMES } from './themes';
import type {
  FeatureDef,
  FormField,
  ModuleDef,
  ProjectConfig,
  RoleDef,
  SectionState,
  Submission,
  TemplateDefinition,
  ThemeDef,
  ValidationIssue,
  ValidationResult,
} from './types';

export interface EngineContext {
  /** Extra themes/modules registered by the admin in the DB. */
  themes?: ThemeDef[];
  modules?: ModuleDef[];
}

const HEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+()\-.\s\d]{5,25}$/;
const URL_RE = /^(https?:\/\/|\/)[^\s]+$/i;
const ASSET_REF = /^asset:[a-z0-9]+$/i;
/** Photos picked from the shared image library (copied into the project on creation). */
const STOCK_REF = /^stock:[a-z0-9]+$/i;
const isImageRef = (s: string) => ASSET_REF.test(s) || STOCK_REF.test(s);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// ------------------------------------------------------------------ utils

export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), obj);
}

export function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!cur[k] || typeof cur[k] !== 'object' || Array.isArray(cur[k])) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? null));
}

export function deepMerge<T>(base: T, over: unknown): T {
  if (over === undefined) return clone(base);
  if (Array.isArray(over) || typeof over !== 'object' || over === null) return clone(over as T);
  const out = (base && typeof base === 'object' && !Array.isArray(base) ? clone(base) : {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    out[k] = deepMerge(out[k], v);
  }
  return out as T;
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** Walk any JSON value and replace strings for which fn returns a replacement. */
export function mapStrings(value: unknown, fn: (s: string) => string): unknown {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, mapStrings(v, fn)]));
  }
  return value;
}

/** All "asset:<id>" references contained in a value. */
export function collectAssetRefs(value: unknown): string[] {
  const refs = new Set<string>();
  mapStrings(value, (s) => {
    if (ASSET_REF.test(s)) refs.add(s.slice('asset:'.length));
    return s;
  });
  return [...refs];
}

/** All "stock:<id>" (image library) references contained in a value. */
export function collectStockRefs(value: unknown): string[] {
  const refs = new Set<string>();
  mapStrings(value, (s) => {
    if (STOCK_REF.test(s)) refs.add(s.slice('stock:'.length));
    return s;
  });
  return [...refs];
}

// ------------------------------------------------------------------ features

export function defaultFeatures(def: TemplateDefinition): string[] {
  if (Array.isArray(def.defaults.features)) return [...(def.defaults.features as string[])];
  return def.features.filter((x) => x.default).map((x) => x.key);
}

export function selectedFeatures(def: TemplateDefinition, submission: Submission): string[] {
  const v = submission.values.features;
  return Array.isArray(v) ? (v as string[]) : defaultFeatures(def);
}

export function isFieldVisible(field: FormField, features: string[]): boolean {
  return !field.showIfFeature || features.includes(field.showIfFeature);
}

export function allFields(def: TemplateDefinition): FormField[] {
  return def.formSchema.flatMap((s) => s.fields);
}

/**
 * Union of every feature across the given templates of a category.
 * The wizard uses it to show features the chosen template does *not* support.
 */
export function featureCatalog(templates: TemplateDefinition[]): FeatureDef[] {
  const map = new Map<string, FeatureDef>();
  for (const t of templates) for (const fdef of t.features) if (!map.has(fdef.key)) map.set(fdef.key, fdef);
  return [...map.values()];
}

// ------------------------------------------------------------------ field validation

function issue(path: string, code: ValidationIssue['code'], message: string): ValidationIssue {
  return { path, code, message };
}

function validateValue(field: FormField, value: unknown, path: string, def: TemplateDefinition, ctx: EngineContext, errors: ValidationIssue[]): void {
  if (isEmpty(value)) {
    if (field.required) errors.push(issue(path, 'required', `${field.label} is required.`));
    return;
  }
  const str = typeof value === 'string' ? value : null;
  const needString = () => {
    if (str === null) errors.push(issue(path, 'invalid_type', `${field.label} must be text.`));
    return str !== null;
  };
  switch (field.type) {
    case 'text':
    case 'textarea':
      if (needString() && field.maxLength && str!.length > field.maxLength) errors.push(issue(path, 'too_long', `${field.label} must be at most ${field.maxLength} characters.`));
      break;
    case 'email':
      if (needString() && !EMAIL.test(str!)) errors.push(issue(path, 'invalid_value', `${field.label} must be a valid email address.`));
      break;
    case 'phone':
      if (needString() && !PHONE.test(str!)) errors.push(issue(path, 'invalid_value', `${field.label} must be a valid phone number.`));
      break;
    case 'url':
      if (needString() && !URL_RE.test(str!)) errors.push(issue(path, 'invalid_value', `${field.label} must be a URL starting with http(s)://`));
      break;
    case 'color':
      if (needString() && !HEX.test(str!)) errors.push(issue(path, 'invalid_value', `${field.label} must be a hex colour like #1f4e79.`));
      break;
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) errors.push(issue(path, 'invalid_type', `${field.label} must be a number.`));
      else if ((field.min !== undefined && n < field.min) || (field.max !== undefined && n > field.max))
        errors.push(issue(path, 'out_of_range', `${field.label} must be between ${field.min ?? '-∞'} and ${field.max ?? '∞'}.`));
      break;
    }
    case 'checkbox':
      if (typeof value !== 'boolean') errors.push(issue(path, 'invalid_type', `${field.label} must be true or false.`));
      break;
    case 'select':
      if (needString() && field.options && !field.options.some((o) => o.value === str)) errors.push(issue(path, 'invalid_value', `${field.label}: "${str}" is not an allowed option.`));
      break;
    case 'multiselect':
      if (!Array.isArray(value)) errors.push(issue(path, 'invalid_type', `${field.label} must be a list.`));
      else for (const v of value) if (field.options && !field.options.some((o) => o.value === v)) errors.push(issue(path, 'invalid_value', `${field.label}: "${String(v)}" is not an allowed option.`));
      break;
    case 'image':
      if (needString() && !isImageRef(str!) && !URL_RE.test(str!)) errors.push(issue(path, 'invalid_value', `${field.label} must be an uploaded image.`));
      break;
    case 'images':
    case 'list':
      if (!Array.isArray(value) || value.some((x) => typeof x !== 'string')) errors.push(issue(path, 'invalid_type', `${field.label} must be a list.`));
      else if (field.max !== undefined && value.length > field.max) errors.push(issue(path, 'out_of_range', `${field.label}: at most ${field.max} items.`));
      else if (field.type === 'images') for (const x of value as string[]) if (!isImageRef(x) && !URL_RE.test(x)) errors.push(issue(path, 'invalid_value', `${field.label} contains an invalid image.`));
      break;
    case 'hours':
      if (!Array.isArray(value)) errors.push(issue(path, 'invalid_type', `${field.label} must be a list of days.`));
      else
        (value as Record<string, unknown>[]).forEach((h, i) => {
          if (!h || typeof h.day !== 'string') errors.push(issue(`${path}.${i}`, 'invalid_value', `${field.label}: row ${i + 1} is missing the day.`));
          else if (!h.closed && (!TIME.test(String(h.open)) || !TIME.test(String(h.close))))
            errors.push(issue(`${path}.${i}`, 'invalid_value', `${field.label}: ${h.day} needs open/close times as HH:MM.`));
        });
      break;
    case 'repeater':
      if (!Array.isArray(value)) errors.push(issue(path, 'invalid_type', `${field.label} must be a list.`));
      else {
        if (field.max !== undefined && value.length > field.max) errors.push(issue(path, 'out_of_range', `${field.label}: at most ${field.max} items.`));
        (value as Record<string, unknown>[]).forEach((item, i) => {
          for (const sub of field.itemFields ?? []) validateValue(sub, item?.[sub.key], `${path}.${i}.${sub.key}`, def, ctx, errors);
        });
      }
      break;
    case 'theme':
      if (needString() && !def.themes.includes(str!)) errors.push(issue(path, 'unsupported_theme', `Theme "${str}" is not available for ${def.name}. Available: ${def.themes.join(', ')}.`));
      break;
    case 'layout':
      if (needString() && !def.layoutVariants.some((l) => l.key === str)) errors.push(issue(path, 'unsupported_layout', `Design variation "${str}" is not available for ${def.name}.`));
      break;
    case 'font':
      if (needString() && !def.fonts.includes(str!)) errors.push(issue(path, 'unsupported_font', `Font "${str}" is not available for ${def.name}.`));
      break;
    case 'features':
    case 'modules':
    case 'roles':
      // validated as a whole in validateSelections()
      break;
  }
}

function validateSelections(def: TemplateDefinition, features: string[], modules: string[] | undefined, roles: string[] | undefined, errors: ValidationIssue[], warnings: ValidationIssue[], ctx: EngineContext) {
  const supported = new Set(def.features.map((x) => x.key));
  for (const key of features) {
    if (!supported.has(key)) {
      errors.push(issue('features', 'unsupported_feature', `The feature "${key}" is not supported by the ${def.name} template. Supported features: ${def.features.map((x) => x.label).join(', ')}.`));
    }
  }
  for (const fdef of def.features) {
    if (!features.includes(fdef.key)) continue;
    for (const req of fdef.requires ?? []) {
      if (!features.includes(req)) {
        const label = def.features.find((x) => x.key === req)?.label ?? req;
        errors.push(issue('features', 'missing_dependency', `"${fdef.label}" requires "${label}" to be enabled.`));
      }
    }
  }

  if (def.category !== 'WEBSITE') {
    const mods = modules ?? [];
    if (mods.length === 0) errors.push(issue('modules', 'required', 'Select at least one module.'));
    for (const m of mods) {
      if (!def.modules.includes(m)) {
        const known = getModule(m, ctx.modules);
        errors.push(issue('modules', 'unsupported_module', `The module "${known?.name ?? m}" is not supported by ${def.name}. Supported modules: ${def.modules.map((k) => getModule(k, ctx.modules)?.name ?? k).join(', ')}.`));
      }
    }
    for (const r of def.requiredModules ?? []) {
      if (!mods.includes(r)) warnings.push(issue('modules', 'missing_dependency', `The "${getModule(r, ctx.modules)?.name ?? r}" module is always included in ${def.name}.`));
    }
    const roleKeys = def.roles.map((r) => r.key);
    for (const r of roles ?? []) if (!roleKeys.includes(r)) errors.push(issue('roles', 'invalid_value', `User role "${r}" is not offered by ${def.name}.`));
  }
}

/** Validate a customer's requirement form submission against the template. */
export function validateSubmission(def: TemplateDefinition, submission: Submission, ctx: EngineContext = {}): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const values = submission?.values ?? {};
  const features = selectedFeatures(def, { values });

  if (values.features !== undefined && !Array.isArray(values.features)) errors.push(issue('features', 'invalid_type', 'Features must be a list.'));
  for (const field of allFields(def)) {
    if (!isFieldVisible(field, features)) continue;
    validateValue(field, values[field.key], field.key, def, ctx, errors);
  }
  const modules = Array.isArray(values.modules) ? (values.modules as string[]) : (def.defaults.modules as string[] | undefined);
  const roles = Array.isArray(values.roles) ? (values.roles as string[]) : undefined;
  validateSelections(def, features, modules, roles, errors, warnings, ctx);
  return { valid: errors.length === 0, errors, warnings };
}

// ------------------------------------------------------------------ config building

/** Derive section state & navigation from enabled features (keeps existing order/titles where possible). */
export function deriveSections(def: TemplateDefinition, features: string[], previous?: SectionState[]): SectionState[] {
  if (def.category !== 'WEBSITE') return [];
  const prevMap = new Map((previous ?? []).map((s) => [s.key, s]));
  const order = previous?.length ? [...previous.map((s) => s.key), ...def.sections.map((s) => s.key)] : def.sections.map((s) => s.key);
  const seen = new Set<string>();
  const out: SectionState[] = [];
  for (const key of order) {
    if (seen.has(key)) continue;
    seen.add(key);
    const sdef = def.sections.find((s) => s.key === key);
    if (!sdef) continue;
    const featureOk = !sdef.feature || features.includes(sdef.feature);
    const prev = prevMap.get(key);
    const enabled = sdef.required ? true : featureOk && (prev ? prev.enabled : sdef.default !== false);
    out.push({ key, enabled, ...(prev?.title ? { title: prev.title } : {}) });
  }
  return out;
}

export function deriveNavigation(def: TemplateDefinition, sections: SectionState[]) {
  return sections
    .filter((s) => s.enabled && s.key !== 'hero')
    .map((s) => ({ section: s.key, label: s.title || def.sections.find((d) => d.key === s.key)?.label || s.key }));
}

function resolveRoles(def: TemplateDefinition, keys: string[] | undefined): RoleDef[] {
  if (def.category === 'WEBSITE') return [];
  const wanted = new Set(keys?.length ? keys : def.roles.map((r) => r.key));
  wanted.add('admin');
  return def.roles.filter((r) => wanted.has(r.key));
}

/** The template's own default config (what the master template looks like un-customised). */
export function baseConfig(def: TemplateDefinition, ctx: EngineContext = {}): ProjectConfig {
  // Deep clone: customer configs must never share references with the master template.
  const d = clone(def.defaults) as Partial<ProjectConfig>;
  const themeKey = (d.branding?.theme as string) || def.defaultTheme;
  const theme = getTheme(themeKey, ctx.themes);
  const features = defaultFeatures(def);
  const modules = Array.from(new Set([...(def.requiredModules ?? []), ...((d.modules as string[]) ?? def.modules)]));
  const sections = deriveSections(def, features);
  const config: ProjectConfig = {
    business: { name: def.name, ...(d.business ?? {}) } as ProjectConfig['business'],
    branding: {
      primaryColor: theme.tokens.primary,
      secondaryColor: theme.tokens.secondary,
      accentColor: theme.tokens.accent,
      font: def.fonts[0] ?? 'Inter',
      layout: def.layoutVariants[0]?.key ?? 'default',
      ...(d.branding ?? {}),
      theme: themeKey,
    } as ProjectConfig['branding'],
    images: { gallery: [], ...(d.images ?? {}) } as ProjectConfig['images'],
    content: clone((d.content as Record<string, unknown>) ?? {}),
    sections,
    navigation: deriveNavigation(def, sections),
    features,
    modules: def.category === 'WEBSITE' ? [...def.modules] : modules,
    roles: resolveRoles(def, undefined),
  };
  return config;
}

function normaliseValue(field: FormField, value: unknown): unknown {
  switch (field.type) {
    case 'number':
      return value === '' || value === null || value === undefined ? undefined : Number(value);
    case 'list':
      return (value as string[]).map((s) => s.trim()).filter(Boolean);
    case 'repeater':
      return (value as Record<string, unknown>[]).map((item) => {
        const out: Record<string, unknown> = {};
        for (const sub of field.itemFields ?? []) {
          const v = item?.[sub.key];
          if (!isEmpty(v)) out[sub.key] = normaliseValue(sub, v);
        }
        return out;
      });
    default:
      return typeof value === 'string' ? value.trim() : value;
  }
}

/**
 * Build a customer's project config from the template defaults + their submission.
 * Throws if the submission is invalid — call validateSubmission first to show errors.
 * `lenient` is for previews of unfinished drafts only (never used when saving a project).
 */
export function buildProjectConfig(def: TemplateDefinition, submission: Submission, ctx: EngineContext = {}, opts: { lenient?: boolean } = {}): ProjectConfig {
  const result = validateSubmission(def, submission, ctx);
  if (!result.valid && !opts.lenient) {
    const err = new Error('Invalid submission: ' + result.errors.map((e) => e.message).join(' '));
    (err as Error & { issues?: ValidationIssue[] }).issues = result.errors;
    throw err;
  }
  const values = submission.values;
  const config = baseConfig(def, ctx) as unknown as Record<string, unknown>;
  const features = selectedFeatures(def, submission);

  // If the customer picked a theme but no colours, use the theme's palette.
  if (typeof values.theme === 'string') {
    const t = getTheme(values.theme, ctx.themes);
    setPath(config, 'branding.primaryColor', t.tokens.primary);
    setPath(config, 'branding.secondaryColor', t.tokens.secondary);
    setPath(config, 'branding.accentColor', t.tokens.accent);
  }

  for (const field of allFields(def)) {
    if (!isFieldVisible(field, features)) continue;
    if (['features', 'modules', 'roles'].includes(field.type)) continue;
    const v = values[field.key];
    if (isEmpty(v)) continue;
    setPath(config, field.bind, normaliseValue(field, v));
  }

  const cfg = config as unknown as ProjectConfig;
  cfg.features = Array.from(new Set(features));
  if (def.category !== 'WEBSITE') {
    const mods = Array.isArray(values.modules) ? (values.modules as string[]) : cfg.modules;
    cfg.modules = Array.from(new Set([...(def.requiredModules ?? []), ...mods]));
    cfg.roles = resolveRoles(def, values.roles as string[] | undefined);
  }
  cfg.sections = deriveSections(def, cfg.features);
  cfg.navigation = deriveNavigation(def, cfg.sections);
  if (!cfg.business.name) cfg.business.name = def.name;
  return cfg;
}

/**
 * Validate a full project config (used by the visual editor on every save).
 * Guarantees customers can only use options the template supports.
 */
export function validateConfig(def: TemplateDefinition, config: ProjectConfig, ctx: EngineContext = {}): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  if (!config || typeof config !== 'object') return { valid: false, errors: [issue('', 'invalid_type', 'Config must be an object.')], warnings };

  if (!config.business?.name || typeof config.business.name !== 'string') errors.push(issue('business.name', 'required', 'Business name is required.'));
  else if (config.business.name.length > 80) errors.push(issue('business.name', 'too_long', 'Business name must be at most 80 characters.'));
  if (config.business?.email && !EMAIL.test(config.business.email)) errors.push(issue('business.email', 'invalid_value', 'Email is not valid.'));
  if (config.business?.phone && !PHONE.test(config.business.phone)) errors.push(issue('business.phone', 'invalid_value', 'Phone number is not valid.'));
  if (config.business?.whatsapp && !PHONE.test(config.business.whatsapp)) errors.push(issue('business.whatsapp', 'invalid_value', 'WhatsApp number is not valid.'));

  const b = config.branding ?? ({} as ProjectConfig['branding']);
  for (const k of ['primaryColor', 'secondaryColor', 'accentColor'] as const) {
    if (b[k] && !HEX.test(b[k])) errors.push(issue(`branding.${k}`, 'invalid_value', `${k} must be a hex colour.`));
  }
  if (!def.themes.includes(b.theme)) errors.push(issue('branding.theme', 'unsupported_theme', `Theme "${b.theme}" is not available for ${def.name}.`));
  if (!def.layoutVariants.some((l) => l.key === b.layout)) errors.push(issue('branding.layout', 'unsupported_layout', `Design variation "${b.layout}" is not available for ${def.name}.`));
  if (b.font && !def.fonts.includes(b.font)) errors.push(issue('branding.font', 'unsupported_font', `Font "${b.font}" is not available for ${def.name}.`));
  if (b.logo && !URL_RE.test(b.logo)) errors.push(issue('branding.logo', 'invalid_value', 'Logo must be an uploaded image.'));

  // Structural problems stop here; value problems above are reported together with the rest.
  const structural: ValidationIssue[] = [];
  if (!Array.isArray(config.features)) structural.push(issue('features', 'invalid_type', 'features must be a list.'));
  if (!Array.isArray(config.modules)) structural.push(issue('modules', 'invalid_type', 'modules must be a list.'));
  if (!Array.isArray(config.sections)) structural.push(issue('sections', 'invalid_type', 'sections must be a list.'));
  if (structural.length) return { valid: false, errors: [...errors, ...structural], warnings };

  validateSelections(def, config.features, def.category === 'WEBSITE' ? undefined : config.modules, config.roles?.map((r) => r.key), errors, warnings, ctx);
  if (def.category !== 'WEBSITE') {
    for (const r of def.requiredModules ?? []) if (!config.modules.includes(r)) errors.push(issue('modules', 'missing_dependency', `The "${getModule(r, ctx.modules)?.name ?? r}" module can not be disabled.`));
  }

  for (const s of config.sections) {
    const sdef = def.sections.find((d) => d.key === s.key);
    if (!sdef) {
      errors.push(issue('sections', 'invalid_value', `Section "${s.key}" does not exist in ${def.name}.`));
      continue;
    }
    if (sdef.required && !s.enabled) errors.push(issue('sections', 'invalid_value', `The "${sdef.label}" section is required.`));
    if (s.enabled && sdef.feature && !config.features.includes(sdef.feature)) {
      const label = def.features.find((x) => x.key === sdef.feature)?.label ?? sdef.feature;
      errors.push(issue('sections', 'missing_dependency', `Enable the "${label}" feature to show the "${sdef.label}" section.`));
    }
    if (s.title && s.title.length > 60) errors.push(issue('sections', 'too_long', `Section title "${s.title.slice(0, 20)}…" is too long.`));
  }
  if (config.navigation && !Array.isArray(config.navigation)) errors.push(issue('navigation', 'invalid_type', 'navigation must be a list.'));
  for (const n of config.navigation ?? []) {
    if (!config.sections.some((s) => s.key === n.section && s.enabled)) errors.push(issue('navigation', 'invalid_value', `Navigation item "${n.label}" points to a hidden or unknown section.`));
  }

  for (const url of [config.images?.hero, ...(config.images?.gallery ?? [])]) {
    if (url && !URL_RE.test(url)) errors.push(issue('images', 'invalid_value', 'Images must be uploaded files.'));
  }

  const size = JSON.stringify(config).length;
  if (size > 500_000) errors.push(issue('', 'too_long', 'Configuration is too large.'));

  return { valid: errors.length === 0, errors, warnings };
}

// ------------------------------------------------------------------ template authoring

const RENDERERS: Record<string, string[]> = {
  WEBSITE: ['restaurant', 'corporate', 'business', 'agency', 'portfolio'],
  CRM: ['workspace'],
  ERP: ['workspace'],
};
const FIELD_TYPES = ['text', 'textarea', 'email', 'phone', 'url', 'number', 'select', 'multiselect', 'checkbox', 'color', 'image', 'images', 'repeater', 'list', 'hours', 'theme', 'layout', 'font', 'features', 'modules', 'roles'];

/** Structural validation for admin-authored template definitions. */
export function validateTemplateDefinition(def: TemplateDefinition, ctx: EngineContext = {}): ValidationResult {
  const errors: ValidationIssue[] = [];
  const e = (path: string, message: string) => errors.push(issue(path, 'invalid_value', message));
  if (!def || typeof def !== 'object') return { valid: false, errors: [issue('', 'invalid_type', 'Definition must be an object.')], warnings: [] };

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(def.key ?? '')) e('key', 'Key must be lowercase kebab-case, e.g. "website-bakery".');
  if (!def.name) e('name', 'Name is required.');
  if (!['WEBSITE', 'CRM', 'ERP'].includes(def.category)) e('category', 'Category must be WEBSITE, CRM or ERP.');
  else if (!RENDERERS[def.category].includes(def.renderer)) e('renderer', `Renderer for ${def.category} must be one of: ${RENDERERS[def.category].join(', ')}.`);
  for (const arr of ['features', 'modules', 'sections', 'themes', 'fonts', 'layoutVariants', 'roles', 'formSchema', 'previewImages'] as const) {
    if (!Array.isArray(def[arr])) e(arr, `${arr} must be a list.`);
  }
  if (errors.length) return { valid: false, errors, warnings: [] };

  const themeKeys = new Set([...THEMES, ...(ctx.themes ?? [])].map((t) => t.key));
  if (def.themes.length === 0) e('themes', 'At least one theme is required.');
  for (const t of def.themes) if (!themeKeys.has(t)) e('themes', `Unknown theme "${t}".`);
  if (!def.themes.includes(def.defaultTheme)) e('defaultTheme', 'Default theme must be one of the template themes.');
  if (def.layoutVariants.length === 0) e('layoutVariants', 'At least one design variation is required.');
  if (def.fonts.length === 0) e('fonts', 'At least one font is required.');

  const featureKeys = new Set<string>();
  for (const fd of def.features) {
    if (!fd.key || featureKeys.has(fd.key)) e('features', `Duplicate or empty feature key "${fd.key}".`);
    featureKeys.add(fd.key);
  }
  for (const fd of def.features) for (const r of fd.requires ?? []) if (!featureKeys.has(r)) e('features', `Feature "${fd.key}" requires unknown feature "${r}".`);

  const moduleKeys = new Set([...MODULES, ...(ctx.modules ?? [])].map((m) => m.key));
  for (const m of def.modules) if (!moduleKeys.has(m)) e('modules', `Unknown module "${m}".`);
  for (const m of def.requiredModules ?? []) if (!def.modules.includes(m)) e('requiredModules', `Required module "${m}" is not in modules.`);
  if (def.category !== 'WEBSITE' && def.modules.length === 0) e('modules', 'CRM/ERP templates need at least one module.');
  if (def.category !== 'WEBSITE' && !def.roles.some((r) => r.key === 'admin')) e('roles', 'CRM/ERP templates need an "admin" role.');

  const sectionKeys = new Set<string>();
  for (const s of def.sections) {
    if (sectionKeys.has(s.key)) e('sections', `Duplicate section "${s.key}".`);
    sectionKeys.add(s.key);
    if (s.feature && !featureKeys.has(s.feature)) e('sections', `Section "${s.key}" references unknown feature "${s.feature}".`);
  }
  if (def.category === 'WEBSITE' && !sectionKeys.has('hero')) e('sections', 'Website templates need a "hero" section.');

  const fieldKeys = new Set<string>();
  const checkField = (fd: FormField, path: string) => {
    if (!fd.key || !fd.bind || !fd.label) e(path, 'Fields need key, label and bind.');
    if (!FIELD_TYPES.includes(fd.type)) e(path, `Unknown field type "${fd.type}".`);
    if (fd.showIfFeature && !featureKeys.has(fd.showIfFeature)) e(path, `Field "${fd.key}" depends on unknown feature "${fd.showIfFeature}".`);
    if (fd.type === 'repeater' && !fd.itemFields?.length) e(path, `Repeater "${fd.key}" needs itemFields.`);
  };
  def.formSchema.forEach((sec, i) => {
    if (!Array.isArray(sec.fields)) return e(`formSchema.${i}`, 'Section needs a fields list.');
    for (const fd of sec.fields) {
      if (fieldKeys.has(fd.key)) e(`formSchema.${i}`, `Duplicate field key "${fd.key}".`);
      fieldKeys.add(fd.key);
      checkField(fd, `formSchema.${i}.${fd.key}`);
      for (const sub of fd.itemFields ?? []) checkField(sub, `formSchema.${i}.${fd.key}.${sub.key}`);
    }
  });
  const needs = def.category === 'WEBSITE' ? ['businessName'] : ['companyName'];
  if (![...fieldKeys].some((k) => needs.includes(k)) && !allFields(def).some((x) => x.bind === 'business.name')) e('formSchema', 'The form must collect the business name (bind "business.name").');
  if (def.category !== 'WEBSITE' && !allFields(def).some((x) => x.type === 'modules')) e('formSchema', 'CRM/ERP forms need a "modules" field.');

  return { valid: errors.length === 0, errors, warnings: [] };
}
