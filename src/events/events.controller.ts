import { diskStorage } from "multer";
import { existsSync, mkdirSync } from "node:fs";
import { extname } from "node:path/win32";
import { PageDto } from "src/common/dto/page.dto";

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { EventCreateDto } from "./dto/event-create.dto";
import { EventListingDto } from "./dto/event-listing.dto";
import { EventUpdateDto } from "./dto/event-update.dto";
import { Event } from "./entities/event.entity";
import { EventsService } from "./events.service";

@ApiTags("Events")
@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({ summary: "Get list of events with pagination and filtering" })
  @ApiOkResponse({ description: "List of events", type: PageDto<Event> })
  async findAll(@Query() dto: EventListingDto): Promise<PageDto<Event>> {
    // z auth'em, zwracać swoje eventy / wszystkie dla superadmina
    return this.eventsService.findAll(dto);
  }

  @Get("public")
  @ApiOperation({
    summary: "Get list of public events with pagination and filtering",
  })
  @ApiOkResponse({ description: "List of public events", type: PageDto<Event> })
  async findAllPublic(@Query() dto: EventListingDto): Promise<PageDto<Event>> {
    return this.eventsService.findAllPublic(dto);
  }

  // TODO: usuwanie zdjęcia z serwera przy aktualizacji, usuwaniu eventu i gdy nie przejdzie walidacji, to samo dla PUT
  @Post()
  @UseInterceptors(
    FileInterceptor("photo", {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const uploadPath = "./uploads/events";
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          callback(null, uploadPath);
        },
        filename: (_request, file, callback) => {
          const now = Date.now().toString();
          const random = Math.round(Math.random() * 1e9).toString();
          const uniqueSuffix = `${now}-${random}`;
          const extension = extname(file.originalname);
          callback(null, `${uniqueSuffix}${extension}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
        if (allowedTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              "Invalid file type. Only PNG and JPEG are allowed.",
            ),
            false,
          );
        }
      },
    }),
  )
  @ApiOperation({ summary: "Create a new event" })
  @ApiOkResponse({ description: "The created event", type: Event })
  async create(
    @UploadedFile()
    photo: Express.Multer.File | undefined,
    @Body() eventDto: EventCreateDto,
  ): Promise<Event> {
    let photoUrl: string | null = null;
    if (photo !== undefined) {
      photoUrl = `/uploads/events/${photo.filename}`;
    }
    eventDto.photoUrl = photoUrl;
    return this.eventsService.create(eventDto);
  }

  @Get(":eventUUID")
  @ApiOperation({ summary: "Get event by UUID" })
  @ApiOkResponse({ description: "The event", type: Event })
  async findOne(
    @Param("eventUUID", ParseUUIDPipe) eventUUID: string,
  ): Promise<Event> {
    return this.eventsService.findOne(eventUUID);
  }

  @Get("public/:eventUUID")
  @ApiOperation({ summary: "Get public event by UUID" })
  @ApiOkResponse({ description: "The public event", type: Event })
  async findOnePublic(
    @Param("eventUUID", ParseUUIDPipe) eventUUID: string,
  ): Promise<Event> {
    return this.eventsService.findOnePublic(eventUUID);
  }

  @Put(":eventUUID")
  @UseInterceptors(
    FileInterceptor("photo", {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const uploadPath = "./uploads/events";
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          callback(null, uploadPath);
        },
        filename: (_request, file, callback) => {
          const now = Date.now().toString();
          const random = Math.round(Math.random() * 1e9).toString();
          const uniqueSuffix = `${now}-${random}`;
          const extension = extname(file.originalname);
          callback(null, `${uniqueSuffix}${extension}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
        if (allowedTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              "Invalid file type. Only PNG and JPEG are allowed.",
            ),
            false,
          );
        }
      },
    }),
  )
  @ApiOperation({ summary: "Update event by UUID" })
  @ApiOkResponse({ description: "The updated event", type: Event })
  async update(
    @Param("eventUUID", ParseUUIDPipe) eventUUID: string,
    @UploadedFile()
    photo: Express.Multer.File | undefined,
    @Body() eventDto: EventUpdateDto,
  ): Promise<Event> {
    let photoUrl: string | null = null;
    if (photo !== undefined) {
      photoUrl = `/uploads/events/${photo.filename}`;
    }
    eventDto.photoUrl = photoUrl;
    return this.eventsService.update(eventUUID, eventDto);
  }

  @Delete(":eventUUID")
  @ApiOperation({ summary: "Delete event by UUID" })
  @ApiOkResponse({ description: "No content" })
  @HttpCode(204)
  async remove(
    @Param("eventUUID", ParseUUIDPipe) eventUUID: string,
  ): Promise<Event> {
    return this.eventsService.remove(eventUUID);
  }
}
