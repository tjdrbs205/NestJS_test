import { Injectable } from "@nestjs/common";
import { PointBalanceRepository } from "../repository/pointBalance.repository";
import { PointBalance } from "../schema/pointBalance.schema";
import { Transactional } from "../../common/decorator/transactional.decorator";
import { PointRepository } from "../repository/point.repository";
import { Point, PointType } from "../schema/point.schema";

@Injectable()
export class PointsService {
  constructor(
    private readonly pointsBalanceRepository: PointBalanceRepository,
    private readonly pointRepository: PointRepository,
  ) {}

  //balance for a user
  @Transactional()
  async createPointBalance(
    userId: string,
    initPoint: number,
  ): Promise<PointBalance | null> {
    const existingPoints = await this.pointsBalanceRepository.exist(userId);
    if (existingPoints) {
      throw new Error("Points already exist for this user");
    }

    const balance = await this.pointsBalanceRepository.createUserBalance(
      userId,
      initPoint,
    );

    const pointData = Point.createInitialPoint(userId, initPoint);

    await this.pointRepository.create(pointData);
    return balance;
  }

  async getPointsByUserId(userId: string): Promise<PointBalance | null> {
    return await this.pointsBalanceRepository.findByUserId(userId);
  }

  @Transactional()
  async addPoints(userId: string, amount: number): Promise<PointBalance | null> {
    await this.existingPointsCheck(userId);
    return this.pointsBalanceRepository.earnPoint(userId, amount);
  }

  @Transactional()
  async usePoints(userId: string, amount: number): Promise<PointBalance | null> {
    const userPoints = await this.existingPointsCheck(userId);
    if (userPoints.availablePoints < amount) {
      throw new Error("Insufficient points");
    }
    return this.pointsBalanceRepository.usePoint(userId, amount);
  }

  @Transactional()
  async deletePoints(userId: string): Promise<PointBalance | null> {
    const existingPoints = await this.existingPointsCheck(userId);
    await this.pointsBalanceRepository.deleteByUserId(userId);
    return existingPoints;
  }

  //Points for a user

  async createPoint() {}

  ///// private //////
  private async existingPointsCheck(userId: string): Promise<PointBalance> {
    const existingPoints = await this.pointsBalanceRepository.findByUserId(userId);
    if (!existingPoints) {
      throw new Error("Points not found for this user");
    }
    return existingPoints;
  }
}
