import { IsMongoId, IsNumber, IsString } from "class-validator";

export class CreatePointsDto {
  @IsMongoId()
  userId: string;
  @IsNumber()
  point?: number;
}
