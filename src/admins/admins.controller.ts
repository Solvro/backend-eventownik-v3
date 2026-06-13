import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { AuthUser } from "src/auth/jwt.strategy";
import { SuperAdminGuard } from "src/common/decorators/superadmin.guard";
import { PageDto } from "src/common/dto/page.dto";

import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { AdminsService } from "./admins.service";
import { CreateAdminDto } from "./dto/create-admin.dto";
import { ListAdminDto } from "./dto/list-admin.dto";
import { UpdateAdminDto } from "./dto/update-admin.dto";
import { Admin } from "./entities/admin.entity";
import {
  adminConflictResponse,
  adminForbiddenResponse,
  adminNotFoundResponse,
  createAdminBadRequestResponse,
  listAdminResponse,
} from "./utils/swagger-response-examples";

@ApiTags("Admins")
@ApiBearerAuth()
@ApiForbiddenResponse(adminForbiddenResponse)
@Controller("admins")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Post()
  @ApiOperation({
    summary: "Create a new admin",
    description:
      "Retrives admin, only super admins can create new admins accounts.",
  })
  @ApiCreatedResponse({
    type: Admin,
    description: "Returns the created admin.",
  })
  @ApiBadRequestResponse(createAdminBadRequestResponse)
  @ApiConflictResponse(adminConflictResponse)
  async create(@Body() createAdminDto: CreateAdminDto) {
    return await this.adminsService.create(createAdminDto);
  }

  @Get()
  @ApiOperation({
    summary: "Get list of all admins",
    description:
      "Retrieves list of all admins, supports pagination, filtering and sorting.",
  })
  @ApiExtraModels(PageDto, Admin)
  @ApiOkResponse(listAdminResponse)
  async findAll(@Query() dto: ListAdminDto): Promise<PageDto<Admin>> {
    return await this.adminsService.findAll(dto);
  }

  @Get(":adminId")
  @ApiOperation({
    summary: "Get an Admin by id",
    description: "Retrieves an Admin by its id.",
  })
  @ApiOkResponse({ type: Admin, description: "Returns the admin." })
  @ApiNotFoundResponse(adminNotFoundResponse)
  async findOne(
    @Param("adminId", ParseUUIDPipe) adminId: string,
  ): Promise<Admin> {
    return await this.adminsService.findOne(adminId);
  }

  @Patch(":adminId")
  @ApiOperation({ summary: "Update an Admin by id" })
  @ApiOkResponse({ type: Admin, description: "Returns the updated admin." })
  @ApiBadRequestResponse(createAdminBadRequestResponse)
  @ApiConflictResponse(adminConflictResponse)
  @ApiNotFoundResponse(adminNotFoundResponse)
  async update(
    @Param("adminId", ParseUUIDPipe) adminId: string,
    @Body() updateAdminDto: UpdateAdminDto,
    @Request() request: { user: AuthUser },
  ): Promise<Admin> {
    updateAdminDto.preventSelfLockout(request.user, adminId);

    return await this.adminsService.update(adminId, updateAdminDto);
  }

  @Delete(":adminId")
  @ApiOperation({ summary: "Delete an Admin by id" })
  @ApiNoContentResponse({
    description: "Admin successfully deleted. *No content*",
  })
  @ApiNotFoundResponse(adminNotFoundResponse)
  @HttpCode(204)
  async remove(
    @Param("adminId", ParseUUIDPipe) adminId: string,
    @Request() request: { user: AuthUser },
  ): Promise<Admin> {
    return await this.adminsService.remove(adminId, request.user);
  }
}
