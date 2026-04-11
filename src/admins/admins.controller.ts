import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { AuthUser } from "src/auth/jwt.strategy";

import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { AdminsService } from "./admins.service";
import { CreateAdminDto } from "./dto/create-admin.dto";
import { ListAdminDto } from "./dto/list-admin.dto";
import { UpdateAdminDto } from "./dto/update-admin.dto";
import { Admin } from "./entities/admin.entity";
import { checkAdminType } from "./utils/check-admin-type";

@UseGuards(JwtAuthGuard)
@ApiTags("Admins")
@Controller("admins")
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Post()
  @ApiOperation({ summary: "Create a new admin" })
  @ApiResponse({
    status: 201,
    description: "The admin has been successfully created.",
  })
  @ApiResponse({ status: 403, description: "Invalid account type." })
  async create(
    @Body() createAdminDto: CreateAdminDto,
    @Request() request: { user: AuthUser },
  ) {
    if (!checkAdminType(request.user)) {
      throw new ForbiddenException("Invalid account type");
    }
    return await this.adminsService.create(createAdminDto);
  }

  @Get()
  @ApiOperation({ summary: "Get list of all admins" })
  @ApiResponse({ status: 200, description: "List of admins." })
  @ApiResponse({ status: 403, description: "Invalid account type." })
  async findAll(
    @Request() request: { user: AuthUser },
    @Query() dto: ListAdminDto,
  ) {
    if (!checkAdminType(request.user)) {
      throw new ForbiddenException("Invalid account type");
    }
    return await this.adminsService.findAll(dto);
  }

  @Get(":adminId")
  @ApiOperation({ summary: "Get a admin by id" })
  @ApiResponse({ status: 200, description: "The admin." })
  @ApiResponse({ status: 404, description: "Admin not found." })
  @ApiResponse({ status: 403, description: "Invalid account type." })
  async findOne(
    @Param("adminId", ParseUUIDPipe) adminId: string,
    @Request() request: { user: AuthUser },
  ): Promise<Admin> {
    if (!checkAdminType(request.user)) {
      throw new ForbiddenException("Invalid account type");
    }
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
    if (!checkAdminType(request.user)) {
      throw new ForbiddenException("Invalid account type");
    }
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
    if (!checkAdminType(request.user)) {
      throw new ForbiddenException("Invalid account type");
    }
    return await this.adminsService.remove(adminId);
  }
}
