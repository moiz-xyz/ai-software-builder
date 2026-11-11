/**
 * Word lists used by the Instant Builder. Everything here is plain data:
 * extending what the builder understands means adding words, not training anything.
 */

export interface KeywordRule {
  /** Words or phrases (lower case). Phrases with spaces count double. */
  words: string[];
  weight?: number;
}

/** Keywords that point at a particular master template. */
export const TEMPLATE_KEYWORDS: Record<string, KeywordRule[]> = {
  'website-restaurant': [
    { words: ['restaurant', 'cafe', 'café', 'coffee shop', 'bakery', 'dhaba', 'eatery', 'bistro', 'diner', 'food', 'menu', 'dish', 'dishes', 'cuisine', 'chef', 'dine', 'dining', 'takeaway', 'take away', 'food delivery', 'book a table', 'table booking', 'tables', 'brunch', 'lunch', 'dinner', 'breakfast'], weight: 3 },
    { words: ['pizza', 'burger', 'biryani', 'karahi', 'nihari', 'kebab', 'kabab', 'tikka', 'bbq', 'barbecue', 'grill', 'steak', 'pasta', 'sushi', 'shawarma', 'dessert', 'desserts', 'ice cream', 'chai', 'lassi', 'naan', 'fast food', 'seafood', 'noodles'], weight: 2 },
  ],
  'website-corporate': [
    { words: ['corporation', 'corporate', 'enterprise', 'holdings', 'industries', 'headquarters', 'head office', 'leadership team', 'board of directors', 'investors', 'pvt ltd', 'pvt. ltd', 'limited', 'ltd', 'inc', 'group of companies', 'conglomerate'], weight: 3 },
    { words: ['company', 'firm', 'established', 'founded', 'since', 'consulting', 'consultancy', 'logistics', 'manufacturing', 'construction', 'engineering', 'export', 'import', 'textile', 'energy', 'clients worldwide', 'nationwide'], weight: 1.5 },
  ],
  'website-business': [
    { words: ['salon', 'barber', 'barbershop', 'spa', 'gym', 'fitness', 'clinic', 'dental', 'dentist', 'pharmacy', 'plumber', 'plumbing', 'electrician', 'repair', 'mechanic', 'workshop', 'car wash', 'cleaning', 'laundry', 'tailor', 'boutique', 'shop', 'store', 'mart', 'tuition', 'academy', 'coaching', 'real estate', 'property dealer', 'travel agency', 'tours', 'appointment', 'appointments', 'beauty', 'parlour', 'parlor', 'nail', 'makeup', 'yoga', 'physiotherapy'], weight: 3 },
    { words: ['small business', 'local business', 'services', 'prices', 'customers', 'website'], weight: 0.6 },
  ],
  'website-agency': [
    { words: ['agency', 'digital agency', 'marketing agency', 'creative agency', 'advertising', 'branding', 'seo', 'social media marketing', 'web design', 'web development', 'software house', 'app development', 'campaigns', 'case studies', 'creative studio', 'design studio', 'ux', 'ui/ux', 'content marketing', 'ppc', 'video production'], weight: 3 },
    { words: ['clients', 'brands', 'creative', 'marketing', 'digital', 'design'], weight: 1 },
  ],
  'website-portfolio': [
    { words: ['portfolio', 'freelancer', 'freelance', 'photographer', 'photography', 'illustrator', 'videographer', 'my work', 'my projects', 'resume', 'cv', 'personal website', 'personal site', 'graphic designer', 'ui designer', 'ux designer', 'web developer', 'software engineer', 'artist', 'writer', 'model', 'makeup artist'], weight: 3 },
    { words: ['i am a', "i'm a", 'my name is', 'hire me', 'skills', 'myself'], weight: 2 },
  ],
  'crm-basic': [
    { words: ['crm', 'customer database', 'client database', 'contact management', 'contacts', 'customer list', 'client list', 'address book', 'customer records', 'manage customers', 'manage clients'], weight: 2.5 },
    { words: ['tasks', 'follow up', 'follow-up', 'reminders', 'companies'], weight: 1 },
  ],
  'crm-sales': [
    { words: ['crm', 'customer database', 'contacts', 'manage customers', 'manage clients'], weight: 2.5 },
    { words: ['sales pipeline', 'pipeline', 'deals', 'deal', 'opportunities', 'sales team', 'sales reps', 'salespeople', 'close deals', 'kanban', 'quotation', 'quotations', 'forecast', 'win rate'], weight: 2 },
  ],
  'crm-leads': [
    { words: ['crm', 'contacts'], weight: 2.5 },
    { words: ['leads', 'lead', 'lead management', 'lead generation', 'prospects', 'qualify', 'qualified', 'lead scoring', 'convert leads', 'inquiries', 'enquiries', 'lead sources', 'cold calls', 'facebook ads'], weight: 2 },
  ],
  'erp-basic': [
    { words: ['erp', 'inventory', 'stock', 'invoice', 'invoices', 'invoicing', 'billing', 'products', 'point of sale', 'pos', 'sales orders', 'manage my shop', 'business software', 'management system'], weight: 2.5 },
  ],
  'erp-inventory-sales': [
    { words: ['erp', 'inventory', 'stock', 'invoice', 'invoices', 'invoicing', 'billing', 'products', 'sales orders', 'management system'], weight: 2.5 },
    { words: ['purchase orders', 'purchase order', 'purchasing', 'purchases', 'suppliers', 'supplier', 'vendors', 'vendor', 'warehouse', 'warehouses', 'wholesale', 'distribution', 'distributor', 'stock in', 'goods received', 'reorder'], weight: 2 },
  ],
  'erp-business': [
    { words: ['erp', 'inventory', 'stock', 'invoice', 'invoices', 'products', 'management system'], weight: 2.5 },
    { words: ['purchase orders', 'suppliers', 'vendors', 'warehouse'], weight: 1.2 },
    { words: ['hr', 'human resources', 'employee management', 'employee records', 'manage employees', 'staff management', 'payroll', 'salaries', 'attendance', 'departments', 'accounting', 'accounts', 'expenses', 'ledger', 'full business', 'complete business', 'everything in one place'], weight: 2 },
  ],
};

