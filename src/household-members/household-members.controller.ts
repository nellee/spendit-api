import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { HouseholdMembersService } from "./household-members.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CreateHouseholdMemberDto } from "./dto/create-household-member.dto";
import { UpdateHouseholdMemberDto } from "./dto/update-household-member.dto";

interface JwtUser {
  sub: string;
  email: string;
  role: string;
}

@Controller("household-members")
export class HouseholdMembersController {
  constructor(private householdMembersService: HouseholdMembersService) {}

  @Get()
  getAll(@CurrentUser() user: JwtUser) {
    return this.householdMembersService.getAll(user.sub);
  }

  @Post()
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateHouseholdMemberDto,
  ) {
    return this.householdMembersService.create(user.sub, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: JwtUser,
    @Param("id") id: string,
    @Body() dto: UpdateHouseholdMemberDto,
  ) {
    return this.householdMembersService.update(user.sub, id, dto);
  }

  @Delete(":id")
  delete(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.householdMembersService.delete(user.sub, id);
  }
}
