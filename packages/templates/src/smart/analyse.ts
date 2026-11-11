/**
 * Instant Builder — step 1: read a free-text business description with fixed rules
 * (keyword lists + text patterns). No AI, no network calls, fully deterministic.
 */
import {
  AGENCY_SERVICE_WORDS, BUSINESS_KINDS, BusinessKind, CATEGORY_HINTS, CITIES, COLOURS, COUNTRY_CURRENCY, CUISINES, CURRENCY_WORDS,
  DEPARTMENTS, FEATURE_WORDS, INDUSTRY_TYPES, LEAD_SOURCES, MENU_CATEGORIES, MODULE_WORDS, MOODS, PORTFOLIO_ROLES, TEMPLATE_KEYWORDS, TEMPLATE_PRIORITY,
} from './lexicon';

export interface Fact<T = unknown> {
  value: T;
  /** The words in the customer's description that produced this value. */
  evidence: string;
}

export interface PricedItem { name: string; price?: string; category?: string; description?: string }
export interface HoursRow { day: string; open: string; close: string; closed: boolean }

export interface Facts {
  name?: Fact<string>;
  personName?: Fact<string>;
  email?: Fact<string>;
  phone?: Fact<string>;
  whatsapp?: Fact<string>;
  website?: Fact<string>;
  address?: Fact<string>;
  city?: Fact<string>;
  country?: string;
  tagline?: Fact<string>;
  about?: Fact<string>;
  cuisines?: Fact<string[]>;
  cuisineTags: string[];
  kind?: Fact<BusinessKind>;
  businessType?: Fact<string>;
  pricedItems: Fact<PricedItem>[];
  listedItems?: Fact<string[]>;
  agencyServices?: Fact<string[]>;
  hours?: Fact<HoursRow[]>;
  maxGuests?: Fact<number>;
  role?: Fact<string>;
  skills?: Fact<string[]>;
  founded?: Fact<number>;
  stats: Fact<{ value: string; label: string }>[];
  employees?: Fact<number>;
  currency?: Fact<{ code: string; symbol: string }>;
  colours: Fact<string>[];
  moods: Fact<string>[];
  wantsLarge?: Fact<boolean>;
  /** Feature keys the customer asked for (on) or explicitly declined (off). */
  featuresOn: Record<string, string>;
  featuresOff: Record<string, string>;
  modulesMentioned: Record<string, string>;
  roleWords: Record<string, string>;
  pipelineStages?: Fact<string[]>;
  leadSources?: Fact<string[]>;
  departments?: Fact<string[]>;
  sentences: string[];
}

export interface TemplateScore { key: string; score: number; matched: string[] }

export interface Analysis {
  text: string;
  scores: TemplateScore[];
  templateKey: string;
  confidence: 'high' | 'medium' | 'low';
  facts: Facts;
}

// ------------------------------------------------------------------ helpers

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const WORD_CHAR = /[\p{L}\p{N}]/u;
const isWordChar = (c: string | undefined) => !!c && WORD_CHAR.test(c);
let lowerSrc = '';
let lowerVal = '';
const lowerOf = (text: string) => {
  if (text !== lowerSrc) { lowerSrc = text; lowerVal = text.toLowerCase(); }
  return lowerVal;
};

