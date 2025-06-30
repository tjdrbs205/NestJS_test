import { Injectable } from "@nestjs/common";
import { PointsRepository } from "./points.repository";
import { Points } from "./schema/points.schema";

@Injectable()
export class PointsService {
  constructor(private readonly pointsRepository: PointsRepository) {}

  async createPoints(userId: string, points?: number): Promise<Points | null> {
    const existingPoints = await this.pointsRepository.findByUserId(userId);
    if (existingPoints) {
      throw new Error("Points already exist for this user");
    }
    if (!points) points = undefined;
    return this.pointsRepository.create(userId, points);
  }

  async getPointsByUserId(userId: string): Promise<Points | null> {
    return this.pointsRepository.findByUserId(userId);
  }

  async addPoints(userId: string, amount: number): Promise<Points | null> {
    const existingPoints = await this.pointsRepository.findByUserId(userId);
    if (!existingPoints) {
      throw new Error("Points not found for this user");
    }
    return this.pointsRepository.addPoints(userId, amount);
  }

  async usePoints(userId: string, amount: number): Promise<Points | null> {
    const existingPoints = await this.pointsRepository.findByUserId(userId);
    if (!existingPoints) {
      throw new Error("Points not found for this user");
    }
    return this.pointsRepository.subtractPoints(userId, amount);
  }

  async deletePoints(userId: string): Promise<Points | null> {
    const existingPoints = await this.pointsRepository.findByUserId(userId);
    if (!existingPoints) {
      throw new Error("Points not found for this user");
    }
    const pointsId = existingPoints.id.toString();
    return this.pointsRepository.deleteById(pointsId);
  }
}
