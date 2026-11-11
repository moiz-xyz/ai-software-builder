import type { ThemeDef } from './types';

/** Built-in theme library. Admins can add more in the DB (Theme table). */
export const THEMES: ThemeDef[] = [
  {
    key: 'classic',
    name: 'Classic Light',
    tokens: { background: '#ffffff', surface: '#f6f6f4', text: '#1c1c1c', muted: '#6b6b6b', primary: '#1f4e79', secondary: '#e8eef5', accent: '#c9a227', radius: '8px', heading: 'serif', dark: false },
  },
  {
    key: 'modern',
    name: 'Modern Clean',
    tokens: { background: '#ffffff', surface: '#f4f5f7', text: '#111827', muted: '#6b7280', primary: '#2563eb', secondary: '#eff6ff', accent: '#f59e0b', radius: '14px', heading: 'sans', dark: false },
  },
  {
    key: 'midnight',
    name: 'Midnight',
    tokens: { background: '#0e1116', surface: '#171b22', text: '#f1f3f5', muted: '#9aa3ad', primary: '#7c9cff', secondary: '#1f2530', accent: '#ffb86b', radius: '12px', heading: 'sans', dark: true },
  },
  {
    key: 'warm',
    name: 'Warm Bistro',
    tokens: { background: '#fffaf3', surface: '#f7ecdc', text: '#2b1d14', muted: '#7a6352', primary: '#b4472b', secondary: '#f3e2cc', accent: '#3f6b4a', radius: '6px', heading: 'serif', dark: false },
  },
  {
    key: 'bold',
    name: 'Bold Studio',
    tokens: { background: '#fafafa', surface: '#ececec', text: '#0a0a0a', muted: '#555555', primary: '#ff4d2e', secondary: '#111111', accent: '#3b82f6', radius: '0px', heading: 'display', dark: false },
  },
  {
    key: 'minimal',
    name: 'Minimal Mono',
    tokens: { background: '#ffffff', surface: '#f7f7f7', text: '#141414', muted: '#7a7a7a', primary: '#141414', secondary: '#f0f0f0', accent: '#8a8a8a', radius: '2px', heading: 'mono', dark: false },
  },
  {
    key: 'fresh',
    name: 'Fresh Green',
    tokens: { background: '#f8fbf8', surface: '#eaf4ec', text: '#14261a', muted: '#5d7363', primary: '#1f7a4c', secondary: '#dcefe2', accent: '#e0a526', radius: '10px', heading: 'sans', dark: false },
  },
];

export const FONTS = ['Inter', 'Poppins', 'Playfair Display', 'Lora', 'Montserrat', 'Roboto', 'JetBrains Mono'] as const;

export function getTheme(key: string, extra: ThemeDef[] = []): ThemeDef {
  return [...extra, ...THEMES].find((t) => t.key === key) ?? THEMES[0];
}
