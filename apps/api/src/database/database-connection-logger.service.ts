import { Injectable, OnModuleInit } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class DatabaseConnectionLogger implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  onModuleInit() {
    const opts = this.dataSource.options as {
      type: string;
      host?: string;
      port?: number;
      database?: string;
    };
    const host = opts.host ?? "localhost";
    const port = opts.port ?? 5432;
    const db = opts.database ?? "(unknown)";
    console.log(`Database connected (${opts.type}: ${db} @ ${host}:${port})`);
  }
}
