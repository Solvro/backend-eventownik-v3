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
    if (
      createFormDto.openDate != null &&
      createFormDto.closeDate != null &&
      createFormDto.openDate >= createFormDto.closeDate
    ) {
      throw new BadRequestException(
        "Open date must be earlier than close date",
      );
    }

    return await this.prisma.$transaction(async (prisma) => {
      const event = await prisma.event.findUnique({
        where: { uuid: eventUuid },
      });
      if (event == null) {
        throw new NotFoundException(`Event with id: ${eventUuid} not found`);
      }
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
      const attributeUuids = createFormDto.attributes.map(
        (attribute) => attribute.attributeUuid,
      );
      const attributeUuidsSet = new Set(attributeUuids);
      if (attributeUuids.length !== attributeUuidsSet.size) {
        throw new BadRequestException(
          "Duplicate attribute UUIDs found in form attributes",
        );
      }

      const existingAttributes = await prisma.attribute.count({
        where: { uuid: { in: attributeUuids }, eventUuid: event.uuid },
      });
      if (existingAttributes !== attributeUuids.length) {
        throw new NotFoundException(
          `One or more attributes not found for the provided attribute and event UUIDs`,
        );
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
    const event = await this.prisma.event.findUnique({
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
    const form = await this.prisma.form.findUnique({
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
    if (
      updateFormDto.openDate != null &&
      updateFormDto.closeDate != null &&
      updateFormDto.openDate >= updateFormDto.closeDate
    ) {
      throw new BadRequestException(
        "Open date must be earlier than close date",
      );
    }

    return await this.prisma.$transaction(async (prisma) => {
      const event = await prisma.event.findUnique({
        where: { uuid: eventUuid },
      });
      if (event == null) {
        throw new NotFoundException(`Event with id: ${eventUuid} not found`);
      }
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
        const attributeUuids = updateFormDto.attributes.map(
          (attribute) => attribute.attributeUuid,
        );
        const attributeUuidsSet = new Set(attributeUuids);
        if (attributeUuids.length !== attributeUuidsSet.size) {
          throw new BadRequestException(
            "Duplicate attribute UUIDs found in form attributes",
          );
        }
        const existingAttributes = await prisma.attribute.count({
          where: {
            uuid: {
              in: attributeUuids,
            },
            eventUuid: event.uuid,
          },
        });
        if (existingAttributes !== attributeUuids.length) {
          throw new NotFoundException(
            `One or more attributes not found for the provided attribute and event UUIDs`,
          );
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
    return await this.prisma.$transaction(async (prisma) => {
      const event = await prisma.event.findUnique({
        where: { uuid: eventUuid },
      });
      if (event == null) {
        throw new NotFoundException(`Event with id: ${eventUuid} not found`);
      }
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
          `Form with id: ${formUuid} not found or does not belong to event ${eventUuid}`,
        );
      }
      return deletedForms;
    });
  }
}
