// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Starting demo data seed...');

  // Seed default partners first
  await seedDefaultPartners();
  
  // Seed subscription plans
  await seedSubscriptionPlans();

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
  
  // Seed data for each tenant
  for (const tenant of tenants) {
    console.log(`\n🔄 Seeding data for tenant: ${tenant.name} (${tenant.id})...`);
    
    await seedTenantData(tenant.id);
  }

  console.log('\n🎉 Demo data seed complete!');
}

// Seed default partners (ASUS, Smart Line)
async function seedDefaultPartners() {
  console.log('\n🤝 Seeding default partners...');
  
  const defaultPartners = [
    {
      name: 'ASUS',
      nameAr: 'أسس',
      email: 'partners@asus.com',
      phone: '+966501234567',
      commissionType: 'PERCENTAGE' as const,
      commissionValue: 10,
      allowedFeatures: ['products', 'digital_cards', 'gaming'],
      isActive: true,
    },
    {
      name: 'Smart Line',
      nameAr: 'سمارت لاين',
      email: 'partners@smartline.sa',
      phone: '+966507654321',
      commissionType: 'PERCENTAGE' as const,
      commissionValue: 15,
      allowedFeatures: ['marketing', 'social_media', 'advertising'],
      isActive: true,
    },
  ];

  for (const partner of defaultPartners) {
    const existing = await prisma.partner.findUnique({
      where: { email: partner.email },
    });

    if (existing) {
      console.log(`  ⚠️ Partner ${partner.name} already exists – skipping`);
      continue;
    }

    await prisma.partner.create({ data: partner });
    console.log(`  ✅ Created partner: ${partner.name}`);
  }
}

// Seed subscription plans
async function seedSubscriptionPlans() {
  console.log('\n📋 Seeding subscription plans...');
  
  const defaultPlans = [
    {
      code: 'STARTER',
      name: 'Starter',
      nameAr: 'المبتدئ',
      description: 'Perfect for small businesses just getting started',
      descriptionAr: 'مثالية للأعمال الصغيرة التي تبدأ للتو',
      price: 99,
      currency: 'SAR',
      billingCycle: 'MONTHLY',
      features: [
        'Up to 100 products',
        'Basic analytics',
        'Email support',
        'Standard templates',
        'Basic payment integration',
      ],
      featuresAr: [
        'حتى 100 منتج',
        'تحليلات أساسية',
        'دعم بالبريد الإلكتروني',
        'قوالب قياسية',
        'تكامل دفع أساسي',
      ],
      limits: { products: 100, orders: 500, storage: 5, staff: 2, customDomains: 0 },
      isActive: true,
      isPopular: false,
      sortOrder: 1,
    },
    {
      code: 'PROFESSIONAL',
      name: 'Professional',
      nameAr: 'المحترف',
      description: 'For growing businesses that need more power',
      descriptionAr: 'للأعمال النامية التي تحتاج المزيد من القوة',
      price: 299,
      currency: 'SAR',
      billingCycle: 'MONTHLY',
      features: [
        'Unlimited products',
        'Advanced analytics',
        'Priority support',
        'Custom domain',
        'All payment integrations',
        'Page builder',
        'AI assistant',
      ],
      featuresAr: [
        'منتجات غير محدودة',
        'تحليلات متقدمة',
        'دعم أولوية',
        'نطاق مخصص',
        'جميع تكاملات الدفع',
        'منشئ الصفحات',
        'مساعد ذكي',
      ],
      limits: { products: -1, orders: -1, storage: 50, staff: 10, customDomains: 1 },
      isActive: true,
      isPopular: true,
      sortOrder: 2,
    },
    {
      code: 'ENTERPRISE',
      name: 'Enterprise',
      nameAr: 'المؤسسات',
      description: 'For large enterprises with custom needs',
      descriptionAr: 'للمؤسسات الكبيرة ذات الاحتياجات المخصصة',
      price: 999,
      currency: 'SAR',
      billingCycle: 'MONTHLY',
      features: [
        'Everything in Professional',
        'Dedicated account manager',
        'Custom integrations',
        'SLA guarantee',
        'White-label option',
        'API access',
        'Custom development',
      ],
      featuresAr: [
        'كل مميزات المحترف',
        'مدير حساب مخصص',
        'تكاملات مخصصة',
        'ضمان مستوى الخدمة',
        'خيار العلامة البيضاء',
        'وصول API',
        'تطوير مخصص',
      ],
      limits: { products: -1, orders: -1, storage: -1, staff: -1, customDomains: -1 },
      isActive: true,
      isPopular: false,
      sortOrder: 3,
    },
  ];

  for (const plan of defaultPlans) {
    const existing = await prisma.subscriptionPlan.findFirst({
      where: { code: plan.code },
    });

    if (existing) {
      console.log(`  ⚠️ Plan ${plan.name} already exists – updating`);
      await prisma.subscriptionPlan.update({
        where: { id: existing.id },
        data: plan,
      });
      continue;
    }

    await prisma.subscriptionPlan.create({ data: plan });
    console.log(`  ✅ Created plan: ${plan.name}`);
  }
}

