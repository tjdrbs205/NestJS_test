import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type PointBalanceDocument = PointBalance & Document;

@Schema({ timestamps: true })
export class PointBalance {
  id: string;

  @Prop({ unique: true, required: true, immutable: true })
  userId: string;

  @Prop({ required: true, default: 0 })
  totalPoints: number;

  @Prop({ required: true, default: 0 })
  availablePoints: number;

  @Prop({ default: 0 })
  usedPoints?: number;

  @Prop({ default: 0 })
  expiredPoints?: number;
}

export const PointBalanceSchema = SchemaFactory.createForClass(PointBalance);
