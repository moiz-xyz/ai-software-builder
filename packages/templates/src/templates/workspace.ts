import type { FormSection, TemplateDefinition } from '../types';
import { ALL_FONTS, BUSINESS_TYPES, CRM_ROLES, ERP_ROLES, WORKSPACE_LAYOUTS, f, featuresSection, modulesSection } from './common';

const workspaceBranding: FormSection = {
  key: 'branding',
  title: 'Branding',
  fields: [
    f('logo', 'Logo', 'image', 'branding.logo'),
    f('theme', 'Theme', 'theme', 'branding.theme', { required: true }),
    f('layout', 'Navigation style', 'layout', 'branding.layout', { required: true }),
    f('font', 'Font', 'font', 'branding.font'),
    f('primaryColor', 'Primary colour', 'color', 'branding.primaryColor'),
    f('accentColor', 'Accent colour', 'color', 'branding.accentColor'),
  ],
};

const companySection = (extra = [] as FormSection['fields']): FormSection => ({
  key: 'company',
  title: 'Company',
  fields: [
    f('companyName', 'Company name', 'text', 'business.name', { required: true, maxLength: 80 }),
    f('businessType', 'Business type', 'select', 'business.businessType', { required: true, options: BUSINESS_TYPES }),
    f('employees', 'Number of employees', 'number', 'business.employees', { required: true, min: 1, max: 100000 }),
    f('email', 'Company email', 'email', 'business.email', { required: true }),
    f('phone', 'Phone', 'phone', 'business.phone'),
    f('description', 'Short description', 'textarea', 'business.description', { maxLength: 1000 }),
    ...extra,
  ],
});

const CURRENCIES = ['USD', 'EUR', 'GBP', 'PKR', 'AED', 'SAR', 'INR'].map((c) => ({ value: c, label: c }));

// ------------------------------------------------------------------ CRM
const crmFeatures = [
  { key: 'pipelineBoard', label: 'Kanban pipeline board', description: 'Drag-style board view of deals by stage.', default: true },
  { key: 'leadConversion', label: 'Lead → contact/deal conversion', description: 'One click converts a qualified lead.', default: true },
  { key: 'dashboard', label: 'Dashboard & reports', default: true },
  { key: 'leadScoring', label: 'Lead scoring', description: 'Numeric score on every lead, sortable.' },
];

const crmPipeline: FormSection = {
  key: 'pipeline',
  title: 'Pipeline preferences',
  fields: [
    f('pipelineStages', 'Pipeline stages', 'list', 'content.pipelineStages', { help: 'One stage per line, in order.' }),
    f('leadSources', 'Lead sources', 'list', 'content.leadSources', { help: 'One per line.' }),
    f('currency', 'Currency', 'select', 'content.currency', { options: CURRENCIES }),
  ],
};

const crmBase = (key: string, name: string, description: string, modules: string[], requiredModules: string[], defaultModules: string[]): TemplateDefinition => ({
  key,
  name,
  category: 'CRM',
  renderer: 'workspace',
  description,
  previewImages: [],
  features: crmFeatures,
  modules,
  requiredModules,
  sections: [],
  themes: ['modern', 'classic', 'midnight', 'fresh'],
  defaultTheme: 'modern',
  fonts: ALL_FONTS,
  layoutVariants: WORKSPACE_LAYOUTS,
  roles: CRM_ROLES,
  formSchema: [companySection(), modulesSection, crmPipeline, workspaceBranding, featuresSection('CRM features')],
  defaults: {
    modules: defaultModules,
    features: ['pipelineBoard', 'dashboard', 'leadConversion'],
    content: {
      pipelineStages: ['New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'],
      leadSources: ['Website', 'Referral', 'Social', 'Cold call', 'Event'],
      currency: 'USD',
    },
    branding: { theme: 'modern', layout: 'sidebar', font: 'Inter' },
  },
});

export const basicCrm = crmBase('crm-basic', 'Basic CRM', 'Simple contact & company database with tasks — perfect for small teams starting out.', ['contacts', 'tasks', 'deals'], ['contacts'], ['contacts', 'tasks']);
export const salesCrm = crmBase('crm-sales', 'Sales CRM', 'Pipeline-driven CRM with deals board, contacts, follow-up tasks and sales reports.', ['contacts', 'deals', 'tasks', 'leads'], ['contacts', 'deals'], ['contacts', 'deals', 'tasks']);
export const leadCrm = crmBase('crm-leads', 'Lead Management CRM', 'Capture, score, qualify and convert leads into contacts and deals.', ['leads', 'contacts', 'deals', 'tasks'], ['leads'], ['leads', 'contacts', 'deals']);
leadCrm.defaults.features = ['leadConversion', 'leadScoring', 'dashboard', 'pipelineBoard'];

