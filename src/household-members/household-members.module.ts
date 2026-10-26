import { Module } from "@nestjs/common";
import { HouseholdMembersService } from "./household-members.service";
import { HouseholdMembersController } from "./household-members.controller";

@Module({
  controllers: [HouseholdMembersController],
  providers: [HouseholdMembersService],
  exports: [HouseholdMembersService],
})
export class HouseholdMembersModule {}