/** All whole-word (case-insensitive) occurrences of `w` in `text`. Plain indexOf scanning: fast on long descriptions. */
function findAll(text: string, w: string): number[] {
  const lower = lowerOf(text);
  const needle = w.toLowerCase();
  const out: number[] = [];
  if (!needle || lower.length !== text.length) {
    // rare: lower-casing changed the length (special characters) — fall back to a regex
    const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])(${esc(w)})(?=$|[^\\p{L}\\p{N}])`, 'giu');
    for (const m of text.matchAll(re)) out.push(m.index! + m[0].length - m[1].length);
    return out;
  }
  for (let i = lower.indexOf(needle); i >= 0; i = lower.indexOf(needle, i + 1)) {
    if (!isWordChar(lower[i - 1]) && !isWordChar(lower[i + needle.length])) out.push(i);
  }
  return out;
}

function find(text: string, w: string): number {
  const all = findAll(text, w);
  return all.length ? all[0] : -1;
}

/** A short excerpt of the description around a match, for "we found this because…". */
export function excerpt(text: string, index: number, length: number, pad = 18): string {
  if (index < 0) return '';
  let a = Math.max(0, index - pad);
  let b = Math.min(text.length, index + length + pad);
  while (a > 0 && /\S/.test(text[a - 1])) a--;
  while (b < text.length && /\S/.test(text[b])) b++;
  return (a > 0 ? '…' : '') + text.slice(a, b).replace(/\s+/g, ' ').trim() + (b < text.length ? '…' : '');
}

const SMALL_WORDS = new Set(['and', 'of', 'the', 'de', 'la', 'n', 'for', 'at', 'on', 'in']);
export function titleCase(s: string): string {
  if (/[A-Z]/.test(s)) return s; // respect the customer's own capitalisation
  return s.replace(/\S+/g, (w, i: number) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)));
}

function negated(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 24), index).toLowerCase();
  return /\b(no|not|don'?t|do not|without|no need for|skip|never)\b[^.,;!?]*$/.test(before);
}

function splitList(s: string): string[] {
  return s
    .split(/\s*(?:,|;|\/|\n|•|·|\||\band\b|&|\+|→|->|>)\s*/i)
    .map((x) => x.replace(/^[\s\-–:*]+|[\s.\-–:*!]+$/g, '').trim())
    .filter((x) => x.length > 1 && x.length <= 40 && x.split(/\s+/).length <= 5);
}

function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

// ------------------------------------------------------------------ template detection

const PRODUCT_WORDS: { group: 'WEBSITE' | 'CRM' | 'ERP'; words: string[]; boost: number }[] = [
  { group: 'CRM', words: ['crm', 'customer relationship', 'lead management', 'sales pipeline'], boost: 8 },
  { group: 'ERP', words: ['erp', 'inventory system', 'inventory software', 'inventory management', 'stock management', 'accounting software', 'billing software', 'pos system', 'point of sale', 'business management software', 'management system', 'manage inventory', 'manage my inventory', 'track stock', 'track inventory'], boost: 8 },
  { group: 'WEBSITE', words: ['website', 'web site', 'webpage', 'landing page', 'homepage', 'online presence', 'site for'], boost: 4 },
];

export function scoreTemplates(text: string, available?: string[]): TemplateScore[] {
  const keys = (available ?? TEMPLATE_PRIORITY).filter((k) => TEMPLATE_KEYWORDS[k]);
  const groupBoost: Record<string, { score: number; matched: string[] }> = { WEBSITE: { score: 0, matched: [] }, CRM: { score: 0, matched: [] }, ERP: { score: 0, matched: [] } };
  for (const p of PRODUCT_WORDS) for (const w of p.words) {
    if (find(text, w) >= 0 && groupBoost[p.group].score < p.boost) { groupBoost[p.group].score = p.boost; groupBoost[p.group].matched.push(w); }
  }
  const siteHints = CATEGORY_HINTS.WEBSITE.filter((w) => find(text, w) >= 0).length;
  const systemHints = CATEGORY_HINTS.SYSTEM.filter((w) => find(text, w) >= 0).length;

  const scores = keys.map((key) => {
    const matched: string[] = [];
    let score = 0;
    for (const rule of TEMPLATE_KEYWORDS[key]) {
      for (const w of rule.words) {
        if (find(text, w) >= 0 && !matched.includes(w)) {
          matched.push(w);
          score += (rule.weight ?? 1) * (w.includes(' ') ? 1.3 : 1);
        }
      }
    }
    // diminishing returns so a long list of dishes doesn't drown everything else
    score = score > 9 ? 9 + (score - 9) * 0.35 : score;
    const group = key.startsWith('website') ? 'WEBSITE' : key.startsWith('crm') ? 'CRM' : 'ERP';
    score += groupBoost[group].score + (group === 'WEBSITE' ? siteHints * 0.8 : systemHints * 0.8);
    matched.push(...groupBoost[group].matched.filter((m) => !matched.includes(m)));
    return { key, score: Math.round(score * 10) / 10, matched };
  });
  return scores.sort((a, b) => b.score - a.score || TEMPLATE_PRIORITY.indexOf(a.key) - TEMPLATE_PRIORITY.indexOf(b.key));
}

// ------------------------------------------------------------------ extractors

const NAME_SUFFIX = 'Restaurant|Cafe|Café|Coffee|Bakery|Bakers|Salon|Spa|Agency|Studio|Studios|Store|Shop|Traders|Trading|Enterprises|Solutions|Technologies|Tech|Group|Industries|Corporation|Corp|Ltd|Limited|Pvt|Clinic|Gym|Fitness|Academy|Kitchen|Grill|BBQ|Foods|Sweets|Bistro|Diner|Dhaba|Mart|Boutique|Builders|Logistics|Consulting|Consultants|Associates|Marketing|Digital|Media|Motors|Autos|Travels|Tours|Properties|Estate|Pharmacy|Dental|Barbers|Lounge|House|Palace|Hut|Express|Point|Corner';
const STOP_AFTER_NAME = /\s+(?:in|at|located|which|that|and|we|serving|serves|with|for|near|on|is|are|offering|specialising|specializing|based|from|since|who|where|it|our|my|i|phone|call|email|open|opening|established|founded)\b.*$/i;
const LEADING_JUNK = /^(?:my|our|a|an|this|i|we|hi|hello|the name)\s+/i;

function cleanName(raw: string): string {
  let s = raw.replace(/["“”‘’']/g, (c) => (c === "'" || c === '’' ? c : '')).trim();
  s = s.replace(STOP_AFTER_NAME, '').replace(/[\s,.;:!?-]+$/, '').trim();
  const words = s.split(/\s+/).slice(0, 6);
  return titleCase(words.join(' '));
}

function extractName(text: string, facts: Facts) {
  const tries: [RegExp, number][] = [
    [/\b(?:called|named|name is|name's|known as|brand(?: name)? is|business is|company is|shop is|restaurant is)\s+["“']?([^\n"”,.!?;:()]{2,60})/i, 1],
    [/["“]([^"”\n]{2,50})["”]/, 1],
    [/\b(?:[Ww]e are|[Ww]e're|[Tt]his is|[Ww]elcome to)\s+([A-Z][\w'’&.-]*(?:\s+(?:&|and|of|the|[A-Z][\w'’&.-]*)){0,4})/, 1],
    [/\b(?:company|business|shop|store|restaurant|cafe|agency|firm|brand|startup|clinic|salon|school|academy)\s+(?:called\s+|named\s+)?([A-Z][\w'’&.-]*(?:\s+(?:&|and|of|the|[A-Z][\w'’&.-]*)){0,4})/, 1],
    [new RegExp(`((?:[A-Z0-9][\\w'’&.-]*\\s+){1,4}(?:${NAME_SUFFIX}))\\b`), 1],
    [/(?:^|[.!?\n]\s*)([A-Z][\w'’&.-]*(?:\s+(?:&|and|of|the|de|[A-Z][\w'’&.-]*)){0,5})\s+(?:is|are)\s+(?:a|an|the|our|one)\b/, 1],
  ];
  for (const [re, g] of tries) {
    const m = re.exec(text);
    if (!m) continue;
    let raw = m[g].replace(LEADING_JUNK, '');
    if (re.source.startsWith('((?:[A-Z0-9]')) raw = raw.replace(/^(?:I|We|My|Our|A|An|This|Hi|Hello)\s+/, '');
    const name = cleanName(raw);
    if (name.length >= 2 && /\p{L}/u.test(name) && !/^(i|we|a|an|the|it)$/i.test(name)) {
      facts.name = { value: name, evidence: m[0].trim() };
      break;
    }
  }
  const p = /\b(?:[Mm]y name is|I am|I'm|Im|[Tt]his is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/.exec(text);
  if (p && !/^(A|An|The)$/.test(p[1])) facts.personName = { value: p[1], evidence: p[0] };
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+|00)?\d[\d\s().-]{7,18}\d/g;

