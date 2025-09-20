import { Attribute } from "@prisma/client";

import { Injectable, NotFoundException } from "@nestjs/common";

import { QueryListingDto } from "../prisma/dto/query-listing.dto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAttributeDto } from "./dto/create-attribute.dto";
import { UpdateAttributeDto } from "./dto/update-attribute.dto";

@Injectable()
export class AttributesService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateAttributeDto) {
    return this.prisma.attribute.create({ data });
  }

  async findAll(query: QueryListingDto): Promise<Attribute[]> {
    const prismaQuery = query.toPrisma("Attribute");
    return this.prisma.attribute.findMany({
      ...prismaQuery,
    });
  }

  async findOne(uuid: string): Promise<Attribute> {
    const attribute = await this.prisma.attribute.findUnique({
      where: { uuid },
    });
    if (attribute == null) {
      throw new NotFoundException(`Attribute ${uuid} not found`);
    }
    return attribute;
  }

  async update(uuid: string, data: UpdateAttributeDto) {
    return this.prisma.attribute.update({
      where: { uuid },
      data,
    });
  }

  async remove(uuid: string) {
    return this.prisma.attribute.delete({
      where: { uuid },
    });
  }
}