/** Words that suggest a website vs. an internal system (applied to whole categories). */
export const CATEGORY_HINTS = {
  WEBSITE: ['website', 'web site', 'site', 'online presence', 'homepage', 'landing page', 'visitors', 'customers can see', 'show my', 'online'],
  SYSTEM: ['software', 'system', 'manage', 'management', 'track', 'tracking', 'records', 'dashboard', 'reports', 'my team can', 'staff can', 'login', 'users'],
};

/** Order used to break ties: simpler templates win when nothing points further. */
export const TEMPLATE_PRIORITY = [
  'website-restaurant', 'website-business', 'website-agency', 'website-portfolio', 'website-corporate',
  'crm-basic', 'crm-sales', 'crm-leads', 'erp-basic', 'erp-inventory-sales', 'erp-business',
];

export interface CuisineDef { label: string; words: string[]; tag: string }
export const CUISINES: CuisineDef[] = [
  { label: 'Desi', words: ['desi', 'pakistani', 'indian', 'mughlai', 'punjabi', 'biryani', 'karahi', 'nihari', 'haleem', 'tikka', 'kebab', 'kabab', 'naan', 'paratha', 'chaat', 'pulao', 'qorma', 'korma'], tag: 'food-desi' },
  { label: 'BBQ & Grill', words: ['bbq', 'barbecue', 'barbeque', 'grill', 'grilled', 'steak', 'steakhouse', 'tandoor', 'sajji'], tag: 'food-bbq' },
  { label: 'Italian', words: ['italian', 'pizza', 'pizzeria', 'pasta', 'lasagna', 'risotto', 'spaghetti'], tag: 'food-italian' },
  { label: 'Café', words: ['cafe', 'café', 'coffee', 'espresso', 'latte', 'cappuccino', 'bakery', 'pastry', 'pastries', 'croissant', 'brunch', 'tea house'], tag: 'food-cafe' },
  { label: 'Fast food', words: ['fast food', 'burger', 'burgers', 'fries', 'fried chicken', 'zinger', 'broast', 'sandwich', 'shawarma', 'wraps'], tag: 'food-burger' },
  { label: 'Chinese', words: ['chinese', 'thai', 'japanese', 'korean', 'asian', 'sushi', 'noodles', 'chow mein', 'dim sum', 'ramen', 'manchurian'], tag: 'food-chinese' },
  { label: 'Seafood', words: ['seafood', 'fish', 'prawn', 'prawns', 'shrimp', 'lobster'], tag: 'food-seafood' },
  { label: 'Desserts', words: ['dessert', 'desserts', 'ice cream', 'cake', 'cakes', 'sweets', 'mithai', 'kulfi', 'waffles', 'donuts'], tag: 'food-dessert' },
  { label: 'Arabic', words: ['arabic', 'lebanese', 'turkish', 'mediterranean', 'mandi', 'afghani', 'afghan', 'persian'], tag: 'food-bbq' },
  { label: 'Continental', words: ['continental', 'western', 'american', 'european', 'mexican'], tag: 'food-burger' },
];

