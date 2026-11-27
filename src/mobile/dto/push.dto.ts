import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from "class-validator";

const ENDPOINT_URL_OPTIONS = {
  protocols: ["https"],
  require_protocol: true,
  require_tld: true,
};

export class MobilePushKeysDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  auth: string;
}

export class MobilePushSubscribeDto {
  /** Push service endpoint from `PushSubscription.endpoint` (https only) */
  @IsUrl(ENDPOINT_URL_OPTIONS)
  @MaxLength(2000)
  endpoint: string;

  @ValidateNested()
  @Type(() => MobilePushKeysDto)
  keys: MobilePushKeysDto;
}

export class MobilePushUnsubscribeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  endpoint: string;
}

export class MobilePushConfigDto {
  /** true when the server has VAPID keys configured */
  enabled: boolean;
  /** VAPID public key (base64url) for `pushManager.subscribe`, null when disabled */
  publicKey: string | null;
}
