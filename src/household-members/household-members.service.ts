import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateHouseholdMemberDto } from "./dto/create-household-member.dto";
import { UpdateHouseholdMemberDto } from "./dto/update-household-member.dto";
import { HouseholdMember } from "@prisma/client";
import { Prisma } from "@prisma/client";

@Injectable()
export class HouseholdMembersService {
  constructor(private prisma: PrismaService) {}

  async getAll(userId: string): Promise<HouseholdMember[]> {
    return this.prisma.householdMember.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
  }

  async create(
    userId: string,
    dto: CreateHouseholdMemberDto,
  ): Promise<HouseholdMember> {
    try {
      return await this.prisma.householdMember.create({
        data: {
          name: dto.name,
          userId,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException(
          "A household member with this name already exists",
        );
      }
      throw err;
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateHouseholdMemberDto,
  ): Promise<HouseholdMember> {
    const member = await this.prisma.householdMember.findUnique({
      where: { id },
    });

    if (!member) {
      throw new NotFoundException("Household member not found");
    }

    if (member.userId !== userId) {
      throw new ForbiddenException("You do not own this household member");
    }

    try {
      return await this.prisma.householdMember.update({
        where: { id },
        data: { name: dto.name },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException(
          "A household member with this name already exists",
        );
      }
      throw err;
    }
  }

  async delete(userId: string, id: string): Promise<{ message: string }> {
    const member = await this.prisma.householdMember.findUnique({
      where: { id },
    });

    if (!member) {
      throw new NotFoundException("Household member not found");
    }

    if (member.userId !== userId) {
      throw new ForbiddenException("You do not own this household member");
    }

    const transactionCount = await this.prisma.transaction.count({
      where: { householdMemberId: id },
    });

    if (transactionCount > 0) {
      throw new BadRequestException(
        "This member has transactions linked. Delete or reassign them first.",
      );
    }

    await this.prisma.householdMember.delete({ where: { id } });

    return { message: "Household member deleted successfully" };
  }
}
