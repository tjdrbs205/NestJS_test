import { Module } from "@nestjs/common";
import { PointsController } from "./controller/point.controller";
import { MongooseModule } from "@nestjs/mongoose";
import { Point, PointSchema } from "./schema/point.schema";
import { PointRepository } from "./repository/point.repository";
import { PointsService } from "./service/point.service";

@Module({
  imports: [MongooseModule.forFeature([{ name: Point.name, schema: PointSchema }])],
  providers: [PointsService, PointRepository],
  controllers: [PointsController],
})
export class PointModule {}
