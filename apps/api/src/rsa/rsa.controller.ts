import { Controller, Get } from "@nestjs/common";
import { Public } from "@app/common";
import { RsaService } from "./rsa.service";

@Controller("rsa")
export class RsaController {
  constructor(private readonly rsaService: RsaService) {}

  @Get("public-key")
  @Public()
  getPublicKey() {
    return {
      publicKey: this.rsaService.getPublicKey(),
    };
  }
}
