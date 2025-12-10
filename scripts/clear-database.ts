import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearDatabase() {
  console.log('🗑️  Starting database cleanup...');

  try {
    // Delete in correct order to respect foreign key constraints
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
    
    console.log('✅ Database cleared successfully!');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase();
