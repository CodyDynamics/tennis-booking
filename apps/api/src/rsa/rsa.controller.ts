import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Public } from "@app/common";
import { RsaService } from "./rsa.service";

@ApiTags("RSA")
@Controller("rsa")
export class RsaController {
  constructor(private readonly rsaService: RsaService) {}

  @Get("public-key")
  @Public()
  @ApiOperation({ summary: "Get RSA public key (for client encryption)" })
  @ApiResponse({
    status: 200,
    description: "Public key PEM",
    schema: {
      type: "object",
      properties: { publicKey: { type: "string", description: "PEM format" } },
    },
  })
  getPublicKey() {
    return {
      publicKey: this.rsaService.getPublicKey(),
    };
  }
}
