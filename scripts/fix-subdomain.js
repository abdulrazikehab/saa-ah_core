"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🔧 Fixing domain and subdomain issues...\n');
    // 1. Find the tenant with the weird subdomain
    const weirdTenant = await prisma.tenant.findFirst({
        where: {
            subdomain: {
                startsWith: 'market-old-',
            },
        },
    });
    if (weirdTenant) {
        console.log(`Found tenant with subdomain: ${weirdTenant.subdomain}`);
        console.log(`Tenant ID: ${weirdTenant.id}\n`);
        // Update it to use 'market' subdomain
        await prisma.tenant.update({
            where: { id: weirdTenant.id },
            data: { subdomain: 'market' },
        });
        console.log(`✅ Updated tenant subdomain to 'market'\n`);
    }
    // 2. Ensure 'default' tenant exists with 'market' subdomain
    const defaultTenant = await prisma.tenant.upsert({
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
    console.log('✅ Default tenant ensured:', defaultTenant.subdomain);
    // 3. Update all pages to belong to the correct tenant
    const pages = await prisma.page.findMany();
    console.log(`\n📄 Found ${pages.length} pages`);
    for (const page of pages) {
        if (page.tenantId !== defaultTenant.id) {
            await prisma.page.update({
                where: { id: page.id },
                data: { tenantId: defaultTenant.id },
            });
            console.log(`✅ Updated page "${page.title}" to tenant: ${defaultTenant.id}`);
        }
    }
    // 4. Ensure CustomDomain exists
    try {
        const customDomain = await prisma.customDomain.upsert({
            where: { domain: 'market.localhost' },
            update: {
                tenantId: defaultTenant.id,
                status: 'ACTIVE',
            },
            create: {
                domain: 'market.localhost',
                tenantId: defaultTenant.id,
                status: 'ACTIVE',
                sslStatus: 'ACTIVE',
            },
        });
        console.log('\n✅ CustomDomain ensured:', customDomain.domain);
    }
    catch (e) {
        console.error('Error with custom domain:', e);
    }
    // 5. Clean up old subdomains
    const oldTenants = await prisma.tenant.findMany({
        where: {
            subdomain: {
                startsWith: 'market-old-',
            },
        },
    });
    if (oldTenants.length > 0) {
        console.log(`\n🧹 Cleaning up ${oldTenants.length} old tenants...`);
        for (const tenant of oldTenants) {
            // Don't delete, just rename to avoid conflicts
            await prisma.tenant.update({
                where: { id: tenant.id },
                data: { subdomain: `archived-${tenant.id}` },
            });
            console.log(`✅ Archived tenant: ${tenant.subdomain} -> archived-${tenant.id}`);
        }
    }
    console.log('\n✅ All fixes applied!');
    console.log('\n📋 Summary:');
    console.log(`   - Subdomain: market`);
    console.log(`   - Tenant ID: ${defaultTenant.id}`);
    console.log(`   - Pages: ${pages.length}`);
    console.log(`\n🚀 Now visit: http://market.localhost:8080`);
}
main()
    .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
