import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearEverything() {
  console.log('🗑️  Starting COMPLETE database cleanup (including users and tenants)...');

  try {
    // Delete all data in correct order
    console.log('Deleting order items...');
    await prisma.orderItem.deleteMany({});
    
    console.log('Deleting orders...');
    await prisma.order.deleteMany({});
    
    console.log('Deleting product images...');
    await prisma.productImage.deleteMany({});
    
    console.log('Deleting product variants...');
    await prisma.productVariant.deleteMany({});
    
    console.log('Deleting product categories...');
    await prisma.productCategory.deleteMany({});
    
    console.log('Deleting products...');
    await prisma.product.deleteMany({});
    
    console.log('Deleting categories...');
    await prisma.category.deleteMany({});
    
    console.log('Deleting pages...');
    await prisma.page.deleteMany({});
    
    console.log('Deleting site configs...');
    await prisma.siteConfig.deleteMany({});
    
    console.log('Deleting users...');
    await prisma.user.deleteMany({});
    
    console.log('Deleting tenants...');
    await prisma.tenant.deleteMany({});
    
    console.log('✅ COMPLETE database cleanup successful!');
    console.log('📝 You can now create fresh accounts with proper multi-tenancy!');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearEverything();
