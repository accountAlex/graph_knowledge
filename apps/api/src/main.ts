import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { Server as HttpServer } from "node:http";
import { AppModule } from "./app.module";
import { WhiteboardSyncService } from "./whiteboard/whiteboard-sync.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("MathGraph API")
    .setDescription("Knowledge graph formalization API")
    .setVersion("0.1.0")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);

  // Attach the collaborative-whiteboard sync server (Hocuspocus) to the same
  // HTTP server / port on the `/collab` upgrade path.
  app.get(WhiteboardSyncService).bindTo(app.getHttpServer() as HttpServer);
}
bootstrap();
