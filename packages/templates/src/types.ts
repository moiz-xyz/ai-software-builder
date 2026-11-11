/**
 * Core types for the template-based software factory.
 *
 * A *master template* is described by a TemplateDefinition. It is authored by the
 * platform administrator and stored (versioned, immutable once published) in the DB.
 * A *customer project* owns a ProjectConfig that is built from the definition's
 * defaults + the customer's form submission by deterministic rules (see engine.ts).
 */

export type Category = 'WEBSITE' | 'CRM' | 'ERP';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'url'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'color'
  | 'image'
  | 'images'
  | 'repeater'
  | 'list'
  | 'hours'
  | 'theme'
  | 'layout'
  | 'font'
  | 'features'
  | 'modules'
  | 'roles';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  /** Dot path inside ProjectConfig where the value is written, e.g. "business.name". */
  bind: string;
  required?: boolean;
  help?: string;
  placeholder?: string;
  options?: FieldOption[];
  min?: number;
  max?: number;
  maxLength?: number;
  /** Sub-fields for `repeater` items (their `bind` is the key inside the item). */
  itemFields?: FormField[];
  /** Only show/validate this field when the given feature is selected. */
  showIfFeature?: string;
}

export interface FormSection {
  key: string;
  title: string;
  description?: string;
  fields: FormField[];
}

export interface FeatureDef {
  key: string;
  label: string;
  description?: string;
  /** Enabled when the customer does not choose explicitly. */
  default?: boolean;
  /** Other feature keys that must also be enabled. */
  requires?: string[];
  /** Website section that this feature turns on. */
  section?: string;
}

export interface SectionDef {
  key: string;
  label: string;
  required?: boolean;
  default?: boolean;
  /** Feature key that must be enabled for this section to be available. */
  feature?: string;
}

export interface LayoutVariant {
  key: string;
  label: string;
  description?: string;
}

export interface RoleDef {
  key: string;
  name: string;
  /** e.g. "contacts:read", "deals:write", "users:manage", "*" */
  permissions: string[];
}

export type RendererKey =
  | 'restaurant'
  | 'corporate'
  | 'business'
  | 'agency'
  | 'portfolio'
  | 'workspace';

export interface TemplateDefinition {
  key: string;
  name: string;
  category: Category;
  description: string;
  /** Which code-implemented renderer draws this template. */
  renderer: RendererKey;
  previewImages: string[];
  features: FeatureDef[];
  /** CRM / ERP module keys supported by this template (see modules.ts). */
  modules: string[];
  /** Modules that are always on and can not be disabled. */
  requiredModules?: string[];
  /** Website sections in default order. */
  sections: SectionDef[];
  themes: string[];
  defaultTheme: string;
  fonts: string[];
  layoutVariants: LayoutVariant[];
  /** Role presets offered to the customer for CRM / ERP workspaces. */
  roles: RoleDef[];
  formSchema: FormSection[];
  /** Default ProjectConfig values (merged under the customer's values). */
  defaults: DeepPartial<ProjectConfig>;
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export interface OpeningHours {
  day: string;
  open: string;
  close: string;
  closed?: boolean;
}

export interface NavItem {
  label: string;
  section: string;
}

export interface SectionState {
  key: string;
  enabled: boolean;
  title?: string;
}

export interface ProjectConfig {
  business: {
    name: string;
    tagline?: string;
    description?: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    address?: string;
    website?: string;
    businessType?: string;
    employees?: number;
    hours?: OpeningHours[];
    socials?: Record<string, string>;
  };
  branding: {
    logo?: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    font: string;
    theme: string;
    layout: string;
  };
  images: {
    hero?: string;
    gallery: string[];
  };
  /** Template-specific content (menu items, services, pipeline stages, ...). */
  content: Record<string, unknown>;
  sections: SectionState[];
  navigation: NavItem[];
  features: string[];
  modules: string[];
  roles: RoleDef[];
}

export interface ThemeDef {
  key: string;
  name: string;
  /** Visual tokens. Customer colors override primary/secondary/accent. */
  tokens: {
    background: string;
    surface: string;
    text: string;
    muted: string;
    primary: string;
    secondary: string;
    accent: string;
    radius: string;
    heading: 'serif' | 'sans' | 'display' | 'mono';
    dark: boolean;
  };
}

export type EntityFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'number'
  | 'money'
  | 'date'
  | 'select'
  | 'boolean'
  | 'relation';

export interface EntityField {
  key: string;
  label: string;
  type: EntityFieldType;
  required?: boolean;
  options?: string[];
  /** For select fields whose options come from project config, e.g. "content.pipelineStages". */
  optionsFrom?: string;
  /** For relation fields: target entity key. */
  relation?: string;
  default?: unknown;
}

export interface EntityDef {
  key: string;
  label: string;
  plural: string;
  displayField: string;
  fields: EntityField[];
  listColumns: string[];
  /** Field used to render a kanban board (e.g. deal stage). */
  boardField?: string;
}

export interface ModuleDef {
  key: string;
  name: string;
  category: 'CRM' | 'ERP' | 'WEBSITE';
  description: string;
  entities: EntityDef[];
}

export interface ValidationIssue {
  path: string;
  message: string;
  code:
    | 'required'
    | 'invalid_type'
    | 'invalid_value'
    | 'unsupported_feature'
    | 'unsupported_module'
    | 'unsupported_theme'
    | 'unsupported_layout'
    | 'unsupported_font'
    | 'missing_dependency'
    | 'too_long'
    | 'out_of_range';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/**
 * Raw customer answers keyed by FormField.key. Special field types
 * (features / modules / roles) hold string arrays; theme / layout / font hold a key;
 * image fields hold an asset reference ("asset:<id>") or URL.
 */
export interface Submission {
  values: Record<string, unknown>;
}
