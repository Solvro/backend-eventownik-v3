import { EmailContentParserService } from "./email-content-parser.service";
import { EmailDeliveryService } from "./email-delivery.service";
import { EmailTemplatesService } from "./email-templates.service";
import { EmailsConsumer } from "./emails.consumer";
import { EmailsModule } from "./emails.module";
import { EmailsListeners } from "./emails.listeners";

describe("EmailsModule wiring", () => {
  // EmailsListeners' @OnEvent handlers are only ever discovered by
  // EventEmitter2 if the class is registered as a provider here - it was
  // previously defined but left out of `providers`, so every trigger-based
  // email (registration, deletion, form-filled, attribute-changed) silently
  // never fired. This guards against that regressing.
  it("registers every provider that must be instantiated for the module to work", () => {
    const providers = Reflect.getMetadata(
      "providers",
      EmailsModule,
    ) as unknown[];

    expect(providers).toEqual(
      expect.arrayContaining([
        EmailTemplatesService,
        EmailContentParserService,
        EmailDeliveryService,
        EmailsConsumer,
        EmailsListeners,
      ]),
    );
  });
});