export interface BusinessKind { key: string; label: string; words: string[]; images: string[]; services: string[]; businessType: string }
export const BUSINESS_KINDS: BusinessKind[] = [
  { key: 'salon', label: 'beauty salon', words: ['salon', 'beauty', 'parlour', 'parlor', 'spa', 'nail', 'nails', 'makeup', 'bridal', 'facial'], images: ['business-salon'], services: ['Haircut & styling', 'Hair colouring', 'Facial treatment', 'Manicure & pedicure', 'Bridal makeup'], businessType: 'Services' },
  { key: 'barber', label: 'barber shop', words: ['barber', 'barbershop', 'grooming', 'shave', 'beard'], images: ['business-barber', 'business-salon'], services: ['Haircut', 'Beard trim & shape', 'Hot towel shave', 'Kids haircut'], businessType: 'Services' },
  { key: 'gym', label: 'fitness centre', words: ['gym', 'fitness', 'workout', 'crossfit', 'yoga', 'pilates', 'personal trainer', 'bodybuilding'], images: ['business-gym'], services: ['Monthly membership', 'Personal training', 'Group classes', 'Diet & nutrition plan'], businessType: 'Services' },
  { key: 'clinic', label: 'clinic', words: ['clinic', 'dental', 'dentist', 'doctor', 'physio', 'physiotherapy', 'medical', 'pharmacy', 'skin care', 'dermatology'], images: ['business-clinic', 'business'], services: ['Consultation', 'Check-up', 'Treatment plans', 'Follow-up visits'], businessType: 'Healthcare' },
  { key: 'repair', label: 'repair service', words: ['repair', 'repairs', 'mechanic', 'workshop', 'plumber', 'plumbing', 'electrician', 'car wash', 'ac service', 'mobile repair', 'laptop repair', 'auto'], images: ['business-repair', 'business'], services: ['Inspection & diagnosis', 'Repairs', 'Maintenance', 'Emergency call-out'], businessType: 'Services' },
  { key: 'cleaning', label: 'cleaning service', words: ['cleaning', 'cleaners', 'laundry', 'dry clean', 'dry cleaning', 'pest control'], images: ['business'], services: ['Home cleaning', 'Office cleaning', 'Deep cleaning', 'Laundry & ironing'], businessType: 'Services' },
  { key: 'education', label: 'academy', words: ['tuition', 'academy', 'coaching', 'school', 'institute', 'classes', 'courses', 'tutor', 'training centre', 'training center'], images: ['business'], services: ['Group classes', 'One-to-one tutoring', 'Exam preparation', 'Online sessions'], businessType: 'Education' },
  { key: 'realestate', label: 'real estate agency', words: ['real estate', 'property', 'properties', 'realtor', 'estate agent', 'plots', 'rentals'], images: ['business', 'city'], services: ['Buying', 'Selling', 'Rentals', 'Property valuation'], businessType: 'Real estate' },
  { key: 'travel', label: 'travel agency', words: ['travel', 'tours', 'tourism', 'umrah', 'hajj', 'visa', 'tickets', 'holidays'], images: ['city', 'business'], services: ['Holiday packages', 'Air tickets', 'Visa assistance', 'Umrah packages'], businessType: 'Services' },
  { key: 'bakery', label: 'bakery', words: ['bakery', 'bakers', 'cake shop', 'patisserie'], images: ['business-bakery', 'food-cafe'], services: ['Custom cakes', 'Fresh bread', 'Pastries', 'Party orders'], businessType: 'Retail' },
  { key: 'retail', label: 'store', words: ['shop', 'store', 'boutique', 'clothing', 'garments', 'mart', 'retail', 'fashion', 'shoes', 'jewellery', 'jewelry', 'electronics', 'mobile shop', 'grocery', 'supermarket'], images: ['business-retail', 'business'], services: ['In-store shopping', 'Home delivery', 'Gift wrapping', 'Bulk orders'], businessType: 'Retail' },
];

