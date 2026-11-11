import type { ModuleDef, EntityDef } from './types';

const contacts: EntityDef = {
  key: 'contact', label: 'Contact', plural: 'Contacts', displayField: 'name',
  listColumns: ['name', 'email', 'phone', 'company', 'status'],
  fields: [
    { key: 'name', label: 'Full name', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Phone', type: 'phone' },
    { key: 'company', label: 'Company', type: 'relation', relation: 'company' },
    { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], default: 'Active' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
};

const companies: EntityDef = {
  key: 'company', label: 'Company', plural: 'Companies', displayField: 'name',
  listColumns: ['name', 'industry', 'phone', 'website'],
  fields: [
    { key: 'name', label: 'Company name', type: 'text', required: true },
    { key: 'industry', label: 'Industry', type: 'text' },
    { key: 'phone', label: 'Phone', type: 'phone' },
    { key: 'website', label: 'Website', type: 'text' },
    { key: 'address', label: 'Address', type: 'textarea' },
  ],
};

const leads: EntityDef = {
  key: 'lead', label: 'Lead', plural: 'Leads', displayField: 'name',
  listColumns: ['name', 'email', 'source', 'status', 'score'],
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Phone', type: 'phone' },
    { key: 'source', label: 'Source', type: 'select', optionsFrom: 'content.leadSources', options: ['Website', 'Referral', 'Social', 'Cold call', 'Event'] },
    { key: 'status', label: 'Status', type: 'select', options: ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted'], default: 'New' },
    { key: 'score', label: 'Score', type: 'number', default: 0 },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  boardField: 'status',
};

const deals: EntityDef = {
  key: 'deal', label: 'Deal', plural: 'Deals', displayField: 'title',
  listColumns: ['title', 'contact', 'value', 'stage', 'closeDate'],
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'contact', label: 'Contact', type: 'relation', relation: 'contact' },
    { key: 'value', label: 'Value', type: 'money', default: 0 },
    { key: 'stage', label: 'Stage', type: 'select', optionsFrom: 'content.pipelineStages', options: ['New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'], required: true },
    { key: 'closeDate', label: 'Expected close', type: 'date' },
  ],
  boardField: 'stage',
};

const tasks: EntityDef = {
  key: 'task', label: 'Task', plural: 'Tasks', displayField: 'title',
  listColumns: ['title', 'dueDate', 'priority', 'done'],
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'dueDate', label: 'Due date', type: 'date' },
    { key: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Normal', 'High'], default: 'Normal' },
    { key: 'done', label: 'Done', type: 'boolean', default: false },
    { key: 'details', label: 'Details', type: 'textarea' },
  ],
};

const products: EntityDef = {
  key: 'product', label: 'Product', plural: 'Products', displayField: 'name',
  listColumns: ['sku', 'name', 'price', 'cost', 'quantity', 'reorderLevel'],
  fields: [
    { key: 'sku', label: 'SKU', type: 'text', required: true },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'price', label: 'Sale price', type: 'money', default: 0 },
    { key: 'cost', label: 'Cost', type: 'money', default: 0 },
    { key: 'quantity', label: 'In stock', type: 'number', default: 0 },
    { key: 'reorderLevel', label: 'Reorder level', type: 'number', default: 5 },
    { key: 'unit', label: 'Unit', type: 'select', options: ['pcs', 'kg', 'box', 'litre'], default: 'pcs' },
  ],
};

const stockMovements: EntityDef = {
  key: 'stockMovement', label: 'Stock movement', plural: 'Stock movements', displayField: 'reference',
  listColumns: ['product', 'type', 'quantity', 'reference', 'date'],
  fields: [
    { key: 'product', label: 'Product', type: 'relation', relation: 'product', required: true },
    { key: 'type', label: 'Type', type: 'select', options: ['IN', 'OUT', 'ADJUST'], required: true, default: 'IN' },
    { key: 'quantity', label: 'Quantity', type: 'number', required: true },
    { key: 'reference', label: 'Reference', type: 'text' },
    { key: 'date', label: 'Date', type: 'date' },
  ],
};

