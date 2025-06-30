import { InjectModel } from "@nestjs/mongoose";
import { Points, PointsDocument } from "./schema/points.schema";
import { Model } from "mongoose";

export class PointsRepository {
  constructor(
    @InjectModel(Points.name)
    private readonly pointsModel: Model<PointsDocument>,
  ) {}

  async create(userId: string, point: number = 1000): Promise<Points> {
    const newPoints = new this.pointsModel({
      userId,
      point,
    });

    return await newPoints.save();
  }

  async findById(id: string): Promise<Points | null> {
    return await this.pointsModel.findById(id);
  }

  async findByUserId(userId: string): Promise<Points | null> {
    return await this.pointsModel.findOne({ userId });
  }

  async updatePoints(userId: string, newPoint: number): Promise<Points | null> {
    return await this.pointsModel.findOneAndUpdate(
      { userId },
      { point: newPoint },
      { new: true },
    );
  }

  async adjustPoints(userId: string, amount: number): Promise<Points | null> {
    return await this.pointsModel.findOneAndUpdate(
      { userId },
      { $inc: { point: amount } },
      { new: true },
    );
  }

  async addPoints(userId: string, amount: number): Promise<Points | null> {
    return await this.adjustPoints(userId, amount);
  }

  async subtractPoints(userId: string, amount: number): Promise<Points | null> {
    return await this.adjustPoints(userId, -amount);
  }

  async deleteById(id: string): Promise<Points | null> {
    return await this.pointsModel.findByIdAndDelete(id);
  }
}
