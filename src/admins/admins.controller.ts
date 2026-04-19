import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { AuthUser } from "src/auth/jwt.strategy";
import { SuperAdminGuard } from "src/common/decorators/superadmin.guard";

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
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { AdminsService } from "./admins.service";
import { CreateAdminDto } from "./dto/create-admin.dto";
import { ListAdminDto } from "./dto/list-admin.dto";
import { UpdateAdminDto } from "./dto/update-admin.dto";
import { Admin } from "./entities/admin.entity";

@ApiTags("Admins")
@Controller("admins")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Post()
  @ApiOperation({ summary: "Create a new admin" })
  @ApiResponse({
    status: 201,
    description: "The admin has been successfully created.",
  })
  @ApiResponse({ status: 403, description: "Invalid account type." })
  async create(@Body() createAdminDto: CreateAdminDto) {
    return await this.adminsService.create(createAdminDto);
  }

  @Get()
  @ApiOperation({ summary: "Get list of all admins" })
  @ApiResponse({ status: 200, description: "List of admins." })
  @ApiResponse({ status: 403, description: "Invalid account type." })
  async findAll(@Query() dto: ListAdminDto) {
    return await this.adminsService.findAll(dto);
  }

  @Get(":adminId")
  @ApiOperation({ summary: "Get a admin by id" })
  @ApiResponse({ status: 200, description: "The admin." })
  @ApiResponse({ status: 404, description: "Admin not found." })
  @ApiResponse({ status: 403, description: "Invalid account type." })
  async findOne(
    @Param("adminId", ParseUUIDPipe) adminId: string,
  ): Promise<Admin> {
    return await this.adminsService.findOne(adminId);
  }

  @Patch(":adminId")
  @ApiOperation({ summary: "Update a admin by id" })
  @ApiResponse({ status: 200, description: "The updated admin." })
  @ApiResponse({ status: 404, description: "Admin not found." })
  @ApiResponse({ status: 403, description: "Invalid account type." })
  async update(
    @Param("adminId", ParseUUIDPipe) adminId: string,
    @Body() updateAdminDto: UpdateAdminDto,
    @Request() request: { user: AuthUser },
  ): Promise<Admin> {
    updateAdminDto.preventSelfLockout(request.user, adminId);

    return await this.adminsService.update(adminId, updateAdminDto);
  }

  @Delete(":adminId")
  @ApiOperation({ summary: "Delete a admin by id" })
  @ApiResponse({
    status: 204,
    description: "No content",
  })
  @ApiResponse({ status: 404, description: "Admin not found." })
  @ApiResponse({ status: 403, description: "Invalid account type." })
  @HttpCode(204)
  async remove(
    @Param("adminId", ParseUUIDPipe) adminId: string,
    @Request() request: { user: AuthUser },
  ): Promise<Admin> {
    return await this.adminsService.remove(adminId, request.user);
  }
}