function extractContact(text: string, facts: Facts) {
  const em = EMAIL_RE.exec(text);
  if (em) facts.email = { value: em[0].toLowerCase(), evidence: em[0] };

  const phones: { value: string; index: number; raw: string }[] = [];
  for (const m of text.matchAll(PHONE_RE)) {
    const raw = m[0].trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 15) continue;
    const before = text.slice(Math.max(0, m.index! - 5), m.index!).toLowerCase();
    if (/(rs\.?|pkr|\$|£|€|aed|usd)\s*$/.test(before)) continue;
    if (/^\d{4}\s*[-–]\s*\d{4}$/.test(raw)) continue; // year range
    phones.push({ value: raw.replace(/\s{2,}/g, ' '), index: m.index!, raw });
  }
  const wa = find(text, 'whatsapp');
  if (phones.length) {
    const nearWa = wa >= 0 ? phones.find((p) => Math.abs(p.index - wa) < 45) : undefined;
    const main = phones.find((p) => p !== nearWa) ?? phones[0];
    facts.phone = { value: main.value, evidence: main.raw };
    if (nearWa) facts.whatsapp = { value: nearWa.value, evidence: excerpt(text, Math.min(wa, nearWa.index), Math.abs(nearWa.index - wa) + nearWa.raw.length, 2) };
    else if (wa >= 0 && !negated(text, wa)) facts.whatsapp = { value: main.value, evidence: excerpt(text, wa, 8) };
  }
  const web = /\b((?:https?:\/\/|www\.)[^\s,;]+\.[a-z]{2,}[^\s,;]*)/i.exec(text);
  if (web) facts.website = { value: web[1].startsWith('http') ? web[1] : `https://${web[1]}`, evidence: web[1] };
}

