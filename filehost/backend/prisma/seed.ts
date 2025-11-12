import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@filehost.local' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@filehost.local',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      apiKey: `fh_${nanoid(32)}`,
      premiumUntil: new Date('2099-12-31'),
    },
  });
  console.log(`Admin user created: ${admin.email}`);

  // Create test free user
  const freeUserPassword = await bcrypt.hash('user123', 10);
  const freeUser = await prisma.user.upsert({
    where: { email: 'user@filehost.local' },
    update: {},
    create: {
      username: 'testuser',
      email: 'user@filehost.local',
      passwordHash: freeUserPassword,
      role: UserRole.USER,
      apiKey: `fh_${nanoid(32)}`,
    },
  });
  console.log(`Free user created: ${freeUser.email}`);

  // Create test premium user
  const premiumUserPassword = await bcrypt.hash('premium123', 10);
  const premiumUser = await prisma.user.upsert({
    where: { email: 'premium@filehost.local' },
    update: {},
    create: {
      username: 'premiumuser',
      email: 'premium@filehost.local',
      passwordHash: premiumUserPassword,
      role: UserRole.USER,
      apiKey: `fh_${nanoid(32)}`,
      premiumUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    },
  });
  console.log(`Premium user created: ${premiumUser.email}`);

  // Create default settings
  const defaultSettings = [
    { key: 'site_name', value: 'FileHost' },
    { key: 'site_description', value: 'Free file hosting and sharing' },
    { key: 'max_file_size_free', value: '104857600' }, // 100MB
    { key: 'max_file_size_premium', value: '10737418240' }, // 10GB
    { key: 'daily_bandwidth_free', value: '1073741824' }, // 1GB
    { key: 'daily_bandwidth_premium', value: '107374182400' }, // 100GB
    { key: 'download_wait_time', value: '9' }, // seconds
    { key: 'file_expiry_days', value: '90' },
    { key: 'payout_threshold_cents', value: '5000' }, // $50
    { key: 'earnings_per_download_cents', value: '10' }, // $0.10
    { key: 'allowed_mime_types', value: 'image/*,video/*,audio/*,application/pdf,application/zip,application/x-rar-compressed,text/*' },
    { key: 'stripe_enabled', value: 'false' },
    { key: 'telegram_bot_enabled', value: 'false' },
    { key: 'virus_scan_enabled', value: 'false' },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }
  console.log('Default settings created');

  console.log('Seeding completed!');
  console.log('\n=== Test Credentials ===');
  console.log('Admin:');
  console.log('  Email: admin@filehost.local');
  console.log('  Password: admin123');
  console.log('  API Key:', admin.apiKey);
  console.log('\nFree User:');
  console.log('  Email: user@filehost.local');
  console.log('  Password: user123');
  console.log('  API Key:', freeUser.apiKey);
  console.log('\nPremium User:');
  console.log('  Email: premium@filehost.local');
  console.log('  Password: premium123');
  console.log('  API Key:', premiumUser.apiKey);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
