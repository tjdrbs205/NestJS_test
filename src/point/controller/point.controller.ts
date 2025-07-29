import { Body, Controller, Post } from "@nestjs/common";
import { PointsService } from "../service/point.service";
import { CreatePointsDto } from "../dto/create.point.dto";
import { PointBalance } from "../schema/pointBalance.schema";

@Controller("points")
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Post("create")
  async createPoints(
    @Body() createPointsDto: CreatePointsDto,
  ): Promise<PointBalance | null> {
    const { userId, amount = 1000 } = createPointsDto;
    return this.pointsService.createPointBalance(userId, amount);
  }
}
