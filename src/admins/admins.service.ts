import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { parseSortInput } from "src/common/utils/prisma.utility";
import { Prisma } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import { Injectable, NotFoundException } from "@nestjs/common";

import { CreateAdminDto } from "./dto/create-admin.dto";
import { ListAdminDto } from "./dto/list-admin.dto";
import { UpdateAdminDto } from "./dto/update-admin.dto";

@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAdminDto: CreateAdminDto) {
    return await this.prisma.$transaction(async (tx) => {
      const admin = await tx.admin.create({
        data: { ...(createAdminDto as Prisma.AdminCreateInput) },
      });
      return admin; // TODO: add permissions attachment
    });
  }

  async findAll(query: ListAdminDto) {
    const { skip, take, email, firstName, lastName, type, sort } = query;

    const where: Prisma.AdminWhereInput = {
      ...(email === undefined
        ? {}
        : { email: { contains: email, mode: "insensitive" } }),
      ...(firstName === undefined
        ? {}
        : { firstName: { contains: firstName, mode: "insensitive" } }),
      ...(lastName === undefined
        ? {}
        : { lastName: { contains: lastName, mode: "insensitive" } }),
      ...(type === undefined ? {} : { type: { equals: type } }),
    };

    const orderBy = parseSortInput(sort, [
      "email",
      "firstName",
      "lastName",
      "createdAt",
    ]);

    if (orderBy.length === 0) {
      orderBy.push({ createdAt: "desc" });
    }

    const [itemCount, admins] = await this.prisma.$transaction([
      this.prisma.admin.count({ where }),
      this.prisma.admin.findMany({
        where,
        skip,
        take,
        orderBy,
      }),
    ]);
    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto: query });
    return new PageDto(admins, pageMetaDto);
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
          ...(updateAdminDto as Prisma.AdminUpdateInput),
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
