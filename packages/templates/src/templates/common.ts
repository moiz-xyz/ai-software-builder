import type { FormField, FormSection, RoleDef } from '../types';

export const f = (key: string, label: string, type: FormField['type'], bind: string, extra: Partial<FormField> = {}): FormField => ({
  key, label, type, bind, ...extra,
});

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DEFAULT_HOURS = DAYS.map((day) => ({ day, open: '09:00', close: '18:00', closed: day === 'Sunday' }));

export function businessSection(nameLabel = 'Business name', extra: FormField[] = []): FormSection {
  return {
    key: 'business',
    title: 'Business details',
    fields: [
      f('businessName', nameLabel, 'text', 'business.name', { required: true, maxLength: 80 }),
      f('tagline', 'Tagline', 'text', 'business.tagline', { maxLength: 120, placeholder: 'A short line shown in the hero' }),
      f('description', 'Business description', 'textarea', 'business.description', { required: true, maxLength: 2000 }),
      ...extra,
    ],
  };
}

export function contactSection(extra: FormField[] = []): FormSection {
  return {
    key: 'contact',
    title: 'Contact information',
    fields: [
      f('email', 'Email', 'email', 'business.email', { required: true }),
      f('phone', 'Phone number', 'phone', 'business.phone', { required: true }),
      f('address', 'Address', 'textarea', 'business.address', { maxLength: 300 }),
      ...extra,
    ],
  };
}

export function brandingSection(extra: FormField[] = []): FormSection {
  return {
    key: 'branding',
    title: 'Branding & design',
    description: 'Upload your logo and pick colours, a theme and a layout variation supported by this template.',
    fields: [
      f('logo', 'Logo', 'image', 'branding.logo'),
      f('theme', 'Theme', 'theme', 'branding.theme', { required: true }),
      f('layout', 'Design variation', 'layout', 'branding.layout', { required: true }),
      f('font', 'Font', 'font', 'branding.font'),
      f('primaryColor', 'Primary colour', 'color', 'branding.primaryColor'),
      f('secondaryColor', 'Secondary colour', 'color', 'branding.secondaryColor'),
      f('accentColor', 'Accent colour', 'color', 'branding.accentColor'),
      ...extra,
    ],
  };
}

export const featuresSection = (title = 'Features'): FormSection => ({
  key: 'features',
  title,
  description: 'Only features supported by this template can be enabled.',
  fields: [f('features', 'Features', 'features', 'features')],
});

export const modulesSection: FormSection = {
  key: 'modules',
  title: 'Modules & users',
  description: 'Choose the modules and user roles for your workspace.',
  fields: [
    f('modules', 'Modules', 'modules', 'modules', { required: true }),
    f('roles', 'User roles', 'roles', 'roles', { required: true }),
  ],
};

export const BUSINESS_TYPES = [
  'Retail', 'Wholesale / Distribution', 'Manufacturing', 'Services', 'Professional services',
  'Real estate', 'Healthcare', 'Education', 'Hospitality', 'Technology', 'Other',
].map((v) => ({ value: v, label: v }));

export const CRM_ROLES: RoleDef[] = [
  { key: 'admin', name: 'Administrator', permissions: ['*'] },
  { key: 'sales_manager', name: 'Sales manager', permissions: ['contacts:*', 'leads:*', 'deals:*', 'tasks:*', 'reports:read'] },
  { key: 'sales_rep', name: 'Sales representative', permissions: ['contacts:read', 'contacts:write', 'leads:read', 'leads:write', 'deals:read', 'deals:write', 'tasks:*'] },
  { key: 'support', name: 'Support agent', permissions: ['contacts:read', 'tasks:*'] },
  { key: 'viewer', name: 'Read only', permissions: ['*:read'] },
];

export const ERP_ROLES: RoleDef[] = [
  { key: 'admin', name: 'Administrator', permissions: ['*'] },
  { key: 'manager', name: 'Operations manager', permissions: ['inventory:*', 'sales:*', 'purchases:*', 'reports:read'] },
  { key: 'inventory_clerk', name: 'Inventory clerk', permissions: ['inventory:*', 'purchases:read'] },
  { key: 'sales_staff', name: 'Sales staff', permissions: ['sales:*', 'inventory:read'] },
  { key: 'purchaser', name: 'Purchasing officer', permissions: ['purchases:*', 'inventory:read'] },
  { key: 'accountant', name: 'Accountant', permissions: ['accounting:*', 'sales:read', 'purchases:read', 'reports:read'] },
  { key: 'hr_manager', name: 'HR manager', permissions: ['hr:*'] },
  { key: 'viewer', name: 'Read only', permissions: ['*:read'] },
];

export const WEBSITE_LAYOUTS = [
  { key: 'centered', label: 'Centered hero', description: 'Large centered headline over the hero image.' },
  { key: 'split', label: 'Split hero', description: 'Text on the left, image on the right.' },
  { key: 'fullbleed', label: 'Full-bleed', description: 'Edge-to-edge imagery with overlay navigation.' },
];

export const WORKSPACE_LAYOUTS = [
  { key: 'sidebar', label: 'Sidebar navigation', description: 'Modules listed in a left sidebar.' },
  { key: 'topbar', label: 'Top navigation', description: 'Modules listed in a top bar.' },
];

export const ALL_FONTS = ['Inter', 'Poppins', 'Playfair Display', 'Lora', 'Montserrat', 'Roboto', 'JetBrains Mono'];
