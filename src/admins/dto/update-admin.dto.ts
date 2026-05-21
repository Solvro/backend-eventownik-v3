import type { AuthUser } from "src/auth/jwt.strategy";

import { PartialType } from "@nestjs/swagger";

import { CreateAdminDto } from "./create-admin.dto";

export class UpdateAdminDto extends PartialType(CreateAdminDto) {
  preventSelfLockout(user: AuthUser, requestedUserId: string) {
    if (user.uuid === requestedUserId) {
      this.active = true;
      this.type = "superadmin";
    }
    return this;
  }
}
