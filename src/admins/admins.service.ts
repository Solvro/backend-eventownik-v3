import * as bcrypt from "bcrypt";
import { AuthUser } from "src/auth/jwt.strategy";
import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { parseSortInput } from "src/common/utils/prisma.utility";
import { Prisma } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { CreateAdminDto } from "./dto/create-admin.dto";
import { ListAdminDto } from "./dto/list-admin.dto";
import { UpdateAdminDto } from "./dto/update-admin.dto";
import { Admin } from "./entities/admin.entity";

@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAdminDto: CreateAdminDto) {
    const { password, ...adminData } = createAdminDto;
    const hashedPassword = await bcrypt.hash(password, 12);

    return await this.prisma.$transaction(async (tx) => {
      try {
        const admin = await tx.admin.create({
          data: {
            ...(adminData as Prisma.AdminCreateInput),
            password: hashedPassword,
          },
        });
        return Object.assign(new Admin(), admin);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new ConflictException(
            `Admin with email ${adminData.email} already exists`,
          );
        }
        throw error;
      }
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
    const adminEntities = admins.map((admin) =>
      Object.assign(new Admin(), admin),
    );
    return new PageDto(adminEntities, pageMetaDto);
  }

  async findOne(id: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { uuid: id },
    });
    if (admin == null) {
      throw new NotFoundException(`Admin with UUID ${id} not found`);
    }
    return Object.assign(new Admin(), admin);
  }

  async update(id: string, updateAdminDto: UpdateAdminDto) {
    const { password, ...adminData } = updateAdminDto;
    const hasNonEmptyPassword =
      password !== undefined && password.trim().length > 0;

    const hashedPassword = hasNonEmptyPassword
      ? await bcrypt.hash(password, 12)
      : undefined;
    try {
      return Object.assign(
        new Admin(),
        await this.prisma.admin.update({
          where: { uuid: id },
          data: {
            ...adminData,
            ...(hasNonEmptyPassword ? { password: hashedPassword } : {}),
          },
        }),
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          throw new NotFoundException(`Admin with UUID ${id} not found`);
        }

        if (error.code === "P2002") {
          throw new ConflictException("Email already in use");
        }
      }
      throw error;
    }
  }

  async remove(id: string, currentAdmin: AuthUser) {
    if (currentAdmin.uuid === id) {
      throw new ConflictException("You cannot delete your own account");
    }
    try {
      return Object.assign(
        new Admin(),
        await this.prisma.admin.delete({
          where: { uuid: id },
        }),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException(`Admin with UUID ${id} not found`);
      }
      throw error;
    }
  }
}
