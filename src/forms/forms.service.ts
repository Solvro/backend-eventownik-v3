import { isString } from "class-validator";
import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { parseSortInput } from "src/common/utils/prisma.utility";
import { OpenCondition, Prisma } from "src/generated/prisma/browser";
import { Attribute, AttributeType } from "src/generated/prisma/client";
import { ParticipantAttributeDto } from "src/participants/dto/participant-create.dto";
import { ParticipantUpdateDto } from "src/participants/dto/participant-update.dto";
import { ParticipantsService } from "src/participants/participants.service";

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { CreateFormDto } from "./dto/create-form.dto";
import { FormListingDto } from "./dto/form-listing.dto";
import { FormSubmitionDto } from "./dto/form-submition.dto";
import { UpdateFormDto } from "./dto/update-form.dto";

@Injectable()
export class FormsService {
  constructor(
    private prisma: PrismaService,
    private participantService: ParticipantsService,
  ) {}

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

    if (
      createFormDto.openCondition === OpenCondition.ON_DATE &&
      createFormDto.closeDate == null
    ) {
      throw new BadRequestException(
        "Close date must be provided when open condition is ON_DATE",
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

    if (
      updateFormDto.openCondition === OpenCondition.ON_DATE &&
      updateFormDto.closeDate == null
    ) {
      throw new BadRequestException(
        "Close date must be provided when open condition is ON_DATE",
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

  async isOpen(formUuid: string, eventUuid: string) {
    const form = await this.findOne(formUuid, eventUuid);
    switch (form.openCondition) {
      case OpenCondition.MANUAL: {
        return form.isOpen;
      }
      case OpenCondition.ON_DATE: {
        const now = new Date();
        if (form.closeDate == null) {
          throw new InternalServerErrorException(
            "Form with ON_DATE open condition must have a close date",
          );
        }
        return (
          (form.openDate == null ? true : form.openDate <= now) &&
          form.closeDate >= now
        );
      }
    }
  }

  async formSubmit(
    eventUuid: string,
    formUuid: string,
    submissionData: FormSubmitionDto,
    fileNames: string[],
  ) {
    return await this.prisma.$transaction(async (prisma) => {
      const event = await prisma.event.findUnique({
        where: { uuid: eventUuid },
        include: { participants: true },
      });
      if (event == null) {
        throw new NotFoundException(`Event with id: ${eventUuid} not found`);
      }
      const form = await prisma.form.findUnique({
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
      const isFormOpen = await this.isOpen(formUuid, eventUuid);
      if (!isFormOpen) {
        throw new BadRequestException(`Form with id: ${formUuid} is closed`);
      }

      if (
        event.registerFormUuid === formUuid &&
        submissionData.email === undefined
      ) {
        throw new BadRequestException(
          `Email is required for the registration form`,
        );
      } else if (
        event.registerFormUuid !== formUuid &&
        submissionData.participantId === undefined
      ) {
        throw new BadRequestException(
          `Participant UUID is required for non-registration forms`,
        );
      }

      const normalizedAttributes: Record<string, string | null | undefined> =
        submissionData.attributes
          .flat()
          .reduce<
            Record<string, string | null | undefined>
          >((accumulator, attribute: ParticipantAttributeDto) => {
            accumulator[attribute.attributeUuid] = attribute.value;
            return accumulator;
          }, {});

      //File handling
      for (const attribute in normalizedAttributes) {
        const foundAttribute = form.formDefinitions.find(
          (formDefinition) => formDefinition.attributeUuid === attribute,
        );
        if (foundAttribute == null) {
          throw new BadRequestException(
            `Attribute with id: ${attribute} is not part of the form`,
          );
        }
        const attributeValue = normalizedAttributes[attribute];
        if (
          foundAttribute.attribute?.type === AttributeType.file &&
          isString(attributeValue)
        ) {
          const fileName = fileNames.find((f) =>
            f.endsWith(`#####${attributeValue}`),
          );
          if (fileName !== undefined) {
            fileNames.splice(fileNames.indexOf(fileName), 1);
            normalizedAttributes[attribute] =
              `./uploads/forms/${eventUuid}/${formUuid}/#####${fileName}`;
          }
        }
      }

      const requiredAttributes = form.formDefinitions
        .filter(
          (formDefinition) =>
            formDefinition.isRequired && formDefinition.attribute !== null,
        )
        .map((formDefinition) => formDefinition.attribute) as Attribute[];

      for (const attribute of requiredAttributes) {
        if (
          normalizedAttributes[attribute.uuid] === undefined ||
          normalizedAttributes[attribute.uuid] === null
        ) {
          throw new BadRequestException(
            `Missing required attribute with id: ${attribute.uuid}`,
          );
        }
      }

      if (
        event.registerFormUuid !== formUuid &&
        submissionData.participantId !== undefined
      ) {
        const participantDtoAttributes: ParticipantUpdateDto = {
          email: submissionData.email,
          participantAttributes: Object.entries(normalizedAttributes).map(
            ([attributeUuid, value]) =>
              ({
                attributeUuid,
                value,
              }) as ParticipantAttributeDto,
          ),
        };

        return await this.participantService.update(
          eventUuid,
          submissionData.participantId,
          participantDtoAttributes,
        );
      } else if (
        event.registerFormUuid === formUuid &&
        submissionData.email !== undefined
      ) {
        if (
          event.participantsLimit !== null &&
          event.participantsLimit <= event.participants.length
        ) {
          throw new BadRequestException(
            `Event with id: ${eventUuid} has reached the participants limit`,
          );
        }
        return await this.participantService.register(
          eventUuid,
          submissionData.email,
          Object.entries(normalizedAttributes).map(
            ([attributeUuid, value]) => ({
              attributeUuid,
              value,
            }),
          ),
        );
      }

      //ToDO poprawic
      return null;
    });
  }
}
