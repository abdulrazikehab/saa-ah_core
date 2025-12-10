import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing domain for default tenant...');

  // 1. Ensure 'default' tenant exists and has 'market' subdomain
  // First check if 'market' subdomain is used by another tenant
  const existingTenant = await prisma.tenant.findUnique({
    where: { subdomain: 'market' },
  });

  if (existingTenant && existingTenant.id !== 'default') {
    console.log(`Subdomain 'market' is used by tenant ${existingTenant.id}. Updating it to 'market-old'...`);
    await prisma.tenant.update({
      where: { id: existingTenant.id },
      data: { subdomain: `market-old-${Date.now()}` },
    });
  }

  const tenant = await prisma.tenant.upsert({
    where: { id: 'default' },
    update: {
      subdomain: 'market',
    },
    create: {
      id: 'default',
      name: 'Default Tenant',
      subdomain: 'market',
      status: 'ACTIVE',
      plan: 'STARTER',
    },
  });

  console.log('Tenant ensured:', tenant);

  // 2. Ensure CustomDomain 'market.localhost' exists
  try {
      const customDomain = await prisma.customDomain.upsert({
        where: { domain: 'market.localhost' },
        update: {
            tenantId: 'default',
            status: 'ACTIVE',
        },
        create: {
            domain: 'market.localhost',
            tenantId: 'default',
            status: 'ACTIVE',
            sslStatus: 'ACTIVE',
        },
      });
      console.log('CustomDomain ensured:', customDomain);
  } catch (e) {
      console.error('Error creating custom domain:', e);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
