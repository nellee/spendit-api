import { IsString, MinLength } from "class-validator";

export class CreateHouseholdMemberDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