function extractLocation(text: string, facts: Facts) {
  let cityIdx = -1;
  for (const c of [...CITIES].sort((a, b) => b.name.length - a.name.length)) {
    const i = find(text, c.name);
    if (i >= 0) { facts.city = { value: c.name, evidence: text.slice(i, i + c.name.length) }; facts.country = c.country; cityIdx = i; break; }
  }
  const cut = (s: string) => s.replace(/\s+(?:and|we|where|with|phone|call|email|open|opening|serving|which|our|my|contact)\b.*$/i, '').replace(/[\s,.;:-]+$/, '').trim();
  const explicit = /\b(?:address(?: is)?|located at|located in|we are at|we're at|find us at|situated (?:at|in)|visit us at|location)\s*[:\-]?\s*([^\n.!?]{4,140})/i.exec(text);
  if (explicit) { facts.address = { value: cut(explicit[1]), evidence: explicit[0].trim() }; return; }
  const street = /\b(?:(?:shop|office|house|plot|flat|suite|unit|building)\s*(?:no\.?|#)?\s*)?\d+[\w\-/]*,?\s+[^\n.!?]{0,60}?\b(?:road|rd|street|st|avenue|ave|block|lane|plaza|mall|market|sector|phase|town|boulevard|blvd|chowk|bazaar|bazar|colony|society)\b[^\n.!?]{0,60}/i.exec(text);
  if (street) { facts.address = { value: cut(street[0]), evidence: street[0].trim() }; return; }
  if (cityIdx >= 0) {
    // "in Gulberg, Lahore" → keep the area names in front of the city
    const before = text.slice(Math.max(0, cityIdx - 50), cityIdx);
    const area = /\b(?:in|at|near)\s+((?:[A-Z0-9][\w-]*[\s,]+){1,5})$/.exec(before);
    const value = area ? `${area[1].trim().replace(/,$/, '')}, ${facts.city!.value}`.replace(/,\s*,/g, ',') : facts.city!.value;
    facts.address = { value, evidence: (area ? area[0] : '') + facts.city!.value };
  }
}

// --- opening hours

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_RE = '(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)s?';
const dayIndex = (s: string) => ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(s.slice(0, 3).toLowerCase());
const TIME = '(noon|midnight|\\d{1,2}(?:[:.]\\d{2})?\\s*(?:am|pm|a\\.m\\.|p\\.m\\.)?)';
const RANGE_RE = new RegExp(`${TIME}\\s*(?:-|–|to|till|until|through)\\s*${TIME}`, 'gi');

function parseTime(raw: string, role: 'open' | 'close'): string | null {
  const s = raw.toLowerCase().replace(/\./g, (m, i, str) => (/\d/.test(str[i - 1] ?? '') && /\d/.test(str[i + 1] ?? '') ? ':' : '')).replace(/\s+/g, '');
  if (s === 'noon') return '12:00';
  if (s === 'midnight') return '00:00';
  const m = /^(\d{1,2})(?::(\d{2}))?(am|pm)?$/.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ?? '00';
  if (h > 23 || Number(min) > 59) return null;
  const suffix = m[3];
  if (suffix === 'am') h = h === 12 ? 0 : h;
  else if (suffix === 'pm') h = h === 12 ? 12 : h + 12;
  else if (!m[2] || h <= 12) {
    if (role === 'open') h = h >= 7 && h <= 11 ? h : h === 12 ? 12 : h + 12 > 23 ? h : h <= 6 ? h + 12 : h;
    else h = h === 12 ? 0 : h >= 6 && h <= 11 ? h + 12 : h;
  }
  return `${String(h % 24).padStart(2, '0')}:${min}`;
}

function daysFrom(spec: string): number[] | null {
  const s = spec.toLowerCase();
  if (/(every ?day|daily|7 days|all week|seven days|everyday|all days)/.test(s)) return [0, 1, 2, 3, 4, 5, 6];
  if (/weekdays?/.test(s)) return [0, 1, 2, 3, 4];
  if (/weekends?/.test(s)) return [5, 6];
  const range = new RegExp(`${DAY_RE}\\s*(?:-|–|to|through|till)\\s*${DAY_RE}`, 'i').exec(spec);
  if (range) {
    const a = dayIndex(range[1]), b = dayIndex(range[2]);
    if (a >= 0 && b >= 0) { const out: number[] = []; for (let i = a; ; i = (i + 1) % 7) { out.push(i); if (i === b || out.length > 7) break; } return out; }
  }
  const singles = [...spec.matchAll(new RegExp(`\\b${DAY_RE}\\b`, 'gi'))].map((m) => dayIndex(m[1])).filter((i) => i >= 0);
  return singles.length ? Array.from(new Set(singles)) : null;
}

function extractHours(text: string, facts: Facts) {
  const rows: HoursRow[] = DAY_NAMES.map((day) => ({ day, open: '09:00', close: '18:00', closed: false }));
  const set = new Set<number>();
  const evidence: string[] = [];
  let lastEnd = 0;
  for (const m of text.matchAll(RANGE_RE)) {
    const strong = /am|pm|noon|midnight|[:.]\d/i.test(m[0]);
    const ctx = text.slice(Math.max(lastEnd, m.index! - 45), m.index!);
    if (!strong && !/(open|timing|hours|from|daily|every ?day|mon|tue|wed|thu|fri|sat|sun)/i.test(ctx)) continue;
    if (/(guests|people|persons|rs|pkr|\$|£)\s*$/i.test(ctx)) continue;
    const open = parseTime(m[1], 'open'), close = parseTime(m[2], 'close');
    if (!open || !close) continue;
    const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + 40);
    const days = daysFrom(ctx) ?? (/^\s*(?:,|on)?\s*(every ?day|daily|7 days|weekdays|weekends|mon|tue|wed|thu|fri|sat|sun)/i.test(after) ? daysFrom(after.slice(0, 30)) : null) ?? (set.size ? null : [0, 1, 2, 3, 4, 5, 6]);
    if (!days) continue;
    for (const d of days) { rows[d] = { day: DAY_NAMES[d], open, close, closed: false }; set.add(d); }
    evidence.push(excerpt(text, m.index!, m[0].length, 22));
    lastEnd = m.index! + m[0].length;
  }
  for (const m of text.matchAll(new RegExp(`closed\\s+(?:on\\s+)?(?:every\\s+)?${DAY_RE}|${DAY_RE}\\s*(?:closed|off|holiday)`, 'gi'))) {
    const d = dayIndex((m[1] ?? m[2])!);
    if (d >= 0) { rows[d] = { ...rows[d], closed: true }; set.add(d); evidence.push(m[0]); }
  }
  if (/\b(24\/7|24 hours|open 24|round the clock)\b/i.test(text)) {
    for (let d = 0; d < 7; d++) rows[d] = { day: DAY_NAMES[d], open: '00:00', close: '23:59', closed: false };
    set.add(0); evidence.push('24/7');
  }
  if (set.size) facts.hours = { value: rows, evidence: evidence.join(' · ') };
}

// --- menu / priced items

const CUR_PRE = '(rs\\.?|pkr|usd|aed|sar|inr|\\$|£|€|₹)';
const CUR_POST = '(rs\\.?|pkr|rupees|\\/-|usd|aed|sar|dollars|euros?|pounds?)';
const ITEM_RE = new RegExp(`^(.*?)[\\s:=@–-]*(?:(?:for|at|is|costs?|price)\\s+)?(?:${CUR_PRE}\\s?(\\d+(?:\\.\\d{1,2})?)|(\\d+(?:\\.\\d{1,2})?)\\s?${CUR_POST})(?![\\p{L}\\p{N}])(.*)$`, 'iu');
const ITEM_LEAD = /^(?:.*:\s*)?(?:(?:our|the|full)\s+)?(?:menu|items?|dishes|prices?|price list|services?|packages?)?\s*(?:includes?|including|has|have|are|is)?\s*(?:we\s+(?:serve|have|offer|sell|do)|serving|like|such as|e\.g\.?|for example)?\s*/i;

function formatPrice(num: string, cur?: { symbol: string }): string {
  const n = Number(num);
  const pretty = Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : num;
  const sym = cur?.symbol ?? '';
  if (!sym) return pretty;
  return /^[A-Za-z]/.test(sym) ? `${sym} ${pretty}` : `${sym}${pretty}`;
}

function currencyFromToken(tok?: string) {
  if (!tok) return undefined;
  return CURRENCY_WORDS.find((c) => c.words.test(tok));
}

export function menuCategory(name: string): string | undefined {
  const lower = name.toLowerCase();
  return MENU_CATEGORIES.find((c) => c.words.some((w) => find(lower, w) >= 0))?.category;
}

function extractPricedItems(text: string, facts: Facts) {
  const normal = text.replace(/(\d),(\d{3})\b/g, '$1$2');
  const chunks = normal.split(/\n|;|,|•|·|\||\s\band\b\s|\.\s+(?=[A-Z])|!\s+|\?\s+/i);
  for (const chunk of chunks) {
    const m = ITEM_RE.exec(chunk.trim());
    if (!m) continue;
    let name = m[1].replace(ITEM_LEAD, '').replace(/^(?:a|an|the|one|1)\s+/i, '').replace(/[\s\-–:=@(]+$/, '').trim();
    const parens = /\(([^)]{2,60})\)/.exec(name + ' ' + (m[6] ?? ''));
    name = name.replace(/\([^)]*\)/g, '').trim();
    if (!name || !/\p{L}/u.test(name) || name.length > 45 || name.split(/\s+/).length > 6) continue;
    if (/@|https?:|\b(delivery|charges?|fee|discount|minimum|per person|guests?|budget|salary|rent|deposit)\b/i.test(name)) continue;
    const cur = currencyFromToken(m[2] ?? m[5]);
    if (cur && !facts.currency) facts.currency = { value: { code: cur.code, symbol: cur.symbol }, evidence: (m[2] ?? m[5])! };
    facts.pricedItems.push({
      value: { name: titleCase(name), price: formatPrice((m[3] ?? m[4])!, cur ?? facts.currency?.value), description: parens?.[1]?.trim() },
      evidence: chunk.trim(),
    });
  }
}

function extractListedItems(text: string, facts: Facts) {
  const m = /\b(?:we serve|we offer|we provide|we sell|we do|serving|specialities|specialties|famous for|known for|specialise in|specialize in|services include|services are|services:|our menu (?:has|includes)|menu:|dishes:|products:)\s+([^.\n!?]{3,220})/i.exec(text);
  if (!m) return;
  const items = splitList(m[1].replace(/\b(?:and more|etc\.?|many more|much more)\b/gi, '').replace(/(\d),(\d{3})\b/g, '$1$2'))
    .map((s) => s.replace(/^(?:a|an|the|our|best|delicious|tasty|fresh|authentic)\s+/i, '').replace(/\s*(?:rs\.?|pkr|\$|£|€)\s*\d+.*$/i, '').trim())
    .filter((s) => s && !/\d{3,}/.test(s) && !/^(food|people|customers|clients|you|everyone)$/i.test(s));
  if (items.length) facts.listedItems = { value: Array.from(new Set(items.map(titleCase))).slice(0, 12), evidence: m[0].trim() };
}

// --- misc

function extractStats(text: string, facts: Facts) {
  const re = /(\d[\d,]*)\s*(\+)?\s*(?:happy\s+|satisfied\s+|successful\s+|completed\s+)?(clients|customers|projects|employees|staff|countries|cities|branches|offices|years(?: of experience)?|products|students|members|deliveries|outlets|stores)\b/gi;
  for (const m of text.matchAll(re)) {
    if (/^years/i.test(m[3]) && Number(m[1].replace(/,/g, '')) > 150) continue;
    const label = m[3].replace(/\b\w/g, (c) => c.toUpperCase()).replace(/ Of /, ' of ');
    facts.stats.push({ value: { value: `${m[1]}${m[2] ?? '+'}`, label: /^Years$/.test(label) ? 'Years of experience' : label }, evidence: m[0] });
  }
  const f = /\b(?:since|founded(?: in)?|established(?: in)?|est\.?|started(?: in)?)\s+((?:18|19|20)\d{2})\b/i.exec(text);
  if (f) facts.founded = { value: Number(f[1]), evidence: f[0] };
  const e = /\b(\d{1,6})\s*\+?\s*(?:employees|staff members|staff|people work|workers|team members|users|people in (?:my|our) team)\b/i.exec(text) ?? /\b(?:team|staff) of (\d{1,6})\b/i.exec(text);
  if (e) facts.employees = { value: Number(e[1]), evidence: e[0] };
}

function extractBranding(text: string, facts: Facts) {
  const names = Object.keys(COLOURS).sort((a, b) => b.length - a.length);
  const taken: [number, number][] = [];
  const found: { i: number; name: string }[] = [];
  for (const n of names) {
    for (const i of findAll(text, n)) {
      if (taken.some(([a, b]) => i >= a && i < b)) continue;
      const near = text.slice(i, i + 40).toLowerCase() + text.slice(Math.max(0, i - 40), i).toLowerCase();
      if (!/(colou?r|theme|shade|tone|brand|palette|look|design|scheme)/.test(near)) continue;
      taken.push([i, i + n.length]);
      found.push({ i, name: n });
    }
  }
  found.sort((a, b) => a.i - b.i);
  for (const fd of found) facts.colours.push({ value: COLOURS[fd.name], evidence: excerpt(text, fd.i, fd.name.length, 10) });
  const hex = text.match(/#[0-9a-f]{6}\b/gi) ?? [];
  for (const h of hex) facts.colours.push({ value: h.toUpperCase(), evidence: h });
  const moodHits: { i: number; theme: string; w: string }[] = [];
  for (const mood of MOODS) for (const w of mood.words) {
    const i = find(text, w);
    if (i >= 0 && !negated(text, i)) { moodHits.push({ i, theme: mood.theme, w }); break; }
  }
  for (const h of moodHits.sort((a, b) => a.i - b.i)) facts.moods.push({ value: h.theme, evidence: excerpt(text, h.i, h.w.length, 10) });
  const tl = /\b(?:tagline|slogan|motto)\s*(?:is|:|-)?\s*["“]?([^"”\n]{3,110}?)["”]?(?=$|\n|["”]|\.\s)/i.exec(text);
  if (tl) facts.tagline = { value: tl[1].trim(), evidence: tl[0].trim() };
  const ab = /\b(?:about us|about me|about the business|description)\s*[:\-]\s*([^\n]{20,900})/i.exec(text);
  if (ab) facts.about = { value: ab[1].trim(), evidence: ab[0].slice(0, 80) + '…' };
  const big = /\b(full[- ]?screen|big|large|huge)\s+(photo|image|picture|banner)/i.exec(text);
  if (big) facts.wantsLarge = { value: true, evidence: big[0] };
}

