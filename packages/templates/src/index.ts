export * from './types';
export * from './themes';
export * from './modules';
export * from './engine';
export * from './templates/websites';
export * from './templates/workspace';
export * from './smart/analyse';
export * from './smart/compose';
export * as lexicon from './smart/lexicon';

import { WEBSITE_TEMPLATES } from './templates/websites';
import { CRM_TEMPLATES, ERP_TEMPLATES } from './templates/workspace';
import type { TemplateDefinition } from './types';

/** The 11 master templates shipped with the platform (seeded into the DB as v1.0.0). */
export const MASTER_TEMPLATES: TemplateDefinition[] = [...WEBSITE_TEMPLATES, ...CRM_TEMPLATES, ...ERP_TEMPLATES];
