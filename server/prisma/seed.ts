import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@filehost.local';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      username: 'admin',
      passwordHash: hashedPassword,
      role: 'ADMIN',
      apiKey: nanoid(32),
    },
  });

  console.log('✅ Admin user created:', admin.email);

  // Create test free user
  const freeUser = await prisma.user.upsert({
    where: { email: 'free@test.local' },
    update: {},
    create: {
      email: 'free@test.local',
      username: 'freeuser',
      passwordHash: await bcrypt.hash('password123', 10),
      role: 'USER',
      apiKey: nanoid(32),
    },
  });

  console.log('✅ Free user created:', freeUser.email);

  // Create test premium user
  const premiumUser = await prisma.user.upsert({
    where: { email: 'premium@test.local' },
    update: {},
    create: {
      email: 'premium@test.local',
      username: 'premiumuser',
      passwordHash: await bcrypt.hash('password123', 10),
      role: 'USER',
      premiumUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      apiKey: nanoid(32),
    },
  });

  console.log('✅ Premium user created:', premiumUser.email);

  // Create default site settings
  const settings = [
    { key: 'site_name', value: 'FileHost' },
    { key: 'max_file_size_free', value: '104857600' }, // 100MB
    { key: 'max_file_size_premium', value: '5368709120' }, // 5GB
    { key: 'free_user_wait_seconds', value: '9' },
    { key: 'min_payout_threshold_cents', value: '5000' },
    { key: 'earnings_per_download_cents', value: '10' },
    { key: 'enable_registration', value: 'true' },
    { key: 'enable_uploads', value: 'true' },
    { key: 'maintenance_mode', value: 'false' },
  ];

  for (const setting of settings) {
    await prisma.siteSettings.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  console.log('✅ Site settings created');

  console.log('🎉 Seeding completed!');
  console.log('\n📝 Test Credentials:');
  console.log('Admin:', adminEmail, '/', adminPassword);
  console.log('Free User: free@test.local / password123');
  console.log('Premium User: premium@test.local / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
