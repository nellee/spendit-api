import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

interface JwtUser {
  sub: string;
  email: string;
  role: string;
}

@Controller("categories")
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get()
  getAll(@CurrentUser() user: JwtUser) {
    return this.categoriesService.getAll(user.sub);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(user.sub, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: JwtUser,
    @Param("id") id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(user.sub, id, dto);
  }

  @Delete(":id")
  delete(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.categoriesService.delete(user.sub, id);
  }
}
