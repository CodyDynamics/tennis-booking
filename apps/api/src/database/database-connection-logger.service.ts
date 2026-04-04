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

    console.log("process.env.DB_HOST", process.env.DB_HOST);
    console.log("process.env.DB_USER", process.env.DB_USER);
    console.log("process.env.DB_PASS", process.env.DB_PASS);
    console.log("process.env.DB_NAME", process.env.DB_NAME);
    console.log("progress.env", JSON.stringify(process.env, null, 2));
    console.log(`Database connected (${opts.type}: ${db} @ ${host}:${port})`);
  }
}
