import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { Category } from "@prisma/client";

interface CategoryWithChildren extends Category {
  children: Category[];
}

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async getAll(userId: string): Promise<CategoryWithChildren[]> {
    const categories = await this.prisma.category.findMany({
      where: {
        OR: [{ isSystem: true }, { userId }],
        parentId: null,
      },
      include: {
        children: {
          where: {
            OR: [{ isSystem: true }, { userId }],
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return categories;
  }

  async create(userId: string, dto: CreateCategoryDto): Promise<Category> {
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });

      if (!parent) {
        throw new NotFoundException("Parent category not found");
      }

      const isAccessible = parent.isSystem || parent.userId === userId;
      if (!isAccessible) {
        throw new ForbiddenException("Parent category is not accessible");
      }

      if (parent.parentId !== null) {
        throw new BadRequestException(
          "Categories can only be nested one level deep",
        );
      }
    }

    return this.prisma.category.create({
      data: {
        name: dto.name,
        icon: dto.icon,
        color: dto.color,
        parentId: dto.parentId ?? null,
        userId,
        isSystem: false,
      },
    });
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    if (category.isSystem) {
      throw new ForbiddenException("System categories cannot be modified");
    }

    if (category.userId !== userId) {
      throw new ForbiddenException("You do not own this category");
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
    });
  }

  async delete(userId: string, id: string): Promise<{ message: string }> {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    if (category.isSystem) {
      throw new ForbiddenException("System categories cannot be deleted");
    }

    if (category.userId !== userId) {
      throw new ForbiddenException("You do not own this category");
    }

    const transactionCount = await this.prisma.transaction.count({
      where: { categoryId: id },
    });

    if (transactionCount > 0) {
      throw new BadRequestException(
        "This category has transactions. Reassign them first.",
      );
    }

    await this.prisma.category.delete({ where: { id } });

    return { message: "Category deleted successfully" };
  }
}
