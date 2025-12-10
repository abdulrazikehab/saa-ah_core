const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createSuperAdmin() {
  try {
    console.log('🔧 Creating Super Admin User...\n');

    // Configuration
    const superAdminEmail = 'admin@saaah.com';
    const superAdminPassword = 'Admin@123456'; // Change this to your desired password
    const superAdminName = 'Super Administrator';

    // Hash the password
    const hashedPassword = await bcrypt.hash(superAdminPassword, 10);
    console.log('✅ Password hashed successfully');

    // Check if super admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: superAdminEmail },
    });

    if (existingAdmin) {
      console.log('⚠️  Super admin already exists. Updating password and role...\n');
      
      // Update existing user
      const updatedUser = await prisma.user.update({
        where: { email: superAdminEmail },
        data: {
          password: hashedPassword,
          role: 'SUPER_ADMIN',
          name: superAdminName,
          tenantId: null,
        },
      });

      console.log('✅ Super Admin Updated Successfully!\n');
      console.log('═══════════════════════════════════════');
      console.log('📧 Email:', superAdminEmail);
      console.log('🔑 Password:', superAdminPassword);
      console.log('👤 Role:', updatedUser.role);
      console.log('🆔 User ID:', updatedUser.id);
      console.log('═══════════════════════════════════════');
    } else {
      console.log('📝 Creating new super admin user...\n');
      
      // Create new super admin user
      const newUser = await prisma.user.create({
        data: {
          email: superAdminEmail,
          password: hashedPassword,
          role: 'SUPER_ADMIN',
          name: superAdminName,
          tenantId: null, // Super admin is not tied to any tenant
        },
      });

      console.log('✅ Super Admin Created Successfully!\n');
      console.log('═══════════════════════════════════════');
      console.log('📧 Email:', superAdminEmail);
      console.log('🔑 Password:', superAdminPassword);
      console.log('👤 Role:', newUser.role);
      console.log('🆔 User ID:', newUser.id);
      console.log('═══════════════════════════════════════');
    }

    console.log('\n🎉 Setup Complete!');
    console.log('\n📝 Next Steps:');
    console.log('1. Login at: http://localhost:5173/login');
    console.log('2. Use the credentials above');
    console.log('3. Access Master Dashboard at: http://localhost:5173/master-dashboard');
    console.log('\n⚠️  IMPORTANT: Change the password after first login!');

  } catch (error) {
    console.error('❌ Error creating super admin:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createSuperAdmin()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
