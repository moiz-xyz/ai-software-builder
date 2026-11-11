import type { FeatureDef, SectionDef, TemplateDefinition } from '../types';
import { ALL_FONTS, DEFAULT_HOURS, WEBSITE_LAYOUTS, brandingSection, businessSection, contactSection, f, featuresSection } from './common';

const commonFeatures: FeatureDef[] = [
  { key: 'contactForm', label: 'Contact form', description: 'Visitors can send you messages (stored in your dashboard).', default: true, section: 'contact' },
  { key: 'whatsapp', label: 'WhatsApp button', description: 'Floating click-to-chat button.' },
  { key: 'map', label: 'Location map', description: 'Embedded map of your address.' },
  { key: 'gallery', label: 'Image gallery', default: true, section: 'gallery' },
  { key: 'testimonials', label: 'Testimonials', section: 'testimonials' },
];

const sec = (key: string, label: string, extra: Partial<SectionDef> = {}): SectionDef => ({ key, label, default: true, ...extra });

const imagesSection = (title = 'Images') => ({
  key: 'images',
  title,
  description: 'Upload your own photos. They are copied into your project and never shared with other customers.',
  fields: [
    f('heroImage', 'Main (hero) image', 'image', 'images.hero'),
    f('gallery', 'Gallery images', 'images', 'images.gallery', { max: 24, showIfFeature: 'gallery' }),
  ],
});

const testimonialsField = f('testimonials', 'Testimonials', 'repeater', 'content.testimonials', {
  showIfFeature: 'testimonials',
  max: 12,
  itemFields: [
    f('name', 'Name', 'text', 'name', { required: true }),
    f('quote', 'Quote', 'textarea', 'quote', { required: true, maxLength: 400 }),
  ],
});

const servicesField = (label = 'Services') =>
  f('services', label, 'repeater', 'content.services', {
    max: 12,
    itemFields: [
      f('title', 'Title', 'text', 'title', { required: true }),
      f('description', 'Description', 'textarea', 'description', { maxLength: 400 }),
      f('price', 'Price (optional)', 'text', 'price'),
    ],
  });

const projectsField = f('projects', 'Projects / case studies', 'repeater', 'content.projects', {
  max: 24,
  itemFields: [
    f('title', 'Title', 'text', 'title', { required: true }),
    f('client', 'Client / context', 'text', 'client'),
    f('description', 'Description', 'textarea', 'description', { maxLength: 600 }),
    f('image', 'Image', 'image', 'image'),
    f('link', 'Link', 'url', 'link'),
  ],
});

const teamField = f('team', 'Team members', 'repeater', 'content.team', {
  showIfFeature: 'team',
  max: 24,
  itemFields: [
    f('name', 'Name', 'text', 'name', { required: true }),
    f('role', 'Role', 'text', 'role'),
    f('photo', 'Photo', 'image', 'photo'),
  ],
});

