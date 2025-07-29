import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model } from "mongoose";
import { Point, PointDocument } from "../schema/point.schema";
import { HandleAllDbErrors } from "../../common/decorator/DbErrors.decorator";
import { TransactionContextStorage } from "../../common/transaction/transaction.context";
import { BaseRepository } from "../../common/repository";

@Injectable()
@HandleAllDbErrors
export class PointRepository extends BaseRepository<PointDocument> {
  constructor(
    @InjectModel(Point.name) private readonly pointModel: Model<PointDocument>,
    transactionContextStorage: TransactionContextStorage,
  ) {
    super(pointModel, transactionContextStorage);
  }

  // 도메인 특화 메서드들만 유지
  async findByUserId(userId: string): Promise<Point[]> {
    const query = this.pointModel.find({ userId }).sort({ createdAt: -1 });
    return await this.applySessionToQuery(query).exec();
  }

  async findExpiringPoints(userId: string, days: number): Promise<Point[]> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);

    const query = this.pointModel.find({
      userId,
      type: "EARN",
      isActive: true,
      expiresAt: {
        $ne: null, // 무제한 포인트 제외
        $gte: new Date(),
        $lte: expiryDate,
      },
    });

    return await this.applySessionToQuery(query).lean();
  }

  async findExpitedPoints(userId?: string): Promise<Point[]> {
    const filter: FilterQuery<PointDocument> = {
      type: "EARN",
      isActive: false,
      expiresAt: {
        $ne: null, // 무제한 포인트 제외
        $lt: new Date(),
      },
    };

    if (userId) {
      filter.userId = userId;
    }

    const query = this.pointModel.find(filter);
    return await this.applySessionToQuery(query).lean();
  }
}
