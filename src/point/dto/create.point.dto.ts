import { Transform } from "class-transformer";
import { IsMongoId, IsNumber, IsString, Max, Min } from "class-validator";

export class CreatePointsDto {
  @IsMongoId({ message: "user ID must be a valid MongoDB ObjectId" })
  userId: string;

  @IsNumber()
  @Min(1, { message: "Amount must be at least 1" })
  @Max(10000, { message: "Amount must not exceed 1,000,000" })
  @Transform(({ value }) => Number(value))
  amount?: number;
}