export const INDUSTRY_TYPES: { type: string; words: string[] }[] = [
  { type: 'Retail', words: ['shop', 'store', 'retail', 'boutique', 'mart', 'supermarket', 'grocery'] },
  { type: 'Wholesale / Distribution', words: ['wholesale', 'distribution', 'distributor', 'trader', 'traders', 'trading'] },
  { type: 'Manufacturing', words: ['factory', 'manufacturing', 'manufacturer', 'production', 'mill', 'textile'] },
  { type: 'Professional services', words: ['consulting', 'consultancy', 'law firm', 'accountants', 'agency', 'architect'] },
  { type: 'Real estate', words: ['real estate', 'property', 'properties', 'builders', 'construction'] },
  { type: 'Healthcare', words: ['clinic', 'hospital', 'pharmacy', 'medical', 'dental', 'lab'] },
  { type: 'Education', words: ['school', 'academy', 'college', 'tuition', 'institute', 'university'] },
  { type: 'Hospitality', words: ['restaurant', 'hotel', 'cafe', 'café', 'catering', 'guest house'] },
  { type: 'Technology', words: ['software', 'it company', 'tech', 'technology', 'saas', 'app'] },
  { type: 'Services', words: ['services', 'salon', 'gym', 'repair', 'cleaning', 'travel', 'logistics', 'courier'] },
];

export const CITIES: { name: string; country: string }[] = [
  ...['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala', 'Hyderabad', 'Bahawalpur', 'Sargodha', 'Abbottabad', 'Sukkur', 'Gujrat', 'Murree', 'Gwadar'].map((name) => ({ name, country: 'PK' })),
  ...['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman'].map((name) => ({ name, country: 'AE' })),
  ...['Riyadh', 'Jeddah', 'Dammam', 'Mecca', 'Makkah', 'Medina', 'Madinah'].map((name) => ({ name, country: 'SA' })),
  ...['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Bradford', 'Edinburgh', 'Liverpool'].map((name) => ({ name, country: 'GB' })),
  ...['New York', 'Chicago', 'Houston', 'Los Angeles', 'San Francisco', 'Dallas', 'Boston', 'Seattle', 'Miami'].map((name) => ({ name, country: 'US' })),
  ...['Toronto', 'Vancouver', 'Mississauga', 'Calgary'].map((name) => ({ name, country: 'CA' })),
  ...['Delhi', 'New Delhi', 'Mumbai', 'Bangalore', 'Bengaluru', 'Chennai', 'Kolkata', 'Pune'].map((name) => ({ name, country: 'IN' })),
  ...['Sydney', 'Melbourne', 'Brisbane', 'Perth'].map((name) => ({ name, country: 'AU' })),
  ...['Doha', 'Muscat', 'Kuwait City', 'Manama', 'Istanbul', 'Paris', 'Berlin', 'Amsterdam', 'Dublin', 'Singapore', 'Kuala Lumpur'].map((name) => ({ name, country: 'XX' })),
];

