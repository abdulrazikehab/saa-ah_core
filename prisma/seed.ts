// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Starting seed...');

  // Get ALL existing tenants
  const tenants = await prisma.tenant.findMany();
  
  if (tenants.length === 0) {
    console.error('❌ No tenants found! Please create a tenant first by signing up.');
    process.exit(1);
  }
  
  console.log(`👉 Found ${tenants.length} tenant(s):`);
  tenants.forEach(t => {
    console.log(`   - ${t.id} (${t.name} - ${t.subdomain})`);
  });
  
  // Seed currencies for each tenant
  for (const tenant of tenants) {
    console.log(`\n🔄 Seeding currencies for tenant: ${tenant.name} (${tenant.id})...`);
    
    await seedCurrencies(tenant.id);
  }

  console.log('\n🎉 Seed complete!');
}


// Seed currencies for a tenant
async function seedCurrencies(tenantId: string) {
  console.log('  💱 Seeding currencies...');
  
  const currencies = [
    {
      tenantId,
      code: 'SAR',
      name: 'Saudi Riyal',
      nameAr: 'ريال سعودي',
      symbol: 'SAR',
      symbolAr: 'ر.س',
      exchangeRate: 1,
      precision: 2,
      isActive: true,
      isDefault: true,
      sortOrder: 1,
    },
    {
      tenantId,
      code: 'AED',
      name: 'UAE Dirham',
      nameAr: 'درهم اماراتي',
      symbol: 'AED',
      symbolAr: 'د.إ',
      exchangeRate: 0.98, // 1 SAR ≈ 0.98 AED
      precision: 2,
      isActive: true,
      isDefault: false,
      sortOrder: 2,
    },
    {
      tenantId,
      code: 'KWD',
      name: 'Kuwaiti Dinar',
      nameAr: 'دينار كويتي',
      symbol: 'KWD',
      symbolAr: 'د.ك',
      exchangeRate: 0.082, // 1 SAR ≈ 0.082 KWD
      precision: 3,
      isActive: true,
      isDefault: false,
      sortOrder: 3,
    },
    {
      tenantId,
      code: 'USD',
      name: 'US Dollar',
      nameAr: 'دولار',
      symbol: '$',
      symbolAr: '$',
      exchangeRate: 0.27, // 1 SAR ≈ 0.27 USD
      precision: 2,
      isActive: true,
      isDefault: false,
      sortOrder: 4,
    },
    {
      tenantId,
      code: 'QAR',
      name: 'Qatari Riyal',
      nameAr: 'ريال قطري',
      symbol: 'QAR',
      symbolAr: 'ر.ق',
      exchangeRate: 0.97, // 1 SAR ≈ 0.97 QAR
      precision: 2,
      isActive: true,
      isDefault: false,
      sortOrder: 5,
    },
  ];

  for (const currency of currencies) {
    const existing = await prisma.currency.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: currency.code,
        },
      },
    });

    if (existing) {
      // Update existing currency
      await prisma.currency.update({
        where: { id: existing.id },
        data: currency,
      });
      console.log(`    ⚠️ Currency ${currency.code} already exists – updated`);
    } else {
      await prisma.currency.create({ data: currency });
      console.log(`    ✅ Created currency: ${currency.code} (${currency.nameAr})`);
    }
  }

  // Create or update currency settings
  const existingSettings = await prisma.currencySettings.findUnique({
    where: { tenantId },
  });

  if (existingSettings) {
    await prisma.currencySettings.update({
      where: { tenantId },
      data: { baseCurrency: 'SAR' },
    });
    console.log('    ⚠️ Currency settings already exist – updated to SAR');
  } else {
    await prisma.currencySettings.create({
      data: {
        tenantId,
        baseCurrency: 'SAR',
        autoUpdateRates: false,
      },
    });
    console.log('    ✅ Created currency settings with SAR as default');
  }
}


main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
