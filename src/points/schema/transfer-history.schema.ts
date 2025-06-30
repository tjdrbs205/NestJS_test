import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

export type TransferHistoryDocument = TransferHistory & Document;

@Schema({ timestamps: true })
export class TransferHistory {
  @Prop({ required: true, objectId: true })
  sendUserId: string;

  @Prop({ required: true, objectId: true })
  receiveUserId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: ["COMPLETED", "FAILED", "PENDING"] })
  status: string;

  @Prop()
  reason?: string;
}

export const TransferHistorySchema = SchemaFactory.createForClass(TransferHistory);
