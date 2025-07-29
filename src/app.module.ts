import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PointModule } from "./point/point.module";

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRootAsync({
      imports: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>("MONGOOSE_URI"),
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useCreateIndex: true,
        useFindAndModify: false,
      }),
      inject: [ConfigService],
    }),
    PointModule,
  ],
})
export class AppModule {}