export const COUNTRY_CURRENCY: Record<string, { code: string; symbol: string }> = {
  PK: { code: 'PKR', symbol: 'Rs' }, AE: { code: 'AED', symbol: 'AED' }, SA: { code: 'SAR', symbol: 'SAR' }, GB: { code: 'GBP', symbol: '£' },
  US: { code: 'USD', symbol: '$' }, CA: { code: 'USD', symbol: '$' }, IN: { code: 'INR', symbol: '₹' }, AU: { code: 'USD', symbol: '$' },
};

export const CURRENCY_WORDS: { code: string; symbol: string; words: RegExp }[] = [
  { code: 'PKR', symbol: 'Rs', words: /\b(rs\.?|pkr|rupees?)\b|\/-/i },
  { code: 'GBP', symbol: '£', words: /£|\b(gbp|pounds?)\b/i },
  { code: 'EUR', symbol: '€', words: /€|\b(eur|euros?)\b/i },
  { code: 'AED', symbol: 'AED', words: /\b(aed|dirhams?)\b/i },
  { code: 'SAR', symbol: 'SAR', words: /\b(sar|riyals?)\b/i },
  { code: 'INR', symbol: '₹', words: /₹|\binr\b/i },
  { code: 'USD', symbol: '$', words: /\$|\b(usd|dollars?)\b/i },
];

export const COLOURS: Record<string, string> = {
  red: '#C0392B', crimson: '#B01E36', maroon: '#7B1E1E', burgundy: '#6D1A36', ember: '#B23A1E',
  orange: '#E67E22', saffron: '#E8A33D', yellow: '#E5B80B', gold: '#C9A227', golden: '#C9A227', mustard: '#C99A2E',
  green: '#2E7D32', olive: '#6B7F2A', mint: '#3EB489', emerald: '#047857', teal: '#0F766E', turquoise: '#14B8A6',
  blue: '#1D4ED8', navy: '#1E3A5F', 'sky blue': '#0EA5E9', royal: '#2741B8', purple: '#6D28D9', violet: '#7C3AED', lavender: '#8B7FD1',
  pink: '#DB2777', rose: '#E11D48', magenta: '#C026D3', brown: '#6B4423', chocolate: '#5A3825', coffee: '#6F4E37', beige: '#C8B08A', cream: '#E9DCC0',
  black: '#111111', charcoal: '#2F2F2F', grey: '#4B5563', gray: '#4B5563', silver: '#9CA3AF',
};

/** Mood words → theme keys (only applied when the template supports the theme). */
export const MOODS: { theme: string; words: string[] }[] = [
  { theme: 'warm', words: ['warm', 'cozy', 'cosy', 'rustic', 'traditional', 'homely', 'family', 'earthy'] },
  { theme: 'midnight', words: ['dark', 'night', 'luxury', 'luxurious', 'premium', 'elegant', 'classy', 'fine dining', 'upscale'] },
  { theme: 'modern', words: ['modern', 'clean', 'sleek', 'contemporary', 'tech', 'professional look'] },
  { theme: 'minimal', words: ['minimal', 'minimalist', 'simple', 'white', 'plain'] },
  { theme: 'bold', words: ['bold', 'vibrant', 'colourful', 'colorful', 'fun', 'loud', 'energetic', 'playful'] },
  { theme: 'fresh', words: ['fresh', 'healthy', 'organic', 'natural', 'green', 'light'] },
  { theme: 'classic', words: ['classic', 'corporate', 'formal', 'trustworthy', 'professional', 'serious'] },
];

