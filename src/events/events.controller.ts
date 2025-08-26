import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

@Controller("events")
@ApiTags("Events")
export class EventsController {
  @Get()
  @ApiResponse({ status: 200, description: "Hello World!" })
  @ApiOperation({ summary: "Hello World Endpoint" })
  index(): string {
    return "OK";
  }
}