export const restaurantWebsite: TemplateDefinition = {
  key: 'website-restaurant',
  name: 'Restaurant Website',
  category: 'WEBSITE',
  renderer: 'restaurant',
  description: 'Menu, gallery, opening hours and online table reservations for restaurants, cafés and bakeries.',
  previewImages: [],
  features: [
    { key: 'menu', label: 'Food menu', default: true, section: 'menu' },
    { key: 'hours', label: 'Opening hours', default: true, section: 'hours' },
    { key: 'reservations', label: 'Table reservations', description: 'Reservation form; bookings appear in your dashboard.', section: 'reservation' },
    ...commonFeatures,
  ],
  modules: ['inquiries', 'reservations'],
  sections: [
    sec('hero', 'Hero', { required: true }),
    sec('about', 'About us'),
    sec('menu', 'Menu', { feature: 'menu' }),
    sec('gallery', 'Gallery', { feature: 'gallery' }),
    sec('testimonials', 'Testimonials', { feature: 'testimonials' }),
    sec('hours', 'Opening hours', { feature: 'hours' }),
    sec('reservation', 'Reservations', { feature: 'reservations' }),
    sec('contact', 'Contact', { required: true }),
  ],
  themes: ['warm', 'classic', 'midnight', 'fresh'],
  defaultTheme: 'warm',
  fonts: ALL_FONTS,
  layoutVariants: WEBSITE_LAYOUTS,
  roles: [],
  formSchema: [
    businessSection('Restaurant name', [
      f('cuisine', 'Cuisine type', 'text', 'content.cuisine', { placeholder: 'e.g. Italian, BBQ, Desi' }),
    ]),
    contactSection([
      f('whatsapp', 'WhatsApp number', 'phone', 'business.whatsapp', { showIfFeature: 'whatsapp' }),
      f('hours', 'Opening hours', 'hours', 'business.hours', { showIfFeature: 'hours' }),
    ]),
    {
      key: 'menu',
      title: 'Menu',
      fields: [
        f('menu', 'Menu items', 'repeater', 'content.menu', {
          showIfFeature: 'menu',
          max: 120,
          itemFields: [
            f('name', 'Dish', 'text', 'name', { required: true }),
            f('category', 'Category', 'text', 'category', { placeholder: 'Starters, Mains, Drinks…' }),
            f('description', 'Description', 'text', 'description'),
            f('price', 'Price', 'text', 'price', { required: true }),
            f('image', 'Photo', 'image', 'image'),
          ],
        }),
      ],
    },
    {
      key: 'reservations',
      title: 'Reservations',
      fields: [
        f('maxGuests', 'Maximum guests per booking', 'number', 'content.reservation.maxGuests', { showIfFeature: 'reservations', min: 1, max: 100 }),
        f('reservationNote', 'Reservation policy / note', 'textarea', 'content.reservation.note', { showIfFeature: 'reservations', maxLength: 500 }),
      ],
    },
    imagesSection('Food & venue images'),
    { key: 'social', title: 'Testimonials', fields: [testimonialsField] },
    brandingSection(),
    featuresSection(),
  ],
  defaults: {
    business: { hours: DEFAULT_HOURS },
    content: { menu: [], testimonials: [], reservation: { maxGuests: 10 } },
    features: ['menu', 'hours', 'contactForm', 'gallery'],
    branding: { theme: 'warm', layout: 'fullbleed', font: 'Playfair Display' },
  },
};

export const corporateWebsite: TemplateDefinition = {
  key: 'website-corporate',
  name: 'Corporate Website',
  category: 'WEBSITE',
  renderer: 'corporate',
  description: 'Professional multi-section site for established companies: services, key figures, leadership team and contact.',
  previewImages: [],
  features: [
    { key: 'services', label: 'Services', default: true, section: 'services' },
    { key: 'stats', label: 'Key figures', default: true, section: 'stats' },
    { key: 'team', label: 'Leadership team', section: 'team' },
    ...commonFeatures,
  ],
  modules: ['inquiries'],
  sections: [
    sec('hero', 'Hero', { required: true }),
    sec('about', 'About'),
    sec('stats', 'Key figures', { feature: 'stats' }),
    sec('services', 'Services', { feature: 'services' }),
    sec('team', 'Team', { feature: 'team' }),
    sec('gallery', 'Gallery', { feature: 'gallery' }),
    sec('testimonials', 'Testimonials', { feature: 'testimonials' }),
    sec('contact', 'Contact', { required: true }),
  ],
  themes: ['classic', 'modern', 'midnight', 'minimal'],
  defaultTheme: 'classic',
  fonts: ALL_FONTS,
  layoutVariants: WEBSITE_LAYOUTS,
  roles: [],
  formSchema: [
    businessSection('Company name', [
      f('mission', 'Mission statement', 'textarea', 'content.mission', { maxLength: 600 }),
      f('founded', 'Founded (year)', 'number', 'content.founded', { min: 1800, max: 2100 }),
    ]),
    contactSection([f('whatsapp', 'WhatsApp number', 'phone', 'business.whatsapp', { showIfFeature: 'whatsapp' })]),
    {
      key: 'content',
      title: 'Services & figures',
      fields: [
        { ...servicesField(), showIfFeature: 'services' },
        f('stats', 'Key figures', 'repeater', 'content.stats', {
          showIfFeature: 'stats',
          max: 6,
          itemFields: [f('value', 'Value', 'text', 'value', { required: true, placeholder: '250+' }), f('label', 'Label', 'text', 'label', { required: true, placeholder: 'Clients' })],
        }),
        teamField,
        testimonialsField,
      ],
    },
    imagesSection(),
    brandingSection(),
    featuresSection(),
  ],
  defaults: {
    content: { services: [], stats: [], team: [], testimonials: [] },
    features: ['services', 'stats', 'contactForm', 'gallery'],
    branding: { theme: 'classic', layout: 'split', font: 'Lora' },
  },
};

