import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { PointBalance, PointBalanceDocument } from "../schema/pointBalance.schema";
import { HandleAllDbErrors } from "../../common/decorator/DbErrors.decorator";
import { TransactionContextStorage } from "../../common/transaction/transaction.context";
import { BaseRepository } from "../../common/repository";

@Injectable()
@HandleAllDbErrors
export class PointBalanceRepository extends BaseRepository<PointBalanceDocument> {
  constructor(
    @InjectModel(PointBalance.name)
    private readonly pointBalanceModel: Model<PointBalanceDocument>,
    transactionContextStorage: TransactionContextStorage,
  ) {
    super(pointBalanceModel, transactionContextStorage);
  }

  // 도메인 특화 메서드들
  async createUserBalance(
    userId: string,
    initpoint: number,
  ): Promise<PointBalanceDocument> {
    const pointBalance = {
      userId,
      totalPoints: initpoint,
      availablePoints: initpoint,
      usedPoints: 0,
      expiredPoints: 0,
    };

    return await this.create(pointBalance);
  }

  async findByUserId(userId: string): Promise<PointBalanceDocument | null> {
    return await this.findOne({ userId });
  }

  async earnPoint(userId: string, amount: number): Promise<PointBalanceDocument | null> {
    const attachedOptions = this.attachSession({ upsert: true, new: true, lean: true });

    return await this.pointBalanceModel.findOneAndUpdate(
      { userId },
      {
        $inc: {
          totalPoints: amount,
          availablePoints: amount,
        },
      },
      attachedOptions,
    );
  }

  async usePoint(userId: string, amount: number): Promise<PointBalanceDocument | null> {
    const attachedOptions = this.attachSession({ new: true, lean: true });

    return await this.pointBalanceModel.findOneAndUpdate(
      { userId },
      {
        $inc: {
          availablePoints: -amount,
          usedPoints: amount,
        },
      },
      attachedOptions,
    );
  }

  async expirePoint(
    userId: string,
    amount: number,
  ): Promise<PointBalanceDocument | null> {
    const attachedOptions = this.attachSession({ new: true, lean: true });

    return await this.pointBalanceModel.findOneAndUpdate(
      { userId, availablePoints: { $gte: amount } },
      {
        $inc: {
          availablePoints: -amount,
          expiredPoints: amount,
        },
      },
      attachedOptions,
    );
  }

  async exist(userId: string): Promise<boolean> {
    const result = await this.pointBalanceModel.exists({ userId });
    return result !== null;
  }

  async deleteByUserId(userId: string) {
    return await this.deleteOne({ userId });
  }
}
