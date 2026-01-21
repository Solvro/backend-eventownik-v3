import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { parseSortInput } from "src/common/utils/prisma.utility";
import { Prisma } from "src/generated/prisma/browser";

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { CreateFormDto } from "./dto/create-form.dto";
import { FormListingDto } from "./dto/form-listing.dto";
import { UpdateFormDto } from "./dto/update-form.dto";

@Injectable()
export class FormsService {
  constructor(private prisma: PrismaService) {}

  async create(eventUuid: string, createFormDto: CreateFormDto) {
    const event = await this.prisma.event.findFirst({
      where: { uuid: eventUuid },
    });
    if (event == null) {
      throw new NotFoundException(`Event with id: ${eventUuid} not found`);
    }

    return await this.prisma.$transaction(async (prisma) => {
      const form = await prisma.form.create({
        data: {
          name: createFormDto.name,
          isEditable: createFormDto.isEditable,
          openDate: createFormDto.openDate,
          closeDate: createFormDto.closeDate,
          description: createFormDto.description,
          eventUuid: event.uuid,
        },
      });
      if (createFormDto.isFirstForm ?? false) {
        if (event.registerFormUuid != null) {
          throw new BadRequestException(
            `Event with id: ${eventUuid} already has a first form assigned`,
          );
        }
        await prisma.event.update({
          where: { uuid: eventUuid },
          data: { registerFormUuid: form.uuid },
        });
      }

      for (const attribute of createFormDto.attributes) {
        const attributesExists = await prisma.attribute.findFirst({
          where: { uuid: attribute.attributeUuid },
        });
        if (attributesExists == null) {
          throw new NotFoundException(
            `Attribute with id: ${attribute.attributeUuid} not found`,
          );
        }
      }

      const formAttributesData = createFormDto.attributes.map((attribute) => ({
        formUuid: form.uuid,
        attributeUuid: attribute.attributeUuid,
        isRequired: attribute.isRequired,
        order: attribute.order,
      }));

      await prisma.formDefinition.createMany({
        data: formAttributesData,
      });

      return form;
    });
  }

  async findAll(eventUuid: string, query: FormListingDto) {
    const event = await this.prisma.event.findFirst({
      where: { uuid: eventUuid },
    });
    if (event == null) {
      throw new NotFoundException(`Event with id: ${eventUuid} not found`);
    }
    const { skip, take, name, isEditable, sort } = query;
    const where: Prisma.FormWhereInput = {
      eventUuid: event.uuid,
      ...(name === undefined
        ? {}
        : { name: { contains: name, mode: "insensitive" } }),
      ...(isEditable === undefined ? {} : { isEditable }),
    };
    const orderBy = parseSortInput(sort, ["name", "createdAt", "openDate"]);
    if (orderBy.length === 0) {
      orderBy.push({ createdAt: "desc" });
    }
    const [itemCount, forms] = await this.prisma.$transaction([
      this.prisma.form.count({ where }),
      this.prisma.form.findMany({
        where,
        skip,
        take,
        orderBy,
      }),
    ]);
    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto: query });
    return new PageDto(forms, pageMetaDto);
  }

  async findOne(formUuid: string, eventUuid: string) {
    const form = await this.prisma.form.findFirst({
      where: { uuid: formUuid, eventUuid },
      include: {
        formDefinitions: {
          include: { attribute: true },
        },
      },
    });
    if (form == null) {
      throw new NotFoundException(`Form with id: ${formUuid} not found`);
    }
    return form;
  }

  async update(
    formUuid: string,
    eventUuid: string,
    updateFormDto: UpdateFormDto,
  ) {
    const event = await this.prisma.event.findFirst({
      where: { uuid: eventUuid },
    });
    if (event == null) {
      throw new NotFoundException(`Event with id: ${eventUuid} not found`);
    }
    return await this.prisma.$transaction(async (prisma) => {
      if (updateFormDto.isFirstForm ?? false) {
        if (
          event.registerFormUuid !== null &&
          event.registerFormUuid !== formUuid
        ) {
          throw new BadRequestException(
            `Event with id: ${eventUuid} already has a first form assigned`,
          );
        }
        await prisma.event.update({
          where: { uuid: eventUuid },
          data: { registerFormUuid: formUuid },
        });
      } else if (event.registerFormUuid === formUuid) {
        await prisma.event.update({
          where: { uuid: eventUuid },
          data: { registerFormUuid: null },
        });
      }

      if (
        updateFormDto.attributes != null &&
        updateFormDto.attributes.length > 0
      ) {
        for (const attribute of updateFormDto.attributes) {
          const attributesExists = await prisma.attribute.findFirst({
            where: { uuid: attribute.attributeUuid },
          });
          if (attributesExists == null) {
            throw new NotFoundException(
              `Attribute with id: ${attribute.attributeUuid} not found`,
            );
          }
        }
        await prisma.formDefinition.deleteMany({
          where: { formUuid },
        });
        await prisma.formDefinition.createMany({
          data: updateFormDto.attributes.map((attribute) => ({
            formUuid,
            attributeUuid: attribute.attributeUuid,
            isRequired: attribute.isRequired,
            order: attribute.order,
          })),
        });
      }
      return await prisma.form.update({
        where: { uuid: formUuid },
        data: {
          name: updateFormDto.name,
          isEditable: updateFormDto.isEditable,
          openDate: updateFormDto.openDate,
          closeDate: updateFormDto.closeDate,
          description: updateFormDto.description,
        },
        include: {
          formDefinitions: {
            include: { attribute: true },
          },
        },
      });
    });
  }

  async remove(formUuid: string, eventUuid: string) {
    const event = await this.prisma.event.findFirst({
      where: { uuid: eventUuid },
    });
    if (event == null) {
      throw new NotFoundException(`Event with id: ${eventUuid} not found`);
    }
    return await this.prisma.$transaction(async (prisma) => {
      if (event.registerFormUuid === formUuid) {
        await prisma.event.update({
          where: { uuid: eventUuid },
          data: { registerFormUuid: null },
        });
      }
      const deletedForms = await prisma.form.deleteMany({
        where: { uuid: formUuid, eventUuid },
      });
      if (deletedForms.count === 0) {
        throw new NotFoundException(
          `Form with id: ${formUuid} not found or doesnt belong to event ${eventUuid}`,
        );
      }
      return deletedForms;
    });
  }
}