// ------------------------------------------------------------------ ERP
const erpFeatures = [
  { key: 'dashboard', label: 'Dashboard & reports', default: true },
  { key: 'lowStockAlerts', label: 'Low-stock alerts', description: 'Highlights products at or below their reorder level.', default: true },
  { key: 'autoStockOnSale', label: 'Auto stock-out on fulfilment', description: 'Fulfilling a sales order reduces stock.', default: true },
  { key: 'autoStockOnPurchase', label: 'Auto stock-in on receipt', description: 'Receiving a purchase order increases stock.', default: true },
  { key: 'autoInvoice', label: 'Auto invoice on fulfilment', description: 'Creates an invoice when a sales order is fulfilled.', requires: ['autoStockOnSale'] },
];

const erpRequirements: FormSection = {
  key: 'requirements',
  title: 'Operational requirements',
  description: 'These answers configure your modules. Free-text needs go in “Additional instructions”.',
  fields: [
    f('currency', 'Currency', 'select', 'content.currency', { required: true, options: CURRENCIES }),
    f('inventoryNotes', 'Inventory requirements', 'textarea', 'content.requirements.inventory', { maxLength: 1000, placeholder: 'Number of products, units used, warehouses…' }),
    f('salesNotes', 'Sales requirements', 'textarea', 'content.requirements.sales', { maxLength: 1000 }),
    f('purchaseNotes', 'Purchase requirements', 'textarea', 'content.requirements.purchases', { maxLength: 1000 }),
    f('accountingNotes', 'Accounting requirements', 'textarea', 'content.requirements.accounting', { maxLength: 1000 }),
    f('hrNotes', 'Employee management requirements', 'textarea', 'content.requirements.hr', { maxLength: 1000 }),
    f('departments', 'Departments', 'list', 'content.departments', { help: 'One per line.' }),
  ],
};

const erpBase = (key: string, name: string, description: string, modules: string[], requiredModules: string[], defaultModules: string[]): TemplateDefinition => ({
  key,
  name,
  category: 'ERP',
  renderer: 'workspace',
  description,
  previewImages: [],
  features: erpFeatures,
  modules,
  requiredModules,
  sections: [],
  themes: ['classic', 'modern', 'midnight', 'fresh'],
  defaultTheme: 'classic',
  fonts: ALL_FONTS,
  layoutVariants: WORKSPACE_LAYOUTS,
  roles: ERP_ROLES,
  formSchema: [companySection(), modulesSection, erpRequirements, workspaceBranding, featuresSection('ERP features')],
  defaults: {
    modules: defaultModules,
    features: ['dashboard', 'lowStockAlerts', 'autoStockOnSale', 'autoStockOnPurchase'],
    content: { currency: 'USD', departments: ['Management', 'Sales', 'Operations', 'Finance'], requirements: {} },
    branding: { theme: 'classic', layout: 'sidebar', font: 'Inter' },
  },
});

export const basicErp = erpBase('erp-basic', 'Basic ERP', 'Core inventory, sales and invoicing for small businesses.', ['inventory', 'sales', 'accounting'], ['inventory'], ['inventory', 'sales']);
export const inventorySalesErp = erpBase('erp-inventory-sales', 'Inventory & Sales ERP', 'Stock control with purchasing and sales orders that move stock automatically.', ['inventory', 'sales', 'purchases', 'accounting'], ['inventory', 'sales'], ['inventory', 'sales', 'purchases']);
export const businessErp = erpBase('erp-business', 'Business Management ERP', 'Full suite: inventory, sales, purchasing, accounting and employee management.', ['inventory', 'sales', 'purchases', 'accounting', 'hr'], ['inventory'], ['inventory', 'sales', 'purchases', 'accounting', 'hr']);

export const CRM_TEMPLATES = [basicCrm, salesCrm, leadCrm];
export const ERP_TEMPLATES = [basicErp, inventorySalesErp, businessErp];