const ROLE_WORDS: Record<string, string[]> = {
  sales_manager: ['sales manager', 'sales head'],
  sales_rep: ['sales rep', 'sales reps', 'salesman', 'salesmen', 'salespeople', 'sales team', 'sales staff', 'sales officers'],
  support: ['support', 'customer service', 'support team'],
  viewer: ['read only', 'read-only', 'view only', 'viewer'],
  manager: ['manager', 'operations manager', 'store manager'],
  inventory_clerk: ['store keeper', 'storekeeper', 'warehouse staff', 'inventory clerk', 'stock keeper'],
  sales_staff: ['sales staff', 'cashier', 'cashiers', 'salesman', 'salesmen', 'counter staff'],
  purchaser: ['purchaser', 'purchase officer', 'procurement', 'buyer'],
  accountant: ['accountant', 'accountants', 'accounts team', 'bookkeeper'],
  hr_manager: ['hr manager', 'hr team', 'hr person', 'hr'],
};

function extractWorkspace(text: string, facts: Facts) {
  for (const [key, words] of Object.entries(MODULE_WORDS)) for (const w of words) {
    const i = find(text, w);
    if (i >= 0 && !negated(text, i)) { facts.modulesMentioned[key] = excerpt(text, i, w.length, 12); break; }
  }
  for (const [key, words] of Object.entries(ROLE_WORDS)) for (const w of words) {
    const i = find(text, w);
    if (i >= 0) { facts.roleWords[key] = excerpt(text, i, w.length, 10); break; }
  }
  const st = /\b(?:stages|pipeline|steps)\s*(?:are|is|:|like|such as|include|includes|go(?:es)?)?\s*:?\s*([^.\n!?]{5,220})/i.exec(text);
  if (st) {
    const list = splitList(st[1]).map(titleCase);
    if (list.length >= 2) facts.pipelineStages = { value: list.slice(0, 10), evidence: st[0].trim() };
  }
  if (find(text, 'leads') >= 0 || find(text, 'lead') >= 0 || find(text, 'customers come from') >= 0 || find(text, 'clients come from') >= 0) {
    const src = LEAD_SOURCES.filter((s) => find(text, s) >= 0 || (s === 'Referral' && find(text, 'referrals') >= 0) || (s === 'Walk-in' && find(text, 'walk in') >= 0));
    if (src.length) facts.leadSources = { value: src, evidence: src.join(', ') };
  }
  if (find(text, 'department') >= 0 || find(text, 'departments') >= 0) {
    const d = /\bdepartments?\s*(?:are|is|:|like|such as|include|includes)?\s*:?\s*([^.\n!?]{3,200})/i.exec(text);
    const list = d ? splitList(d[1]).map(titleCase) : [];
    const known = DEPARTMENTS.filter((x) => find(text, x) >= 0);
    const value = list.length >= 2 ? list : known;
    if (value.length) facts.departments = { value: value.slice(0, 15), evidence: d?.[0].trim() ?? value.join(', ') };
  }
}