export const businessWebsite: TemplateDefinition = {
  key: 'website-business',
  name: 'Business Website',
  category: 'WEBSITE',
  renderer: 'business',
  description: 'All-round small business site with services and prices, testimonials, opening hours and WhatsApp contact.',
  previewImages: [],
  features: [
    { key: 'services', label: 'Services & prices', default: true, section: 'services' },
    { key: 'hours', label: 'Opening hours', section: 'hours' },
    ...commonFeatures,
  ],
  modules: ['inquiries'],
  sections: [
    sec('hero', 'Hero', { required: true }),
    sec('about', 'About'),
    sec('services', 'Services', { feature: 'services' }),
    sec('gallery', 'Gallery', { feature: 'gallery' }),
    sec('testimonials', 'Testimonials', { feature: 'testimonials' }),
    sec('hours', 'Opening hours', { feature: 'hours' }),
    sec('contact', 'Contact', { required: true }),
  ],
  themes: ['modern', 'classic', 'fresh', 'midnight'],
  defaultTheme: 'modern',
  fonts: ALL_FONTS,
  layoutVariants: WEBSITE_LAYOUTS,
  roles: [],
  formSchema: [
    businessSection(),
    contactSection([
      f('whatsapp', 'WhatsApp number', 'phone', 'business.whatsapp', { showIfFeature: 'whatsapp' }),
      f('hours', 'Opening hours', 'hours', 'business.hours', { showIfFeature: 'hours' }),
    ]),
    { key: 'content', title: 'Services', fields: [{ ...servicesField('Services & prices'), showIfFeature: 'services' }, testimonialsField] },
    imagesSection(),
    brandingSection(),
    featuresSection(),
  ],
  defaults: {
    business: { hours: DEFAULT_HOURS },
    content: { services: [], testimonials: [] },
    features: ['services', 'contactForm', 'gallery', 'whatsapp'],
    branding: { theme: 'modern', layout: 'centered', font: 'Poppins' },
  },
};

