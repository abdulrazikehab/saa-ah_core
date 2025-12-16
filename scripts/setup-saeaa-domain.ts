import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Setting up saeaa.com as main domain...\n');

  // 1. Ensure 'default' tenant exists
  const defaultTenant = await prisma.tenant.upsert({
    where: { id: 'default' },
    update: {
      name: 'Saeaa Main Store',
      status: 'ACTIVE',
    },
    create: {
      id: 'default',
      name: 'Saeaa Main Store',
      subdomain: 'main', // Keep a subdomain for internal use, but main domain is saeaa.com
      status: 'ACTIVE',
      plan: 'STARTER',
    },
  });

  console.log('✅ Default tenant ensured:', defaultTenant.id);

  // 2. Register saeaa.com as custom domain for default tenant
  const domains = ['saeaa.com', 'www.saeaa.com'];
  
  for (const domain of domains) {
    try {
      const customDomain = await prisma.customDomain.upsert({
        where: { domain },
        update: {
          tenantId: 'default',
          status: 'ACTIVE',
          sslStatus: 'ACTIVE',
        },
        create: {
          domain,
          tenantId: 'default',
          status: 'ACTIVE',
          sslStatus: 'ACTIVE',
          verifiedAt: new Date(),
        },
      });
      console.log(`✅ Custom domain registered: ${domain} -> tenant ${defaultTenant.id}`);
    } catch (error: any) {
      console.error(`❌ Error setting up domain ${domain}:`, error.message);
    }
  }

  // 3. Check for any existing subdomain-based domains that should be removed
  const existingSubdomainDomains = await prisma.customDomain.findMany({
    where: {
      domain: {
        contains: '.saeaa.com',
      },
      tenantId: 'default',
    },
  });

  if (existingSubdomainDomains.length > 0) {
    console.log('\n⚠️  Found existing subdomain-based domains for default tenant:');
    for (const domain of existingSubdomainDomains) {
      if (!domains.includes(domain.domain)) {
        console.log(`   - ${domain.domain} (will be kept for now)`);
      }
    }
  }

  console.log('\n✅ Setup complete! saeaa.com is now configured as the main domain.');
  console.log('   The site will be accessible at: https://saeaa.com');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

