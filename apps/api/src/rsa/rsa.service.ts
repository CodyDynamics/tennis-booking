import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class RsaService implements OnModuleInit {
  private readonly logger = new Logger(RsaService.name);
  private publicKey: string;
  private privateKey: string;
  private readonly keysDir = path.join(
    process.cwd(),
    "apps",
    "api",
    "keys",
  );

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.ensureKeysExist();
    this.loadKeys();
  }

  private async ensureKeysExist() {
    const publicKeyPath =
      this.configService.get<string>("rsa.publicKeyPath") ||
      path.join(this.keysDir, "public.pem");
    const privateKeyPath =
      this.configService.get<string>("rsa.privateKeyPath") ||
      path.join(this.keysDir, "private.pem");

    // Create keys directory if it doesn't exist
    if (!fs.existsSync(this.keysDir)) {
      fs.mkdirSync(this.keysDir, { recursive: true });
    }

    // Generate keys if they don't exist
    if (!fs.existsSync(publicKeyPath) || !fs.existsSync(privateKeyPath)) {
      this.logger.log("Generating new RSA key pair...");
      const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: "spki",
          format: "pem",
        },
        privateKeyEncoding: {
          type: "pkcs8",
          format: "pem",
        },
      });

      fs.writeFileSync(publicKeyPath, publicKey);
      fs.writeFileSync(privateKeyPath, privateKey);
      this.logger.log("RSA key pair generated successfully");
    }
  }

  private loadKeys() {
    const publicKeyPath =
      this.configService.get<string>("rsa.publicKeyPath") ||
      path.join(this.keysDir, "public.pem");
    const privateKeyPath =
      this.configService.get<string>("rsa.privateKeyPath") ||
      path.join(this.keysDir, "private.pem");

    try {
      this.publicKey = fs.readFileSync(publicKeyPath, "utf8");
      this.privateKey = fs.readFileSync(privateKeyPath, "utf8");
      this.logger.log("RSA keys loaded successfully");
    } catch (error) {
      this.logger.error("Failed to load RSA keys", error);
      throw error;
    }
  }

  /**
   * Encrypt data using public key
   */
  encrypt(data: string): string {
    try {
      const buffer = Buffer.from(data, "utf8");
      const encrypted = crypto.publicEncrypt(
        {
          key: this.publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256",
        },
        buffer,
      );
      return encrypted.toString("base64");
    } catch (error) {
      this.logger.error("Encryption failed", error);
      throw new Error("Failed to encrypt data");
    }
  }

  /**
   * Decrypt data using private key
   */
  decrypt(encryptedData: string): string {
    try {
      const buffer = Buffer.from(encryptedData, "base64");
      const decrypted = crypto.privateDecrypt(
        {
          key: this.privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256",
        },
        buffer,
      );
      return decrypted.toString("utf8");
    } catch (error) {
      this.logger.error("Decryption failed", error);
      throw new Error("Failed to decrypt data");
    }
  }

  /**
   * Get public key (for sharing with clients)
   */
  getPublicKey(): string {
    return this.publicKey;
  }

  /**
   * Sign data using private key
   */
  sign(data: string): string {
    try {
      const sign = crypto.createSign("SHA256");
      sign.update(data);
      sign.end();
      return sign.sign(this.privateKey, "base64");
    } catch (error) {
      this.logger.error("Signing failed", error);
      throw new Error("Failed to sign data");
    }
  }

  /**
   * Verify signature using public key
   */
  verify(data: string, signature: string): boolean {
    try {
      const verify = crypto.createVerify("SHA256");
      verify.update(data);
      verify.end();
      return verify.verify(this.publicKey, signature, "base64");
    } catch (error) {
      this.logger.error("Verification failed", error);
      return false;
    }
  }
}
