/* Idempotent seed: admin account, theme & module library, and the 11 master templates (v1.0.0).
 * Existing templates are never overwritten, so admin edits survive re-seeding. */
import { CreateBucketCommand, HeadBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient, Prisma } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as bcrypt from 'bcryptjs';
import { MASTER_TEMPLATES, MODULES, THEMES, validateTemplateDefinition } from '@sf/templates';

const prisma = new PrismaClient();
const json = (v: unknown) => v as Prisma.InputJsonValue;

async function main() {
  const email = (process.env.ADMIN_EMAIL || 'admin@factory.local').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Admin123!';
  await prisma.user.upsert({
    where: { email },
    create: { email, name: 'Platform Admin', role: 'ADMIN', passwordHash: await bcrypt.hash(password, 10), subscription: { create: { plan: 'ENTERPRISE', status: 'ACTIVE' } } },
    update: { role: 'ADMIN' },
  });
  console.log(`admin: ${email}`);

  if (process.env.SEED_DEMO_CUSTOMER !== 'false') {
    await prisma.user.upsert({
      where: { email: 'customer@factory.local' },
      create: { email: 'customer@factory.local', name: 'Demo Customer', company: 'Demo Co', passwordHash: await bcrypt.hash('Customer123!', 10), subscription: { create: { plan: 'STARTER', status: 'ACTIVE' } } },
      update: {},
    });
    console.log('demo customer: customer@factory.local / Customer123!');
  }

  for (const t of THEMES) {
    await prisma.theme.upsert({ where: { key: t.key }, create: { key: t.key, name: t.name, tokens: json(t.tokens), builtIn: true }, update: { builtIn: true } });
  }
  for (const m of MODULES) {
    await prisma.module.upsert({
      where: { key: m.key },
      create: { key: m.key, name: m.name, category: m.category, description: m.description, entities: json(m.entities), builtIn: true },
      update: { builtIn: true },
    });
  }
  console.log(`themes: ${THEMES.length}, modules: ${MODULES.length}`);

  for (const def of MASTER_TEMPLATES) {
    const check = validateTemplateDefinition(def);
    if (!check.valid) throw new Error(`${def.key}: ${check.errors.map((e) => e.message).join('; ')}`);
    const existing = await prisma.template.findUnique({ where: { key: def.key } });
    if (existing) continue;
    const t = await prisma.template.create({
      data: { key: def.key, name: def.name, category: def.category, description: def.description, previewImages: def.previewImages, draft: json(def), status: 'PUBLISHED' },
    });
    const v = await prisma.templateVersion.create({ data: { templateId: t.id, version: '1.0.0', definition: json(def), changelog: 'Initial release' } });
    await prisma.template.update({ where: { id: t.id }, data: { currentVersionId: v.id } });
    console.log(`template: ${def.key} v1.0.0`);
  }
}

/**
 * Starter image library (public-domain / CC0 photos from Wikimedia Commons, see prisma/stock/manifest.json).
 * Runs only while the library is empty, so admin edits/removals are kept.
 */
async function seedImageLibrary() {
  const dir = join(__dirname, 'stock');
  const manifestPath = join(dir, 'manifest.json');
  if (!existsSync(manifestPath) || process.env.SEED_IMAGE_LIBRARY === 'false') return;
  const manifest: { file: string; tags: string[]; title: string; creator: string; license: string; source: string; width: number; height: number }[] = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const bucket = process.env.S3_BUCKET || 'factory-assets';
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION || 'us-east-1', forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY || '', secretAccessKey: process.env.S3_SECRET_KEY || '' },
  });
  try { await s3.send(new HeadBucketCommand({ Bucket: bucket })); } catch { await s3.send(new CreateBucketCommand({ Bucket: bucket })).catch(() => undefined); }
  // Only fill an empty library, so photos an admin removed are not re-added on the next deploy.
  if ((await prisma.stockImage.count()) > 0) return;
  let added = 0;
  for (const m of manifest) {
    const key = `stock/library/${m.file.replace(/[^A-Za-z0-9_.-]/g, '-')}`;
    const body = readFileSync(join(dir, m.file));
    const exists = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key })).then(() => true, () => false);
    if (!exists) await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'image/jpeg' }));
    await prisma.stockImage.create({
      data: { key, url: `/api/files/${key}`, tags: m.tags, title: m.title.slice(0, 200), creator: m.creator.slice(0, 200), license: m.license, sourceUrl: m.source, width: m.width, height: m.height, size: body.length },
    });
    added++;
  }
  console.log(`image library: ${added} photo(s) added, ${await prisma.stockImage.count()} total`);
}

main()
  .then(seedImageLibrary)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