function extractPortfolio(text: string, facts: Facts) {
  const r = new RegExp(`\\b(?:i am an?|i'm an?|im an?|work as an?|working as an?|i am a freelance|freelance)\\s+((?:[\\w-]+\\s+){0,3}?(?:${PORTFOLIO_ROLES.map(esc).join('|')}))\\b`, 'i').exec(text);
  if (r) facts.role = { value: titleCase(r[1].replace(/^(freelance|professional)\s+/i, (x) => x)), evidence: r[0] };
  else {
    const role = PORTFOLIO_ROLES.find((x) => find(text, x) >= 0);
    if (role) facts.role = { value: titleCase(role), evidence: role };
  }
  const sk = /\b(?:skills?|tools|expertise|i (?:work|am skilled|am good) (?:with|in)|i use|proficient in)\s*(?:are|is|:|include|includes)?\s*:?\s*([^.\n!?]{3,220})/i.exec(text);
  const tools = ['Photoshop', 'Illustrator', 'InDesign', 'Figma', 'Sketch', 'Lightroom', 'After Effects', 'Premiere Pro', 'Final Cut Pro', 'DaVinci Resolve', 'Canva', 'Blender', 'AutoCAD', 'SketchUp', '3ds Max', 'React', 'Next.js', 'Node.js', 'TypeScript', 'JavaScript', 'Python', 'Django', 'Laravel', 'PHP', 'WordPress', 'Shopify', 'Flutter', 'Swift', 'Kotlin', 'SQL', 'Excel', 'Power BI'];
  const fromList = sk ? splitList(sk[1]).map(titleCase) : [];
  const known = tools.filter((t) => find(text, t) >= 0);
  const skills = Array.from(new Set([...fromList, ...known])).slice(0, 16);
  if (skills.length) facts.skills = { value: skills, evidence: sk?.[0].trim() ?? known.join(', ') };
}

