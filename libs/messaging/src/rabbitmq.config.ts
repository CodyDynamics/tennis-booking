import { Transport } from "@nestjs/microservices";

export const getRabbitMQConfig = (queue: string) => ({
  transport: Transport.RMQ,
  options: {
    urls: [process.env.RABBITMQ_URL || "amqp://localhost:5672"],
    queue,
    queueOptions: {
      durable: true,
    },
  },
});
