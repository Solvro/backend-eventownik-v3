import { PrismaService } from "src/prisma/prisma.service";

import { BadRequestException, Injectable } from "@nestjs/common";

import { CreateEmailDto } from "./dto/create-email.dto";

@Injectable()
export class EmailsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(eventUuid: string, query: CreateEmailDto) {
    return await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { uuid: eventUuid },
      });
      if (event == null) {
        throw new BadRequestException(`Event with id: ${eventUuid} not found`);
      }

      if (query.formId !== undefined) {
        const form = await tx.form.findUnique({
          where: { uuid: query.formId },
        });
        if (form == null) {
          throw new BadRequestException(
            `Form with id: ${query.formId} not found`,
          );
        }
      }

      const emailTemplate = await tx.emailTemplate.create({
        data: {
          name: query.name,
          content: query.content,
          trigger: query.trigger,
          triggerValue: query.triggerValue,
          triggerValue2: query.triggerValue2,
          order: query.order,
          eventUuid,
          formUuid: query.formId,
        },
      });

      return {
        id: emailTemplate.uuid,
        name: emailTemplate.name,
        content: emailTemplate.content,
        trigger: emailTemplate.trigger,
      };
    });
  }
}
