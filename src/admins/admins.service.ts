import { Prisma } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import { Injectable, NotFoundException } from "@nestjs/common";

import { CreateAdminDto } from "./dto/create-admin.dto";
import { UpdateAdminDto } from "./dto/update-admin.dto";

@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAdminDto: CreateAdminDto) {
    return await this.prisma.$transaction(async (tx) => {
      const admin = await tx.admin.create({
        data: {
          firstName: createAdminDto.fistName,
          lastName: createAdminDto.lastName,
          email: createAdminDto.email,
          password: createAdminDto.password,
          type: createAdminDto.type,
          active: createAdminDto.active,
        },
      });
      return admin; // TODO: add permissions attachment
    });
  }

  async findAll() {
    return await this.prisma.admin.findMany();
  }

  async findOne(id: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { uuid: id },
    });
    if (admin == null) {
      throw new NotFoundException("Admin not found");
    }
    return admin;
  }

  async update(id: string, updateAdminDto: UpdateAdminDto) {
    try {
      const admin = await this.prisma.admin.update({
        where: { uuid: id },
        data: {
          firstName: updateAdminDto.fistName,
          lastName: updateAdminDto.lastName,
          email: updateAdminDto.email,
          password: updateAdminDto.password,
          type: updateAdminDto.type,
          active: updateAdminDto.active,
        },
      });
      return admin;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException(`Admin with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.admin.delete({
        where: { uuid: id },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException(`Admin with ID ${id} not found`);
      }
      throw error;
    }
  }
}
