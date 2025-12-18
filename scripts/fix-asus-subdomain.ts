/// <reference types="node" />
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing asus market subdomain...\n');

  // Find the tenant with subdomain 'tenant-mJzclxSS' (case insensitive)
  const tenant = await prisma.tenant.findFirst({
    where: {
      subdomain: {
        contains: 'mjzclxss',
        mode: 'insensitive',
      },
    },
  });

  if (!tenant) {
    // Try to find by partial ID match
    const tenantById = await prisma.tenant.findFirst({
      where: {
        id: {
          startsWith: 'mJzclxSS',
        },
      },
    });
    
    if (tenantById) {
      console.log(`Found tenant by ID: ${tenantById.id}`);
      console.log(`  Name: ${tenantById.name}`);
      console.log(`  Subdomain: ${tenantById.subdomain}`);
      
      // Check if 'asus' subdomain is available
      const existing = await prisma.tenant.findUnique({
        where: { subdomain: 'asus' },
      });

      if (existing && existing.id !== tenantById.id) {
        console.log(`❌ Cannot use 'asus' subdomain - already taken by tenant: ${existing.id}`);
        return;
      }

      // Update the name and subdomain to 'asus'
      await prisma.tenant.update({
        where: { id: tenantById.id },
        data: { 
          name: 'asus',
          subdomain: 'asus' 
        },
      });

      console.log(`\n✅ Updated tenant:`);
      console.log(`   Name: Tenant-mJzclxSS -> asus`);
      console.log(`   Subdomain: ${tenantById.subdomain} -> asus`);
      console.log(`\n🚀 Now visit: http://asus.localhost:8080`);
      return;
    }
    
    console.log('❌ Tenant not found. Listing all tenants with tenant- prefix...\n');
    const allTenants = await prisma.tenant.findMany({
      where: { subdomain: { startsWith: 'tenant-' } }
    });
    for (const t of allTenants) {
      console.log(`  - ${t.subdomain} (${t.name})`);
    }
    return;
  }

  console.log(`Found tenant: ${tenant.id}`);
  console.log(`  Name: ${tenant.name}`);
  console.log(`  Subdomain: ${tenant.subdomain}`);

  // Check if 'asus' subdomain is available
  const existing = await prisma.tenant.findUnique({
    where: { subdomain: 'asus' },
  });

  if (existing && existing.id !== tenant.id) {
    console.log(`\n⚠️ Found existing tenant with 'asus' subdomain:`);
    console.log(`   ID: ${existing.id}`);
    console.log(`   Name: ${existing.name}`);
    console.log(`   Subdomain: ${existing.subdomain}`);
    console.log(`\n🔄 This is likely the correct tenant. The one with 'tenant-mJzclxSS' is a duplicate.`);
    console.log(`   Deleting the duplicate tenant...`);
    
    // Delete the duplicate tenant (the one with tenant-mjzclxss)
    try {
      await prisma.tenant.delete({
        where: { id: tenant.id },
      });
      console.log(`\n✅ Deleted duplicate tenant: ${tenant.id}`);
      console.log(`\n🚀 Now visit: http://asus.localhost:8080`);
    } catch (e) {
      console.log(`\n❌ Could not delete duplicate (may have related data). Please manually clean up.`);
    }
    return;
  }

  // Update the name and subdomain to 'asus'
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { 
      name: 'asus',
      subdomain: 'asus' 
    },
  });

  console.log(`\n✅ Updated tenant:`);
  console.log(`   Name: ${tenant.name} -> asus`);
  console.log(`   Subdomain: ${tenant.subdomain} -> asus`);
  console.log(`\n🚀 Now visit: http://asus.localhost:8080`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

