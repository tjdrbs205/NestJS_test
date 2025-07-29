import { ModuleRef, NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { setTransactionModuleRef } from "./common/decorator/transactional.decorator";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ["debug"] });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  setTransactionModuleRef(app.get(ModuleRef));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
