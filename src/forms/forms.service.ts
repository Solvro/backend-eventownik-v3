import { isString } from "class-validator";
import { BlocksService } from "src/blocks/blocks.service";
import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { parseSortInput } from "src/common/utils/prisma.utility";
import {
  Attribute,
  AttributeType,
  OpenCondition,
  Prisma,
} from "src/generated/prisma/client";
import { ParticipantAttributeDto } from "src/participants/dto/participant-create.dto";
import { ParticipantUpdateDto } from "src/participants/dto/participant-update.dto";
import { ParticipantsService } from "src/participants/participants.service";

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  NotImplementedException,
} from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { CreateFormDto } from "./dto/create-form.dto";
import { FormListingDto } from "./dto/form-listing.dto";
import { FormSubmitionDto } from "./dto/form-submition.dto";
import { UpdateFormDto } from "./dto/update-form.dto";

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(
    private prisma: PrismaService,
    private participantService: ParticipantsService,
    private blocksService: BlocksService,
  ) {}

  private getConfigObject(config: Prisma.JsonValue | null) {
    if (config == null || typeof config !== "object" || Array.isArray(config)) {
      return null;
    }

    return config as Record<string, unknown>;
  }

  private getStringArray(config: Record<string, unknown> | null, key: string) {
    if (config == null) {
      return [] as string[];
    }

    const values = config[key];
    if (!Array.isArray(values)) {
      return [] as string[];
    }

    return values.filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    );
  }

  private getPositiveIntegerValue(
    config: Record<string, unknown> | null,
    key: string,
    fallback?: number,
  ) {
    if (config == null) {
      return fallback;
    }

    const value = config[key];
    if (value === undefined) {
      return fallback;
    }

    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
      this.logger.warn(
        `Attribute config field ${key} is invalid, using fallback value ${fallback ?? "undefined"}.`,
      );
      return fallback;
    }

    return value;
  }

  private normalizeSelectValue(attribute: Attribute, value: unknown) {
    const config = this.getConfigObject(attribute.config);
    const options = this.getStringArray(config, "options");

    if (options.length === 0) {
      if (!this.isMissingAttributeValue(value)) {
        this.logger.warn(
          `Attribute ${attribute.uuid} has no valid select options; using empty value.`,
        );
      }
      return Prisma.JsonNull;
    }

    if (this.isMissingAttributeValue(value)) {
      return Prisma.JsonNull;
    }

    if (!isString(value) || !options.includes(value)) {
      this.logger.warn(
        `Attribute ${attribute.uuid} received an invalid select value; defaulting to the first configured option.`,
      );
      return options[0] ?? Prisma.JsonNull;
    }

    return value;
  }

  private normalizeMultiSelectValue(attribute: Attribute, value: unknown) {
    const config = this.getConfigObject(attribute.config);
    const options = this.getStringArray(config, "options");
    const maxSelections = this.getPositiveIntegerValue(config, "maxSelections");

    if (options.length === 0) {
      if (!this.isMissingAttributeValue(value)) {
        this.logger.warn(
          `Attribute ${attribute.uuid} has no valid multiSelect options; using empty selection.`,
        );
      }
      return [] as string[];
    }

    if (this.isMissingAttributeValue(value)) {
      return [] as string[];
    }

    const rawValues = Array.isArray(value)
      ? value
      : isString(value)
        ? value.split(";")
        : null;

    if (rawValues == null) {
      this.logger.warn(
        `Attribute ${attribute.uuid} received an invalid multiSelect value; using empty selection.`,
      );
      return [] as string[];
    }

    const normalizedValues = rawValues
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .filter((item) => options.includes(item));

    if (normalizedValues.length === 0) {
      this.logger.warn(
        `Attribute ${attribute.uuid} received no valid multiSelect values; using empty selection.`,
      );
      return [] as string[];
    }

    if (
      maxSelections !== undefined &&
      normalizedValues.length > maxSelections
    ) {
      this.logger.warn(
        `Attribute ${attribute.uuid} exceeded maxSelections; trimming the selection to ${maxSelections}.`,
      );
      return normalizedValues.slice(0, maxSelections);
    }

    return normalizedValues;
  }

  private normalizeBlockValue(attribute: Attribute, value: unknown) {
    const config = this.getConfigObject(attribute.config);
    const maxSelections =
      this.getPositiveIntegerValue(config, "maxSelections", 1) ?? 1;

    if (this.isMissingAttributeValue(value)) {
      return Prisma.JsonNull;
    }

    const rawValues = Array.isArray(value)
      ? value
      : isString(value)
        ? value.split(";")
        : null;

    if (rawValues == null) {
      this.logger.warn(
        `Attribute ${attribute.uuid} received an invalid block value; using empty selection.`,
      );
      return Prisma.JsonNull;
    }

    const normalizedValues = rawValues
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (
      normalizedValues.some(
        (item) =>
          !item.match(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          ),
      )
    ) {
      this.logger.warn(
        `Attribute ${attribute.uuid} received invalid block UUIDs; using empty selection.`,
      );
      return Prisma.JsonNull;
    }

    if (normalizedValues.length === 0) {
      return Prisma.JsonNull;
    }

    if (normalizedValues.length > maxSelections) {
      this.logger.warn(
        `Attribute ${attribute.uuid} exceeded maxSelections; trimming the selection to ${maxSelections}.`,
      );
      return normalizedValues.slice(0, maxSelections);
    }

    return normalizedValues;
  }

  private normalizeOtherValue(attribute: Attribute, value: unknown) {
    if (this.isMissingAttributeValue(value)) {
      return Prisma.JsonNull;
    }

    switch (attribute.type) {
      case AttributeType.number: {
        if (typeof value === "number") {
          return value;
        }

        const parsedValue = isString(value) ? Number(value) : Number.NaN;
        if (Number.isNaN(parsedValue)) {
          this.logger.warn(
            `Attribute ${attribute.uuid} received an invalid number; defaulting to 0.`,
          );
          return 0;
        }

        return parsedValue;
      }
      case AttributeType.checkbox: {
        if (typeof value === "boolean") {
          return value;
        }

        if (typeof value === "number") {
          if (value === 1) {
            return true;
          }
          if (value === 0) {
            return false;
          }
        }

        if (isString(value)) {
          const normalizedValue = value.toLowerCase();
          if (["true", "1", "on"].includes(normalizedValue)) {
            return true;
          }
          if (["false", "0", "off"].includes(normalizedValue)) {
            return false;
          }
        }

        this.logger.warn(
          `Attribute ${attribute.uuid} received an invalid checkbox value; defaulting to false.`,
        );
        return false;
      }
      case AttributeType.date:
      case AttributeType.datetime: {
        const normalizedValue =
          value instanceof Date
            ? value.toISOString()
            : isString(value)
              ? value
              : null;

        if (
          normalizedValue == null ||
          Number.isNaN(Date.parse(normalizedValue))
        ) {
          this.logger.warn(
            `Attribute ${attribute.uuid} received an invalid date value; using empty value.`,
          );
          return Prisma.JsonNull;
        }

        return normalizedValue;
      }
      case AttributeType.file: {
        if (isString(value)) {
          return value;
        }

        this.logger.warn(
          `Attribute ${attribute.uuid} received an invalid file value; using empty value.`,
        );
        return Prisma.JsonNull;
      }
      default: {
        if (isString(value)) {
          return value;
        }

        this.logger.warn(
          `Attribute ${attribute.uuid} received an invalid text value; using empty value.`,
        );
        return Prisma.JsonNull;
      }
    }
  }

  private normalizeSubmissionAttributeValue(
    attribute: Attribute,
    value: unknown,
  ) {
    if (attribute.type === AttributeType.select) {
      return this.normalizeSelectValue(attribute, value);
    }

    if (attribute.type === AttributeType.multiSelect) {
      return this.normalizeMultiSelectValue(attribute, value);
    }

    if (attribute.type === AttributeType.block) {
      return this.normalizeBlockValue(attribute, value);
    }

    return this.normalizeOtherValue(attribute, value);
  }

  private isMissingAttributeValue(value: unknown) {
    return (
      value === undefined ||
      value === null ||
      value === Prisma.JsonNull ||
      value === Prisma.DbNull ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    );
  }

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
          openCondition: createFormDto.openCondition,
          isOpen: createFormDto.isOpen,
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
          openCondition: updateFormDto.openCondition,
          isOpen: updateFormDto.isOpen,
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

      const normalizedAttributes: Record<string, unknown> =
        submissionData.attributes
          .flat()
          .reduce<
            Record<string, unknown>
          >((accumulator, attribute: ParticipantAttributeDto) => {
            accumulator[attribute.attributeUuid] = attribute.value;
            return accumulator;
          }, {});

      for (const [attributeUuid, attributeValue] of Object.entries(
        normalizedAttributes,
      )) {
        const foundAttribute = form.formDefinitions.find(
          (formDefinition) => formDefinition.attributeUuid === attributeUuid,
        );
        if (foundAttribute == null || foundAttribute.attribute == null) {
          throw new BadRequestException(
            `Attribute with id: ${attributeUuid} is not part of the form`,
          );
        }
        const normalizedValue = this.normalizeSubmissionAttributeValue(
          foundAttribute.attribute,
          attributeValue,
        );

        if (
          foundAttribute.attribute.type === AttributeType.file &&
          isString(normalizedValue)
        ) {
          const fileName = fileNames.find((f) =>
            f.endsWith(`#####${normalizedValue}`),
          );
          if (fileName !== undefined) {
            fileNames.splice(fileNames.indexOf(fileName), 1);
            normalizedAttributes[attributeUuid] =
              `./uploads/forms/${eventUuid}/${formUuid}/#####${fileName}`;
          }
        } else {
          normalizedAttributes[attributeUuid] = normalizedValue;
        }

        if (
          foundAttribute.attribute.type === AttributeType.block &&
          normalizedValue !== Prisma.JsonNull
        ) {
          throw new NotImplementedException(
            "Block registration is not implemented yet.",
          );
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
          this.isMissingAttributeValue(normalizedAttributes[attribute.uuid])
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

      throw new InternalServerErrorException(
        `Unexpected error in form submission.`,
      );
    });
  }
}
