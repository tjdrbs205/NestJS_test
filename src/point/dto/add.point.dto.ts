import { IsMongoId, IsNumber } from "class-validator";

export class AddPointDto {
  @IsMongoId()
  userId: string;
  @IsNumber()
  point: number;
}