async function seedTenantData(tenantId: string) {
  // Create categories
  const categories = [
    {
      id: 'gaming',
      tenantId,
      name: 'Gaming & PUBG',
      description: 'Gaming cards, PUBG UC, game credits',
      slug: 'gaming-pubg',
      image: null,
      isActive: true,
    },
    {
      id: 'playstation',
      tenantId,
      name: 'PlayStation Store',
      description: 'PS Plus, PS Store cards, games',
      slug: 'playstation-store',
      image: null,
      isActive: true,
    },
    {
      id: 'communications',
      tenantId,
      name: 'Chat & Communications',
      description: 'Recharge cards, chat credits, VoIP',
      slug: 'chat-communications',
      image: null,
      isActive: true,
    },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: { tenantId },
      create: cat,
    });
  }
  console.log('  ✅ Created/updated categories');

  // Helper for placeholder images
  const placeholderImage = (title: string) => ({
    url: `https://picsum.photos/seed/${encodeURIComponent(title)}/400/300`,
    altText: title,
    sortOrder: 0,
  });

  // Demo products
  const demoProducts = [
    {
      id: uuidv4(),
      tenantId,
      name: 'PUBG UC 1000',
      nameAr: 'شدات PUBG 1000',
      description: '1000 UC for PUBG Mobile – instantly usable.',
      descriptionAr: '1000 وحدة شحن للعبة PUBG Mobile – صالحة للاستخدام فوراً.',
      price: 49.99,
      sku: `PUBG-UC-1000-${tenantId.slice(0, 8)}`,
      isAvailable: true,
      isPublished: true,
      images: { create: [placeholderImage('PUBG UC 1000')] },
      variants: { create: [{ name: 'Standard', price: 49.99, sku: `PUBG-UC-1000-STD-${tenantId.slice(0, 8)}` }] },
      categories: { connect: { id: 'gaming' } },
    },
    {
      id: uuidv4(),
      tenantId,
      name: 'Gaming Gift Card $25',
      nameAr: 'بطاقة هدية ألعاب $25',
      description: 'Universal gaming credit usable on multiple platforms.',
      descriptionAr: 'رصيد ألعاب عالمي يمكن استعماله على عدة منصات.',
      price: 25.0,
      sku: `GIFT-25-${tenantId.slice(0, 8)}`,
      isAvailable: true,
      isPublished: true,
      images: { create: [placeholderImage('Gaming Gift Card $25')] },
      variants: { create: [{ name: 'Digital', price: 25.0, sku: `GIFT-25-DIG-${tenantId.slice(0, 8)}` }] },
      categories: { connect: { id: 'gaming' } },
    },
    {
      id: uuidv4(),
      tenantId,
      name: 'PS Plus 12‑Month Subscription',
      nameAr: 'اشتراك PS Plus 12 شهر',
      description: 'Full year of online multiplayer, free games & discounts.',
      descriptionAr: 'سنة كاملة من اللعب المتعدد عبر الإنترنت، ألعاب مجانية وخصومات.',
      price: 59.99,
      sku: `PSPLUS-12M-${tenantId.slice(0, 8)}`,
      isAvailable: true,
      isPublished: true,
      images: { create: [placeholderImage('PS Plus 12‑Month')] },
      variants: { create: [{ name: 'Digital', price: 59.99, sku: `PSPLUS-12M-DIG-${tenantId.slice(0, 8)}` }] },
      categories: { connect: { id: 'playstation' } },
    },
    {
      id: uuidv4(),
      tenantId,
      name: 'PlayStation Store $20 Card',
      nameAr: 'بطاقة متجر بلايستيشن $20',
      description: 'Spend $20 on games, DLCs, and add‑ons.',
      descriptionAr: 'استخدم 20 دولار لشراء ألعاب، محتوى إضافي، وإضافات.',
      price: 20.0,
      sku: `PS-20-${tenantId.slice(0, 8)}`,
      isAvailable: true,
      isPublished: true,
      images: { create: [placeholderImage('PS Store $20')] },
      variants: { create: [{ name: 'Digital', price: 20.0, sku: `PS-20-DIG-${tenantId.slice(0, 8)}` }] },
      categories: { connect: { id: 'playstation' } },
    },
    {
      id: uuidv4(),
      tenantId,
      name: 'WhatsApp Business Credits 500',
      nameAr: 'رصيد واتساب بزنس 500',
      description: '500 message credits for WhatsApp Business API.',
      descriptionAr: '500 رصيد رسائل لواجهة برمجة تطبيق واتساب للأعمال.',
      price: 15.0,
      sku: `WA‑500-${tenantId.slice(0, 8)}`,
      isAvailable: true,
      isPublished: true,
      images: { create: [placeholderImage('WhatsApp Credits 500')] },
      variants: { create: [{ name: 'Digital', price: 15.0, sku: `WA‑500-DIG-${tenantId.slice(0, 8)}` }] },
      categories: { connect: { id: 'communications' } },
    },
    {
      id: uuidv4(),
      tenantId,
      name: 'Mobile Recharge $10',
      nameAr: 'شحن هاتف $10',
      description: 'Top‑up any mobile number with $10 credit.',
      descriptionAr: 'شحن أي رقم هاتف ب10 دولارات.',
      price: 10.0,
      sku: `MOB‑10-${tenantId.slice(0, 8)}`,
      isAvailable: true,
      isPublished: true,
      images: { create: [placeholderImage('Mobile Recharge $10')] },
      variants: { create: [{ name: 'Digital', price: 10.0, sku: `MOB‑10-DIG-${tenantId.slice(0, 8)}` }] },
      categories: { connect: { id: 'communications' } },
    },
  ];

  for (const prod of demoProducts) {
    const existing = await prisma.product.findUnique({ where: { sku: prod.sku } });
    if (existing) {
      console.log(`  ⚠️ SKU ${prod.sku} already exists – skipping`);
      continue;
    }

    const { categories, ...productData } = prod;
    await prisma.product.create({
      data: {
        ...productData,
        categories: {
          create: {
            category: {
              connect: { id: categories.connect.id }
            }
          }
        }
      },
    });
    console.log(`  ✅ Created product ${prod.name}`);
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