// ------------------------------------------------------------------ main

export function extractFacts(text: string): Facts {
  const facts: Facts = { cuisineTags: [], pricedItems: [], stats: [], colours: [], moods: [], featuresOn: {}, featuresOff: {}, modulesMentioned: {}, roleWords: {}, sentences: sentencesOf(text) };
  if (!text.trim()) return facts;

  extractContact(text, facts);
  extractName(text, facts);
  extractLocation(text, facts);
  extractHours(text, facts);
  extractPricedItems(text, facts);
  extractListedItems(text, facts);
  extractStats(text, facts);
  extractBranding(text, facts);
  extractWorkspace(text, facts);
  extractPortfolio(text, facts);

  const cuisines: string[] = [];
  let cuisineEvidence = '';
  for (const c of CUISINES) {
    const w = c.words.find((x) => find(text, x) >= 0);
    if (w) {
      cuisines.push(c.label);
      if (!facts.cuisineTags.includes(c.tag)) facts.cuisineTags.push(c.tag);
      cuisineEvidence ||= excerpt(text, find(text, w), w.length, 8);
    }
  }
  if (cuisines.length) facts.cuisines = { value: cuisines.slice(0, 3), evidence: cuisineEvidence };

  let bestKind: { k: BusinessKind; i: number; w: string } | undefined;
  for (const k of BUSINESS_KINDS) for (const w of k.words) {
    const i = find(text, w);
    if (i >= 0 && (!bestKind || i < bestKind.i)) bestKind = { k, i, w };
  }
  if (bestKind) facts.kind = { value: bestKind.k, evidence: excerpt(text, bestKind.i, bestKind.w.length, 8) };
  for (const t of INDUSTRY_TYPES) {
    const w = t.words.find((x) => find(text, x) >= 0);
    if (w) { facts.businessType = { value: t.type, evidence: w }; break; }
  }

  const agency: string[] = [];
  for (const [service, words] of Object.entries(AGENCY_SERVICE_WORDS)) if (words.some((w) => find(text, w) >= 0)) agency.push(service);
  if (agency.length) facts.agencyServices = { value: agency, evidence: agency.join(', ') };

  const guests = /\b(?:up to|max(?:imum)?(?: of)?|groups? of(?: up to)?|parties of(?: up to)?)\s+(\d{1,3})\s*(?:guests|people|persons|pax|seats)/i.exec(text);
  if (guests) facts.maxGuests = { value: Math.min(100, Math.max(1, Number(guests[1]))), evidence: guests[0] };

  if (!facts.currency) {
    const c = CURRENCY_WORDS.find((x) => x.words.test(text));
    if (c) facts.currency = { value: { code: c.code, symbol: c.symbol }, evidence: (c.words.exec(text) ?? [''])[0] };
    else if (facts.country && COUNTRY_CURRENCY[facts.country]) facts.currency = { value: COUNTRY_CURRENCY[facts.country], evidence: facts.city!.value };
  }

  for (const [key, words] of Object.entries(FEATURE_WORDS)) for (const w of words) {
    const i = find(text, w);
    if (i < 0) continue;
    if (negated(text, i)) facts.featuresOff[key] = excerpt(text, i, w.length, 14);
    else facts.featuresOn[key] = excerpt(text, i, w.length, 12);
    break;
  }
  return facts;
}

/** Read a description: pick the best-matching template and extract every fact we can. */
export function analyseDescription(text: string, available?: string[], forcedKey?: string): Analysis {
  const scores = scoreTemplates(text, available);
  const top = scores[0];
  const second = scores[1];
  const templateKey = forcedKey && (!available || available.includes(forcedKey)) ? forcedKey : top && top.score > 0 ? top.key : (available?.includes('website-business') || !available ? 'website-business' : available[0]);
  const confidence: Analysis['confidence'] = forcedKey ? 'high' : !top || top.score < 3 ? 'low' : top.score >= 6 && (!second || top.score - second.score >= 2) ? 'high' : 'medium';
  return { text, scores, templateKey, confidence, facts: extractFacts(text) };
}