/** Feature / module keywords. Only applied if the chosen template supports the key. */
export const FEATURE_WORDS: Record<string, string[]> = {
  reservations: ['reservation', 'reservations', 'reserve', 'book a table', 'table booking', 'booking', 'bookings', 'book online'],
  whatsapp: ['whatsapp', 'whats app'],
  map: ['map', 'google map', 'google maps', 'directions', 'location map'],
  gallery: ['gallery', 'photos', 'pictures', 'images'],
  menu: ['menu'],
  hours: ['timings', 'timing', 'opening hours', 'open from', 'hours', 'open daily', 'open every day'],
  contactForm: ['contact form', 'enquiry form', 'inquiry form', 'messages'],
  testimonials: ['testimonials', 'reviews', 'feedback'],
  services: ['services', 'we offer', 'packages', 'price list'],
  team: ['our team', 'team section', 'staff profiles', 'leadership'],
  process: ['process', 'how we work', 'our approach'],
  projects: ['projects', 'case studies', 'our work', 'my work', 'portfolio'],
  skills: ['skills', 'expertise', 'tools'],
  resume: ['cv', 'resume', 'résumé'],
  stats: ['figures', 'statistics', 'numbers'],
  pipelineBoard: ['pipeline', 'kanban', 'board', 'stages'],
  leadConversion: ['convert leads', 'conversion', 'lead conversion'],
  leadScoring: ['lead scoring', 'score leads', 'scoring', 'rate leads'],
  dashboard: ['dashboard', 'reports', 'reporting', 'analytics', 'charts'],
  lowStockAlerts: ['low stock', 'reorder', 'stock alert', 'stock alerts', 'out of stock'],
  autoStockOnSale: ['stock reduces', 'deduct stock', 'reduce stock', 'automatic stock'],
  autoStockOnPurchase: ['stock increases', 'add stock', 'receive stock', 'goods received'],
  autoInvoice: ['auto invoice', 'automatic invoice', 'automatic invoices', 'invoice automatically', 'invoices automatically', 'generate invoices'],
};

export const MODULE_WORDS: Record<string, string[]> = {
  contacts: ['contacts', 'customers', 'clients', 'companies', 'customer database', 'client list'],
  leads: ['leads', 'lead', 'prospects', 'enquiries', 'inquiries'],
  deals: ['deals', 'pipeline', 'opportunities', 'sales pipeline'],
  tasks: ['tasks', 'follow up', 'follow-up', 'follow-ups', 'to-do', 'todo', 'reminders'],
  inventory: ['inventory', 'stock', 'products', 'items', 'warehouse'],
  sales: ['sales', 'sales orders', 'orders', 'selling'],
  purchases: ['purchase', 'purchases', 'purchasing', 'suppliers', 'supplier', 'vendors', 'vendor'],
  accounting: ['accounting', 'accounts', 'invoices', 'invoice', 'invoicing', 'billing', 'expenses', 'payments'],
  hr: ['hr', 'human resources', 'payroll', 'salaries', 'attendance', 'staff records', 'employee records', 'employee management', 'manage employees', 'manage staff', 'leave management'],
};

export const CRM_MODULES = ['contacts', 'leads', 'deals', 'tasks'];
export const ERP_MODULES = ['inventory', 'sales', 'purchases', 'accounting', 'hr'];

/** How a cuisine label reads inside a sentence ("an Italian restaurant"). */
export const CUISINE_PHRASE: Record<string, string> = { 'BBQ & Grill': 'BBQ and grill', 'Café': 'café', 'Fast food': 'fast food', Desserts: 'dessert', Seafood: 'seafood' };

export const MODULE_LABELS: Record<string, string> = {
  contacts: 'Contacts', leads: 'Leads', deals: 'Deals', tasks: 'Tasks', inventory: 'Inventory', sales: 'Sales',
  purchases: 'Purchasing', accounting: 'Accounting', hr: 'Employees (HR)', inquiries: 'Inquiries', reservations: 'Reservations',
};

