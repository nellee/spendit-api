import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { TransactionsService } from "./transactions.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { UpdateTransactionDto } from "./dto/update-transaction.dto";

interface JwtUser {
  sub: string;
  email: string;
  role: string;
}

interface TransactionQueryParams {
  type?: string;
  year?: string;
  month?: string;
  date?: string;
  categoryId?: string;
  householdMemberId?: string;
  page?: string;
  limit?: string;
}

interface MatrixQueryParams {
  year?: string;
  month?: string;
  householdMemberId?: string;
}

@Controller("transactions")
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Get("summary/dashboard")
  getDashboardSummary(@CurrentUser() user: JwtUser) {
    return this.transactionsService.getDashboardSummary(user.sub);
  }

  @Get("summary/monthly")
  getMonthlyMatrix(
    @CurrentUser() user: JwtUser,
    @Query() query: MatrixQueryParams,
  ) {
    const year = query.year ? parseInt(query.year, 10) : new Date().getFullYear();
    const month = query.month ? parseInt(query.month, 10) : new Date().getMonth() + 1;
    return this.transactionsService.getMonthlyMatrix(user.sub, year, month, query.householdMemberId);
  }

  @Get("summary/yearly")
  getYearlyMatrix(
    @CurrentUser() user: JwtUser,
    @Query() query: MatrixQueryParams,
  ) {
    const year = query.year ? parseInt(query.year, 10) : new Date().getFullYear();
    return this.transactionsService.getYearlyMatrix(user.sub, year, query.householdMemberId);
  }

  @Get()
  getAll(
    @CurrentUser() user: JwtUser,
    @Query() query: TransactionQueryParams,
  ) {
    return this.transactionsService.getAll(user.sub, {
      type: query.type,
      year: query.year ? parseInt(query.year, 10) : undefined,
      month: query.month ? parseInt(query.month, 10) : undefined,
      date: query.date,
      categoryId: query.categoryId,
      householdMemberId: query.householdMemberId,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Post()
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactionsService.create(user.sub, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: JwtUser,
    @Param("id") id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(user.sub, id, dto);
  }

  @Delete(":id")
  delete(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.transactionsService.delete(user.sub, id);
  }
}
