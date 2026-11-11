const PALETTE: Record<string, [string, string, string]> = {
  'website-restaurant': ['#b4472b', '#f7ecdc', 'Restaurant'],
  'website-corporate': ['#1f4e79', '#e8eef5', 'Corporate'],
  'website-business': ['#2563eb', '#eff6ff', 'Business'],
  'website-agency': ['#ff4d2e', '#111111', 'Agency'],
  'website-portfolio': ['#141414', '#f0f0f0', 'Portfolio'],
  'crm-basic': ['#2563eb', '#eff6ff', 'CRM'],
  'crm-sales': ['#1f7a4c', '#dcefe2', 'Sales CRM'],
  'crm-leads': ['#7c3aed', '#ede9fe', 'Leads CRM'],
  'erp-basic': ['#1f4e79', '#e8eef5', 'ERP'],
  'erp-inventory-sales': ['#b45309', '#fef3c7', 'Inventory ERP'],
  'erp-business': ['#0f766e', '#ccfbf1', 'Business ERP'],
};

/** Preview image if the admin uploaded one, otherwise a stylised wireframe of the template. */
export function TemplateThumb({ templateKey, image }: { templateKey: string; image?: string }) {
  if (image) return <img src={image} alt="" className="aspect-[16/10] w-full object-cover" />;
  const [primary, bg, label] = PALETTE[templateKey] ?? ['#334155', '#f1f5f9', 'Template'];
  const workspace = templateKey.startsWith('crm') || templateKey.startsWith('erp');
  return (
    <div className="aspect-[16/10] w-full p-4" style={{ background: bg }}>
      {workspace ? (
        <div className="flex h-full gap-2">
          <div className="w-1/4 rounded" style={{ background: primary }} />
          <div className="flex flex-1 flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-8 rounded bg-white/90" />)}</div>
            <div className="flex-1 rounded bg-white/90" />
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col gap-2">
          <div className="flex items-center justify-between"><div className="h-2 w-16 rounded" style={{ background: primary }} /><div className="h-2 w-24 rounded bg-black/20" /></div>
          <div className="flex flex-1 items-center justify-center rounded text-lg font-bold text-white" style={{ background: primary }}>{label}</div>
          <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-6 rounded bg-white/90" />)}</div>
        </div>
      )}
    </div>
  );
}