export const LEAD_SOURCES = ['Website', 'Facebook', 'Instagram', 'WhatsApp', 'LinkedIn', 'Google Ads', 'TikTok', 'Referral', 'Walk-in', 'Cold call', 'Email', 'Events', 'Exhibitions', 'Phone'];
export const DEPARTMENTS = ['Sales', 'Accounts', 'Finance', 'HR', 'Warehouse', 'Production', 'Marketing', 'Admin', 'IT', 'Operations', 'Procurement', 'Logistics', 'Customer Service', 'Quality'];

/** Dish words → menu category. */
export const MENU_CATEGORIES: { category: string; words: string[] }[] = [
  { category: 'Drinks', words: ['lassi', 'chai', 'tea', 'coffee', 'juice', 'soda', 'shake', 'milkshake', 'smoothie', 'water', 'latte', 'cappuccino', 'espresso', 'mojito', 'drink', 'cola', 'lemonade', 'margarita'] },
  { category: 'Desserts', words: ['kheer', 'gulab', 'jamun', 'cake', 'ice cream', 'brownie', 'dessert', 'halwa', 'kulfi', 'pudding', 'custard', 'cheesecake', 'tiramisu', 'waffle', 'donut', 'sundae', 'falooda'] },
  { category: 'Starters', words: ['samosa', 'soup', 'salad', 'fries', 'wings', 'chaat', 'pakora', 'spring roll', 'starter', 'appetizer', 'nuggets', 'dynamite', 'garlic bread', 'bruschetta'] },
  { category: 'Breads', words: ['naan', 'roti', 'paratha', 'bread', 'kulcha', 'puri'] },
  { category: 'Rice', words: ['biryani', 'pulao', 'rice', 'fried rice'] },
  { category: 'BBQ', words: ['tikka', 'kebab', 'kabab', 'boti', 'grill', 'bbq', 'seekh', 'sajji', 'steak', 'chops'] },
  { category: 'Pizza & Pasta', words: ['pizza', 'pasta', 'lasagna', 'spaghetti', 'fettuccine', 'penne'] },
  { category: 'Burgers', words: ['burger', 'zinger', 'sandwich', 'wrap', 'shawarma', 'club'] },
];