const customers: EntityDef = {
  key: 'customer', label: 'Customer', plural: 'Customers', displayField: 'name',
  listColumns: ['name', 'email', 'phone'],
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Phone', type: 'phone' },
    { key: 'address', label: 'Address', type: 'textarea' },
  ],
};

const salesOrders: EntityDef = {
  key: 'salesOrder', label: 'Sales order', plural: 'Sales orders', displayField: 'number',
  listColumns: ['number', 'customer', 'product', 'quantity', 'total', 'status'],
  fields: [
    { key: 'number', label: 'Order #', type: 'text', required: true },
    { key: 'customer', label: 'Customer', type: 'relation', relation: 'customer', required: true },
    { key: 'product', label: 'Product', type: 'relation', relation: 'product', required: true },
    { key: 'quantity', label: 'Quantity', type: 'number', required: true, default: 1 },
    { key: 'unitPrice', label: 'Unit price', type: 'money', default: 0 },
    { key: 'total', label: 'Total', type: 'money', default: 0 },
    { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Confirmed', 'Fulfilled', 'Cancelled'], default: 'Draft' },
    { key: 'date', label: 'Date', type: 'date' },
  ],
  boardField: 'status',
};

const suppliers: EntityDef = {
  key: 'supplier', label: 'Supplier', plural: 'Suppliers', displayField: 'name',
  listColumns: ['name', 'email', 'phone'],
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Phone', type: 'phone' },
    { key: 'address', label: 'Address', type: 'textarea' },
  ],
};

const purchaseOrders: EntityDef = {
  key: 'purchaseOrder', label: 'Purchase order', plural: 'Purchase orders', displayField: 'number',
  listColumns: ['number', 'supplier', 'product', 'quantity', 'total', 'status'],
  fields: [
    { key: 'number', label: 'PO #', type: 'text', required: true },
    { key: 'supplier', label: 'Supplier', type: 'relation', relation: 'supplier', required: true },
    { key: 'product', label: 'Product', type: 'relation', relation: 'product', required: true },
    { key: 'quantity', label: 'Quantity', type: 'number', required: true, default: 1 },
    { key: 'unitCost', label: 'Unit cost', type: 'money', default: 0 },
    { key: 'total', label: 'Total', type: 'money', default: 0 },
    { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Ordered', 'Received', 'Cancelled'], default: 'Draft' },
    { key: 'date', label: 'Date', type: 'date' },
  ],
  boardField: 'status',
};

const invoices: EntityDef = {
  key: 'invoice', label: 'Invoice', plural: 'Invoices', displayField: 'number',
  listColumns: ['number', 'customer', 'amount', 'dueDate', 'status'],
  fields: [
    { key: 'number', label: 'Invoice #', type: 'text', required: true },
    { key: 'customer', label: 'Customer', type: 'relation', relation: 'customer' },
    { key: 'amount', label: 'Amount', type: 'money', required: true, default: 0 },
    { key: 'dueDate', label: 'Due date', type: 'date' },
    { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Sent', 'Paid', 'Overdue'], default: 'Draft' },
  ],
};

const expenses: EntityDef = {
  key: 'expense', label: 'Expense', plural: 'Expenses', displayField: 'description',
  listColumns: ['description', 'category', 'amount', 'date'],
  fields: [
    { key: 'description', label: 'Description', type: 'text', required: true },
    { key: 'category', label: 'Category', type: 'select', options: ['Rent', 'Salaries', 'Utilities', 'Supplies', 'Marketing', 'Other'], default: 'Other' },
    { key: 'amount', label: 'Amount', type: 'money', required: true, default: 0 },
    { key: 'date', label: 'Date', type: 'date' },
  ],
};

const employees: EntityDef = {
  key: 'employee', label: 'Employee', plural: 'Employees', displayField: 'name',
  listColumns: ['name', 'position', 'department', 'email', 'salary', 'status'],
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'position', label: 'Position', type: 'text' },
    { key: 'department', label: 'Department', type: 'select', optionsFrom: 'content.departments', options: ['Management', 'Sales', 'Operations', 'Finance'] },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Phone', type: 'phone' },
    { key: 'salary', label: 'Monthly salary', type: 'money' },
    { key: 'startDate', label: 'Start date', type: 'date' },
    { key: 'status', label: 'Status', type: 'select', options: ['Active', 'On leave', 'Terminated'], default: 'Active' },
  ],
};

