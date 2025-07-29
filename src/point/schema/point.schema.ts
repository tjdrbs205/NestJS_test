import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type PointDocument = Point & Document;

export enum PointType {
  EARN = "EARN",
  USE = "USE",
  EXPIRE = "EXPIRE",
}

@Schema({ timestamps: true })
export class Point {
  id: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: PointType })
  type: PointType;

  @Prop()
  description?: string;

  @Prop()
  referenceId?: string;

  @Prop({ type: Date, default: null })
  expiresAt?: Date | null;

  @Prop({ default: true })
  isActive: boolean;

  static createInitialPoint(userId: string, initPoint: number): Partial<Point> {
    return {
      userId,
      amount: initPoint,
      type: PointType.EARN,
      description: "가입 시 기본 포인트",
      expiresAt: null, // 무제한 포인트
      isActive: true,
    };
  }
}

export const PointSchema = SchemaFactory.createForClass(Point);

PointSchema.index({ userId: 1, createdAt: -1 });
PointSchema.index({ userId: 1, expiresAt: 1 });
PointSchema.index({ userId: 1, isActive: 1 });
