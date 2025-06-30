import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type PointsDocument = Points & Document;

@Schema({ timestamps: true })
export class Points extends Document {
  @Prop({ unique: true, required: true, immutable: true })
  userId: string;

  @Prop({ required: true })
  point: number;
}

export const PointsSchema = SchemaFactory.createForClass(Points);
