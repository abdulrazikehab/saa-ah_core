import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto, EmployeeListQuery } from '../dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);

  constructor(private prisma: PrismaService) {}

  // Create employee
  async create(merchantId: string, dto: CreateEmployeeDto) {
    // Check if username is taken within merchant
    const existing = await this.prisma.employee.findUnique({
      where: { merchantId_username: { merchantId, username: dto.username } },
    });

    if (existing) {
      throw new ConflictException('Username already taken');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const employee = await this.prisma.employee.create({
      data: {
        merchantId,
        name: dto.name,
        username: dto.username,
        passwordHash,
        phone: dto.phone,
        permissions: dto.permissions as any,
        status: 'ACTIVE',
      },
    });

    this.logger.log(`Created employee ${employee.id} for merchant ${merchantId}`);

    // Return without password hash
    const { passwordHash: _, ...result } = employee;
    return result;
  }

  // Get all employees for merchant
  async findAll(merchantId: string, query: EmployeeListQuery) {
    const where: any = { merchantId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { username: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const employees = await this.prisma.employee.findMany({
      where,
      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        status: true,
        permissions: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return employees;
  }

  // Get single employee
  async findOne(merchantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, merchantId },
      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        status: true,
        permissions: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }

  // Update employee
  async update(merchantId: string, employeeId: string, dto: UpdateEmployeeDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, merchantId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const updateData: any = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.permissions !== undefined) updateData.permissions = dto.permissions;

    // Update password if provided
    if (dto.password) {
      updateData.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const updated = await this.prisma.employee.update({
      where: { id: employeeId },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        status: true,
        permissions: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Updated employee ${employeeId}`);

    return updated;
  }

  // Delete (soft-disable) employee
  async delete(merchantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, merchantId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Soft delete by disabling
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { status: 'DISABLED' },
    });

    this.logger.log(`Disabled employee ${employeeId}`);

    return { ok: true };
  }

  // Validate employee credentials
  async validateCredentials(merchantId: string, username: string, password: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { merchantId, username, status: 'ACTIVE' },
      include: {
        merchant: { select: { id: true, tenantId: true, status: true } },
      },
    });

    if (!employee || !employee.passwordHash) {
      return null;
    }

    const isValid = await bcrypt.compare(password, employee.passwordHash);
    if (!isValid) {
      return null;
    }

    return employee;
  }

  // Get employee by ID with merchant context
  async getEmployeeWithContext(employeeId: string) {
    return this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        merchant: {
          select: { id: true, tenantId: true, status: true, businessName: true },
        },
      },
    });
  }
}