const inquiries: EntityDef = {
  key: 'inquiry', label: 'Inquiry', plural: 'Inquiries', displayField: 'name',
  listColumns: ['name', 'email', 'phone', 'message'],
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Phone', type: 'phone' },
    { key: 'message', label: 'Message', type: 'textarea', required: true },
  ],
};

const reservations: EntityDef = {
  key: 'reservation', label: 'Reservation', plural: 'Reservations', displayField: 'name',
  listColumns: ['name', 'phone', 'date', 'time', 'guests', 'status'],
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'phone', label: 'Phone', type: 'phone', required: true },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'time', label: 'Time', type: 'text', required: true },
    { key: 'guests', label: 'Guests', type: 'number', required: true, default: 2 },
    { key: 'status', label: 'Status', type: 'select', options: ['Pending', 'Confirmed', 'Cancelled'], default: 'Pending' },
  ],
};

/** Built-in module library. Each module groups entities that the workspace can manage. */
export const MODULES: ModuleDef[] = [
  // CRM
  { key: 'contacts', name: 'Contacts & Companies', category: 'CRM', description: 'People and organisations you do business with.', entities: [contacts, companies] },
  { key: 'leads', name: 'Lead Management', category: 'CRM', description: 'Capture, score and qualify leads.', entities: [leads] },
  { key: 'deals', name: 'Sales Pipeline', category: 'CRM', description: 'Track deals through configurable pipeline stages.', entities: [deals] },
  { key: 'tasks', name: 'Tasks & Follow-ups', category: 'CRM', description: 'To-dos and follow-up reminders.', entities: [tasks] },
  // ERP
  { key: 'inventory', name: 'Inventory', category: 'ERP', description: 'Products, stock levels and stock movements.', entities: [products, stockMovements] },
  { key: 'sales', name: 'Sales', category: 'ERP', description: 'Customers and sales orders (fulfilment reduces stock).', entities: [customers, salesOrders] },
  { key: 'purchases', name: 'Purchasing', category: 'ERP', description: 'Suppliers and purchase orders (receiving adds stock).', entities: [suppliers, purchaseOrders] },
  { key: 'accounting', name: 'Accounting', category: 'ERP', description: 'Invoices and expenses.', entities: [invoices, expenses] },
  { key: 'hr', name: 'Employees', category: 'ERP', description: 'Employee records and departments.', entities: [employees] },
  // Website data collected from published sites
  { key: 'inquiries', name: 'Contact Inquiries', category: 'WEBSITE', description: 'Messages sent from the website contact form.', entities: [inquiries] },
  { key: 'reservations', name: 'Reservations', category: 'WEBSITE', description: 'Table reservations made on the website.', entities: [reservations] },
];

export function getModule(key: string, extra: ModuleDef[] = []): ModuleDef | undefined {
  return [...extra, ...MODULES].find((m) => m.key === key);
}

/** All entities enabled by a list of module keys, de-duplicated by entity key. */
export function entitiesForModules(moduleKeys: string[], extra: ModuleDef[] = []): (EntityDef & { module: string })[] {
  const out = new Map<string, EntityDef & { module: string }>();
  for (const key of moduleKeys) {
    const mod = getModule(key, extra);
    if (!mod) continue;
    for (const e of mod.entities) if (!out.has(e.key)) out.set(e.key, { ...e, module: mod.key });
  }
  return [...out.values()];
}
