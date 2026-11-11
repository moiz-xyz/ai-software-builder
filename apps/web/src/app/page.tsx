import Link from 'next/link';
import { Building2, Globe, LineChart, CheckCircle2, Wand2 } from 'lucide-react';
import { PlatformShell } from '@/components/shell';
import { Button } from '@/components/ui/button';

const CATS = [
  { key: 'WEBSITE', icon: Globe, title: 'Business websites', text: 'Restaurant, corporate, business, agency and portfolio sites with menus, galleries, bookings and contact forms.' },
  { key: 'CRM', icon: LineChart, title: 'CRM software', text: 'Contacts, leads, sales pipelines and follow-ups with role-based access for your team.' },
  { key: 'ERP', icon: Building2, title: 'ERP software', text: 'Inventory, sales, purchasing, accounting and employees — with automatic stock updates.' },
];

const STEPS = ['Describe your business in a few lines — or pick a template yourself', 'We choose the right template, fill in your details and add photos and starter text', 'Check the live preview and fill in anything we missed', 'Fine-tune your own independent project in the visual editor', 'Approve and publish on your subdomain or custom domain'];

export default function Home() {
  return (
    <PlatformShell>
      <section className="mx-auto max-w-3xl py-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Describe your business. Get your website, CRM or ERP instantly.</h1>
        <p className="mt-4 text-lg text-muted-foreground">Write a few lines about what you do. We build it from professionally designed, tested templates — with your details, photos and text — in a project that belongs only to you.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/build"><Button size="lg"><Wand2 className="h-4 w-4" /> Describe your business</Button></Link>
          <Link href="/templates"><Button size="lg" variant="outline">Browse templates</Button></Link>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {CATS.map((c) => (
          <Link key={c.key} href={`/templates?category=${c.key}`} className="rounded-lg border p-6 transition hover:border-foreground/30 hover:shadow-sm">
            <c.icon className="h-7 w-7" />
            <h2 className="mt-4 text-lg font-semibold">{c.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{c.text}</p>
          </Link>
        ))}
      </section>
      <section className="mx-auto mt-16 max-w-2xl">
        <h2 className="text-center text-2xl font-semibold">How it works</h2>
        <ol className="mt-6 space-y-3">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-start gap-3 rounded-md border p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <span><strong className="mr-1">{i + 1}.</strong>{s}</span>
            </li>
          ))}
        </ol>
      </section>
    </PlatformShell>
  );
}