/** Sample dishes per cuisine — only used when the description lists none (flagged as samples). */
export const SAMPLE_MENUS: Record<string, [string, string, string, number][]> = {
  'food-desi': [['Chicken Tikka', 'BBQ', 'Charcoal-grilled, yogurt and spice marinated', 950], ['Chicken Karahi (half)', 'Mains', 'Tomato, ginger and green chilli', 1650], ['Mutton Nihari', 'Mains', 'Slow-cooked overnight, served with naan', 1850], ['Chicken Biryani', 'Rice', 'Fragrant basmati, layered and dum-cooked', 1100], ['Garlic Naan', 'Breads', 'Tandoor-baked with butter and garlic', 180], ['Mango Lassi', 'Drinks', 'Fresh mango and chilled yogurt', 450]],
  'food-bbq': [['Mixed Grill Platter', 'BBQ', 'Tikka, seekh kebab and malai boti', 2400], ['Seekh Kebab', 'BBQ', 'Four skewers with salad and raita', 1300], ['Grilled Chicken Steak', 'Mains', 'With pepper sauce and fries', 1600], ['Garlic Naan', 'Breads', 'Fresh from the tandoor', 180], ['Mint Margarita', 'Drinks', 'Fresh mint and lime', 450]],
  'food-italian': [['Margherita Pizza', 'Pizza & Pasta', 'Tomato, mozzarella and basil', 12], ['Pepperoni Pizza', 'Pizza & Pasta', 'Classic pepperoni and mozzarella', 14], ['Spaghetti Bolognese', 'Pizza & Pasta', 'Slow-cooked beef ragù', 13], ['Lasagna', 'Pizza & Pasta', 'Layered pasta, ragù and béchamel', 14], ['Tiramisu', 'Desserts', 'Coffee-soaked sponge and mascarpone', 7]],
  'food-cafe': [['Cappuccino', 'Drinks', 'Double shot with steamed milk', 4], ['Iced Latte', 'Drinks', 'Espresso over ice and milk', 5], ['Butter Croissant', 'Bakery', 'Baked fresh every morning', 3], ['Club Sandwich', 'Food', 'Chicken, egg and fresh salad', 8], ['Chocolate Brownie', 'Desserts', 'Warm, with a fudgy centre', 4]],
  'food-burger': [['Classic Beef Burger', 'Burgers', 'Beef patty, cheese and house sauce', 9], ['Crispy Chicken Burger', 'Burgers', 'Fried chicken fillet with slaw', 8], ['Loaded Fries', 'Starters', 'Cheese sauce and jalapeños', 5], ['Chicken Wings (6)', 'Starters', 'Hot or BBQ', 7], ['Chocolate Shake', 'Drinks', 'Thick and creamy', 5]],
  'food-chinese': [['Chicken Chow Mein', 'Mains', 'Wok-tossed noodles and vegetables', 11], ['Egg Fried Rice', 'Rice', 'With spring onion', 8], ['Chicken Manchurian', 'Mains', 'Sweet, sour and spicy sauce', 12], ['Hot & Sour Soup', 'Starters', 'Classic and warming', 6], ['Spring Rolls (4)', 'Starters', 'Crispy vegetable rolls', 6]],
  'food-seafood': [['Grilled Fish Fillet', 'Mains', 'With lemon butter and herbs', 16], ['Garlic Prawns', 'Mains', 'Pan-fried with chilli and garlic', 18], ['Fish & Chips', 'Mains', 'Crispy batter and thick-cut chips', 14], ['Prawn Tempura', 'Starters', 'Light and crispy', 10], ['Fresh Lime Soda', 'Drinks', 'Sweet or salted', 4]],
  'food-dessert': [['Chocolate Fudge Cake', 'Desserts', 'Rich and moist', 6], ['Ice Cream Sundae', 'Desserts', 'Three scoops, sauce and nuts', 7], ['Cheesecake', 'Desserts', 'New York style', 7], ['Waffles', 'Desserts', 'With maple syrup and berries', 8], ['Hot Chocolate', 'Drinks', 'With whipped cream', 5]],
};

export const AGENCY_SERVICES = ['Branding & identity', 'Website design & development', 'Social media marketing', 'Search engine optimisation (SEO)', 'Paid advertising', 'Content & video production', 'Mobile app development', 'UI/UX design'];
export const AGENCY_SERVICE_WORDS: Record<string, string[]> = {
  'Branding & identity': ['branding', 'brand identity', 'logo design', 'logos'],
  'Website design & development': ['web design', 'website design', 'web development', 'websites', 'wordpress', 'shopify'],
  'Social media marketing': ['social media', 'instagram marketing', 'facebook marketing', 'smm'],
  'Search engine optimisation (SEO)': ['seo', 'search engine'],
  'Paid advertising': ['ads', 'ppc', 'google ads', 'facebook ads', 'paid advertising', 'media buying'],
  'Content & video production': ['content', 'video', 'videos', 'copywriting', 'photography', 'production'],
  'Mobile app development': ['app development', 'mobile apps', 'apps', 'android', 'ios'],
  'UI/UX design': ['ui', 'ux', 'ui/ux', 'product design'],
};

export const PORTFOLIO_ROLES = ['photographer', 'graphic designer', 'ui designer', 'ux designer', 'product designer', 'web developer', 'software engineer', 'developer', 'illustrator', 'videographer', 'video editor', 'writer', 'copywriter', 'architect', 'interior designer', 'makeup artist', 'artist', 'animator', 'consultant', 'model', 'designer'];