export const agencyWebsite: TemplateDefinition = {
  key: 'website-agency',
  name: 'Agency Website',
  category: 'WEBSITE',
  renderer: 'agency',
  description: 'Bold site for creative and digital agencies: case studies, process, team and client testimonials.',
  previewImages: [],
  features: [
    { key: 'services', label: 'Services', default: true, section: 'services' },
    { key: 'projects', label: 'Case studies', default: true, section: 'projects' },
    { key: 'process', label: 'Our process', section: 'process' },
    { key: 'team', label: 'Team', section: 'team' },
    ...commonFeatures,
  ],
  modules: ['inquiries'],
  sections: [
    sec('hero', 'Hero', { required: true }),
    sec('services', 'Services', { feature: 'services' }),
    sec('projects', 'Work', { feature: 'projects' }),
    sec('process', 'Process', { feature: 'process' }),
    sec('team', 'Team', { feature: 'team' }),
    sec('testimonials', 'Testimonials', { feature: 'testimonials' }),
    sec('about', 'About'),
    sec('contact', 'Contact', { required: true }),
  ],
  themes: ['bold', 'midnight', 'minimal', 'modern'],
  defaultTheme: 'bold',
  fonts: ALL_FONTS,
  layoutVariants: WEBSITE_LAYOUTS,
  roles: [],
  formSchema: [
    businessSection('Agency name'),
    contactSection([f('whatsapp', 'WhatsApp number', 'phone', 'business.whatsapp', { showIfFeature: 'whatsapp' })]),
    {
      key: 'content',
      title: 'Work & services',
      fields: [
        { ...servicesField(), showIfFeature: 'services' },
        { ...projectsField, showIfFeature: 'projects' },
        f('process', 'Process steps', 'list', 'content.process', { showIfFeature: 'process', help: 'One step per line' }),
        teamField,
        testimonialsField,
      ],
    },
    imagesSection(),
    brandingSection(),
    featuresSection(),
  ],
  defaults: {
    content: { services: [], projects: [], process: ['Discover', 'Design', 'Build', 'Launch'], team: [], testimonials: [] },
    features: ['services', 'projects', 'contactForm'],
    branding: { theme: 'bold', layout: 'split', font: 'Montserrat' },
  },
};

export const portfolioWebsite: TemplateDefinition = {
  key: 'website-portfolio',
  name: 'Portfolio Website',
  category: 'WEBSITE',
  renderer: 'portfolio',
  description: 'Personal portfolio for freelancers, photographers and designers: projects grid, skills and contact.',
  previewImages: [],
  features: [
    { key: 'projects', label: 'Projects grid', default: true, section: 'projects' },
    { key: 'skills', label: 'Skills', default: true, section: 'skills' },
    { key: 'resume', label: 'Downloadable CV link' },
    ...commonFeatures.filter((x) => x.key !== 'map'),
  ],
  modules: ['inquiries'],
  sections: [
    sec('hero', 'Hero', { required: true }),
    sec('about', 'About me'),
    sec('projects', 'Projects', { feature: 'projects' }),
    sec('skills', 'Skills', { feature: 'skills' }),
    sec('gallery', 'Gallery', { feature: 'gallery' }),
    sec('testimonials', 'Testimonials', { feature: 'testimonials' }),
    sec('contact', 'Contact', { required: true }),
  ],
  themes: ['minimal', 'midnight', 'bold', 'modern'],
  defaultTheme: 'minimal',
  fonts: ALL_FONTS,
  layoutVariants: WEBSITE_LAYOUTS,
  roles: [],
  formSchema: [
    businessSection('Your name', [f('role', 'Professional title', 'text', 'content.role', { placeholder: 'Product designer' })]),
    contactSection([
      f('whatsapp', 'WhatsApp number', 'phone', 'business.whatsapp', { showIfFeature: 'whatsapp' }),
      f('resumeUrl', 'CV / résumé URL', 'url', 'content.resumeUrl', { showIfFeature: 'resume' }),
    ]),
    {
      key: 'content',
      title: 'Projects & skills',
      fields: [{ ...projectsField, showIfFeature: 'projects' }, f('skills', 'Skills', 'list', 'content.skills', { showIfFeature: 'skills', help: 'One per line' }), testimonialsField],
    },
    imagesSection(),
    brandingSection(),
    featuresSection(),
  ],
  defaults: {
    content: { projects: [], skills: [], testimonials: [] },
    features: ['projects', 'skills', 'contactForm', 'gallery'],
    branding: { theme: 'minimal', layout: 'centered', font: 'Inter' },
  },
};

export const WEBSITE_TEMPLATES = [restaurantWebsite, corporateWebsite, businessWebsite, agencyWebsite, portfolioWebsite];
