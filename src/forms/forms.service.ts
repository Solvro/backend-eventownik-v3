import { isString, isUUID } from "class-validator";
import { BlocksService } from "src/blocks/blocks.service";
import { PageMetaDto } from "src/common/dto/page-meta.dto";
import { PageDto } from "src/common/dto/page.dto";
import { FORM_FILLED_EVENT } from "src/common/events/event-names.constants";
import { FormFilledEvent } from "src/common/events/form-filled.event";
import { parseSortInput } from "src/common/utils/prisma.utility";
import {
  Attribute,
  AttributeType,
  OpenCondition,
  Prisma,
} from "src/generated/prisma/client";
import { ParticipantUpdateDto } from "src/participants/dto/participant-update.dto";
import { ParticipantsService } from "src/participants/participants.service";
import { StorageService } from "src/storage/storage.service";

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { PrismaService } from "../prisma/prisma.service";
import { CreateFormDto } from "./dto/create-form.dto";
import { FormListingDto } from "./dto/form-listing.dto";
import { FormSubmitionDto } from "./dto/form-submition.dto";
import { UpdateFormDto } from "./dto/update-form.dto";

const IMAGE_MIME_PREFIX = "image/";

@Injectable()
export class FormsService {
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly participantService: ParticipantsService,
    private readonly blocksService: BlocksService,
    private readonly storageService: StorageService,
    private readonly eventEmitter: EventEmitter2,
    configService: ConfigService,
  ) {
    this.bucket = configService.getOrThrow<string>("S3_BUCKET_FORMS");
  }

  private async uploadFiles(
    files: Express.Multer.File[],
    fileAttributeMap: Record<string, number> = {},
  ): Promise<Record<string, string>> {
    const fileKeyMap: Record<string, string> = {};
    try {
      const entriesToUpload = Object.entries(fileAttributeMap).map(
        ([attributeUuid, fileIndex]: [string, number]) => {
          if (fileIndex < 0 || fileIndex >= files.length) {
            throw new Error(
              `File index ${String(fileIndex)} for attribute ${attributeUuid} is out of bounds`,
            );
          }
          const file = files[fileIndex];
          return { attributeUuid, file };
        },
      );

      await Promise.all(
        entriesToUpload.map(async ({ attributeUuid, file }) => {
          fileKeyMap[attributeUuid] = await this.storageService.upload(
            this.bucket,
            file,
          );
        }),
      );
      return fileKeyMap;
    } catch (error) {
      await Promise.all(
        Object.values(fileKeyMap).map(async (key) =>
          this.storageService.delete(this.bucket, key),
        ),
      );
      throw error;
    }
  }

  async cleanupUploadedFiles(
    fileKeyMapByAttributeUuid: Record<string, string>,
  ): Promise<void> {
    await Promise.all(
      Object.values(fileKeyMapByAttributeUuid).map(async (fileKey) =>
        this.storageService.delete(this.bucket, fileKey),
      ),
    );
  }

  async handleFileUploads(
    files: Express.Multer.File[] | null,
    fileAttributeMap: Record<string, number> = {},
  ): Promise<Record<string, string>> {
    if (files == null || files.length === 0) {
      return {};
    }
    return this.uploadFiles(files, fileAttributeMap);
  }

  async uploadSingleFile(
    file: Express.Multer.File,
    formUuid: string,
    sourceIp: string,
    configService: ConfigService,
  ): Promise<{ fileToken: string; expiresAt: number }> {
    const maxSize = configService.getOrThrow<number>("UPLOAD_MAX_FILE_SIZE");
    const allowedMimes = configService
      .getOrThrow<string>("UPLOAD_ALLOWED_MIME")
      .split(",")
      .map((m) => m.trim());
    const ttlHours = configService.getOrThrow<number>("UPLOAD_TTL_HOURS");

    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size exceeds maximum of ${String(maxSize)} bytes`,
      );
    }

    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Allowed types: ${allowedMimes.join(", ")}`,
      );
    }

    const fileKey = await this.storageService.upload(this.bucket, file);

    const uploadedFile = await this.prisma.uploadedFile.create({
      data: {
        fileKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        formUuid,
        sourceIp,
      },
    });

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    return {
      fileToken: uploadedFile.uuid,
      expiresAt: expiresAt.getTime(),
    };
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

  async findOneBySlug(formUuid: string, eventSlug: string) {
    const form = await this.prisma.form.findUnique({
      where: { uuid: formUuid, event: { slug: eventSlug } },
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

      const existingForm = await prisma.form.findFirst({
        where: { uuid: formUuid, eventUuid: event.uuid },
      });
      if (existingForm == null) {
        throw new NotFoundException(
          `Form with id: ${formUuid} not found in this event`,
        );
      }

      if (
        updateFormDto.isFirstForm !== undefined &&
        updateFormDto.isFirstForm
      ) {
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
      } else if (
        updateFormDto.isFirstForm === false &&
        event.registerFormUuid === formUuid
      ) {
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

  async isOpen(formUuid: string, eventSlug: string) {
    const form = await this.findOneBySlug(formUuid, eventSlug);
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
    eventSlug: string,
    formUuid: string,
    submissionData: FormSubmitionDto,
  ) {
    let eventUuid = "";
    const fileKeysToDelete: string[] = [];
    const participant = await this.prisma.$transaction(async (prisma) => {
      const event = await prisma.event.findUnique({
        where: { slug: eventSlug },
        include: { participants: true },
      });
      if (event == null) {
        throw new NotFoundException(`Event with slug: ${eventSlug} not found`);
      }
      eventUuid = event.uuid;
      const form = await prisma.form.findUnique({
        where: { uuid: formUuid, event: { slug: eventSlug } },
        include: {
          formDefinitions: {
            include: { attribute: true },
          },
        },
      });
      if (form == null) {
        throw new NotFoundException(`Form with id: ${formUuid} not found`);
      }
      const isFormOpen = await this.isOpen(formUuid, eventSlug);
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

      const submittedAttributes: Record<string, unknown> =
        submissionData.attributes
          .flat()
          .reduce<Record<string, unknown>>((accumulator, attribute) => {
            accumulator[attribute.attributeUuid] = attribute.value;
            return accumulator;
          }, {});

      for (const [attributeUuid, attributeValue] of Object.entries(
        submittedAttributes,
      )) {
        const foundAttribute = form.formDefinitions.find(
          (formDefinition) => formDefinition.attributeUuid === attributeUuid,
        );
        if (foundAttribute?.attribute == null) {
          throw new BadRequestException(
            `Attribute with id: ${attributeUuid} is not part of the form`,
          );
        }

        const isFileLikeAttribute =
          foundAttribute.attribute.type === AttributeType.file ||
          foundAttribute.attribute.type === AttributeType.drawing;

        if (
          isFileLikeAttribute &&
          isString(attributeValue) &&
          attributeValue.trim().length > 0
        ) {
          const fileToken = attributeValue.trim();
          const uploadedFile = isUUID(fileToken)
            ? await prisma.uploadedFile.findUnique({
                where: { uuid: fileToken },
              })
            : null;

          if (
            uploadedFile?.formUuid !== formUuid ||
            uploadedFile.claimedAt !== null
          ) {
            throw new BadRequestException(
              `File token ${fileToken} for attribute ${attributeUuid} is invalid or already claimed`,
            );
          }

          if (
            foundAttribute.attribute.type === AttributeType.drawing &&
            !uploadedFile.mimeType.startsWith(IMAGE_MIME_PREFIX)
          ) {
            throw new BadRequestException(
              `Attribute ${attributeUuid} is a drawing attribute and only accepts image uploads`,
            );
          }

          submittedAttributes[attributeUuid] = uploadedFile.fileKey;

          await prisma.uploadedFile.update({
            where: { uuid: fileToken },
            data: { claimedAt: new Date() },
          });

          if (submissionData.participantId !== undefined) {
            const existingAttribute =
              await prisma.participantAttribute.findUnique({
                where: {
                  participantUuid_attributeUuid: {
                    participantUuid: submissionData.participantId,
                    attributeUuid,
                  },
                },
              });
            if (
              existingAttribute?.value != null &&
              isString(existingAttribute.value) &&
              existingAttribute.value.length > 0
            ) {
              fileKeysToDelete.push(existingAttribute.value);
            }
          }
        }

        if (
          foundAttribute.attribute.type === AttributeType.block &&
          !this.isMissingAttributeValue(attributeValue)
        ) {
          const blockIds = Array.isArray(attributeValue)
            ? attributeValue
            : typeof attributeValue === "string"
              ? attributeValue.split(";")
              : [];

          let previousBlockIds: string[] = [];
          if (submissionData.participantId !== undefined) {
            const existingAttribute =
              await prisma.participantAttribute.findUnique({
                where: {
                  participantUuid_attributeUuid: {
                    participantUuid: submissionData.participantId,
                    attributeUuid,
                  },
                },
              });
            if (
              existingAttribute !== null &&
              Array.isArray(existingAttribute.value)
            ) {
              previousBlockIds = existingAttribute.value as string[];
            }
          }

          for (const blockId of blockIds) {
            if (typeof blockId !== "string") {
              continue;
            }
            const trimmedBlockId = blockId.trim();
            if (previousBlockIds.includes(trimmedBlockId)) {
              continue;
            }
            const canSignIn =
              isUUID(trimmedBlockId) &&
              (await this.blocksService.canSignInToBlock(
                event.uuid,
                attributeUuid,
                trimmedBlockId,
                prisma,
              ));
            if (!canSignIn) {
              throw new BadRequestException(
                `Cannot sign in to block ${trimmedBlockId} because it is at full capacity, is a root block, or does not belong to the correct event/attribute.`,
              );
            }
          }
        }
      }

      const requiredAttributes = form.formDefinitions
        .filter(
          (formDefinition) =>
            formDefinition.isRequired && formDefinition.attribute !== null,
        )
        .map((formDefinition) => formDefinition.attribute) as Attribute[];

      let existingAttributeValues: Map<string, Prisma.JsonValue> | null = null;
      if (
        submissionData.participantId !== undefined &&
        requiredAttributes.length > 0
      ) {
        const existingAttributeRows =
          await prisma.participantAttribute.findMany({
            where: { participantUuid: submissionData.participantId },
            select: { attributeUuid: true, value: true },
          });
        existingAttributeValues = new Map(
          existingAttributeRows.map((existing) => [
            existing.attributeUuid,
            existing.value,
          ]),
        );
      }

      for (const attribute of requiredAttributes) {
        const wasSubmitted = Object.hasOwn(submittedAttributes, attribute.uuid);
        const effectiveValue = wasSubmitted
          ? submittedAttributes[attribute.uuid]
          : existingAttributeValues?.get(attribute.uuid);

        if (this.isMissingAttributeValue(effectiveValue)) {
          if (attribute.type === AttributeType.block) {
            const selectableBlocksCount = await prisma.block.count({
              where: { attributeUuid: attribute.uuid, isRootBlock: false },
            });
            if (selectableBlocksCount > 0) {
              throw new BadRequestException(
                `Missing required attribute with id: ${attribute.uuid}`,
              );
            }
          } else {
            throw new BadRequestException(
              `Missing required attribute with id: ${attribute.uuid}`,
            );
          }
        }
      }

      if (
        event.registerFormUuid !== formUuid &&
        submissionData.participantId !== undefined
      ) {
        const participantDtoAttributes: ParticipantUpdateDto = {
          email: submissionData.email,
          participantAttributes: Object.entries(submittedAttributes).map(
            ([attributeUuid, value]) => ({
              attributeUuid,
              value,
            }),
          ),
        };

        return await this.participantService.update(
          event.uuid,
          submissionData.participantId,
          participantDtoAttributes,
          { trustedFileValues: true },
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
            `Event with a slug: ${eventSlug} has reached the participants limit`,
          );
        }
        return await this.participantService.register(
          event.uuid,
          submissionData.email,
          Object.entries(submittedAttributes).map(([attributeUuid, value]) => ({
            attributeUuid,
            value,
          })),
          { trustedFileValues: true },
        );
      }

      throw new InternalServerErrorException(
        `Unexpected error in form submission.`,
      );
    });

    for (const key of fileKeysToDelete) {
      await this.storageService.delete(this.bucket, key);
    }

    this.eventEmitter.emit(
      FORM_FILLED_EVENT,
      new FormFilledEvent(formUuid, participant.uuid, eventUuid),
    );

    return participant;
  }
}
