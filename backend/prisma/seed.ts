import { PrismaClient, UserRole, DriverStatus, CarStatus, TransferStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const superAdminEmail = 'vip.transfer.astana@gmail.com';
  const superAdminPassword = 'Aa123456';

  // Ensure there is only one admin in the system
  await prisma.user.updateMany({
    where: {
      role: UserRole.ADMIN,
      email: { not: superAdminEmail },
    },
    data: {
      role: UserRole.DISPATCHER,
      driverId: null,
    },
  });

  // Create or update the only super admin user
  const hashedPassword = await bcrypt.hash(superAdminPassword, 10);
  
  const admin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {
      password: hashedPassword,
      name: 'Суперадмин',
      role: UserRole.ADMIN,
      driverId: null,
    },
    create: {
      email: superAdminEmail,
      password: hashedPassword,
      name: 'Суперадмин',
      role: UserRole.ADMIN,
    },
  });

  // Create dispatcher
  const dispatcherPassword = await bcrypt.hash('dispatcher123', 10);
  const dispatcher = await prisma.user.upsert({
    where: { email: 'dispatcher@transfer.com' },
    update: {
      password: dispatcherPassword,
      name: 'Диспетчер',
      role: UserRole.DISPATCHER,
      driverId: null,
    },
    create: {
      email: 'dispatcher@transfer.com',
      password: dispatcherPassword,
      name: 'Диспетчер',
      role: UserRole.DISPATCHER,
    },
  });

  // Create drivers
  const driver1 = await prisma.driver.upsert({
    where: { id: 1 },
    update: {},
    create: {
      fullName: 'Иванов Иван Иванович',
      phone: '+7 (701) 123-45-67',
      status: DriverStatus.ACTIVE,
      note: 'Опытный водитель, 10 лет стажа',
    },
  });

  const driver2 = await prisma.driver.upsert({
    where: { id: 2 },
    update: {},
    create: {
      fullName: 'Петров Пётр Петрович',
      phone: '+7 (702) 234-56-78',
      status: DriverStatus.ACTIVE,
      note: 'VIP трансферы',
    },
  });

  const driver3 = await prisma.driver.upsert({
    where: { id: 3 },
    update: {},
    create: {
      fullName: 'Сидоров Сидор Сидорович',
      phone: '+7 (703) 345-67-89',
      status: DriverStatus.DAY_OFF,
    },
  });

  // Create driver user
  const driverPassword = await bcrypt.hash('driver123', 10);
  await prisma.user.upsert({
    where: { email: 'driver@transfer.com' },
    update: {
      password: driverPassword,
      name: driver1.fullName,
      role: UserRole.DRIVER,
      driverId: driver1.id,
    },
    create: {
      email: 'driver@transfer.com',
      password: driverPassword,
      name: driver1.fullName,
      role: UserRole.DRIVER,
      driverId: driver1.id,
    },
  });

  // Create cars
  const car1 = await prisma.car.upsert({
    where: { plateNumber: 'A001AA01' },
    update: {},
    create: {
      brand: 'Mercedes-Benz',
      model: 'S-Class',
      plateNumber: 'A001AA01',
      status: CarStatus.FREE,
    },
  });

  const car2 = await prisma.car.upsert({
    where: { plateNumber: 'B002BB02' },
    update: {},
    create: {
      brand: 'BMW',
      model: '7 Series',
      plateNumber: 'B002BB02',
      status: CarStatus.FREE,
    },
  });

  const car3 = await prisma.car.upsert({
    where: { plateNumber: 'C003CC03' },
    update: {},
    create: {
      brand: 'Toyota',
      model: 'Camry',
      plateNumber: 'C003CC03',
      status: CarStatus.MAINTENANCE,
    },
  });

  // Create sample transfers
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startTime1 = new Date(today);
  startTime1.setHours(9, 0, 0, 0);
  const endTime1 = new Date(today);
  endTime1.setHours(11, 0, 0, 0);

  await prisma.transfer.upsert({
    where: { id: 1 },
    update: {},
    create: {
      date: today,
      startTime: startTime1,
      endTime: endTime1,
      origin: 'Аэропорт Алматы',
      destination: 'Отель Rixos',
      driverId: driver1.id,
      carId: car1.id,
      status: TransferStatus.PLANNED,
      comment: 'VIP клиент',
    },
  });

  const startTime2 = new Date(today);
  startTime2.setHours(14, 0, 0, 0);
  const endTime2 = new Date(today);
  endTime2.setHours(16, 0, 0, 0);

  await prisma.transfer.upsert({
    where: { id: 2 },
    update: {},
    create: {
      date: today,
      startTime: startTime2,
      endTime: endTime2,
      origin: 'Отель Rixos',
      destination: 'Деловой центр',
      driverId: driver2.id,
      carId: car2.id,
      status: TransferStatus.PLANNED,
    },
  });

  console.log('Seed data created successfully!');
  console.log('Login credentials:');
  console.log(`Super Admin: ${superAdminEmail} / ${superAdminPassword}`);
  console.log('Dispatcher: dispatcher@transfer.com / dispatcher123');
  console.log('Driver: driver@transfer.com / driver123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
