import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { UpdateTransactionDto } from "./dto/update-transaction.dto";
import { TransactionType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

interface TransactionFilters {
  type?: string;
  year?: number;
  month?: number;
  date?: string;
  categoryId?: string;
  householdMemberId?: string;
  page?: number;
  limit?: number;
}

interface MatrixChildRow {
  categoryId: string;
  categoryName: string;
  icon: string | null;
  color: string | null;
  dailyTotals: Record<string, number>;
  monthTotal: number;
}

interface MatrixRow {
  categoryId: string;
  categoryName: string;
  icon: string | null;
  color: string | null;
  type: TransactionType;
  isParent: boolean;
  dailyTotals: Record<string, number>;
  monthTotal: number;
  children: MatrixChildRow[];
}

interface MatrixColumnTotals {
  expense: Record<string, number>;
  income: Record<string, number>;
}

interface MatrixGrandTotal {
  expense: number;
  income: number;
  balance: number;
}

interface MonthlyMatrixResponse {
  year: number;
  month: number;
  daysInMonth: number;
  rows: MatrixRow[];
  columnTotals: MatrixColumnTotals;
  grandTotal: MatrixGrandTotal;
}

interface YearlyMatrixResponse {
  year: number;
  rows: MatrixRow[];
  columnTotals: MatrixColumnTotals;
  grandTotal: MatrixGrandTotal;
}

interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  color: string | null;
  total: number;
}

interface DashboardSummary {
  totalBalance: number;
  totalExpenses: number;
  totalIncomes: number;
  recentTransactions: unknown[];
  expensesByCategory: CategoryBreakdown[];
}

function toNumber(value: Decimal | number | string): number {
  if (typeof value === "number") return value;
  return parseFloat(String(value));
}

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async getAll(userId: string, filters: TransactionFilters) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };

    if (filters.type) {
      where.type = filters.type as TransactionType;
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.householdMemberId) {
      where.householdMemberId = filters.householdMemberId;
    }

    if (filters.date) {
      const start = new Date(filters.date);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(filters.date);
      end.setUTCHours(23, 59, 59, 999);
      where.date = { gte: start, lte: end };
    } else if (filters.year || filters.month) {
      const year = filters.year ?? new Date().getFullYear();
      const month = filters.month;

      if (month) {
        const start = new Date(Date.UTC(year, month - 1, 1));
        const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
        where.date = { gte: start, lte: end };
      } else {
        const start = new Date(Date.UTC(year, 0, 1));
        const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
        where.date = { gte: start, lte: end };
      }
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          category: true,
          householdMember: true,
        },
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    // Inject repeating projections when filtering by a specific month
    if (filters.year && filters.month) {
      const year = filters.year;
      const month = filters.month;
      const monthStart = new Date(Date.UTC(year, month - 1, 1));
      const repeating = await this.fetchRepeatingSource(
        userId,
        monthStart,
        monthStart,
        filters.householdMemberId,
      );
      const projections = repeating.map((tx) => ({
        ...tx,
        date: (() => {
          const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
          const day = Math.min(tx.date.getUTCDate(), daysInMonth);
          return new Date(Date.UTC(year, month - 1, day));
        })(),
        isProjected: true,
        householdMember: tx.householdMember ?? null,
      }));
      return {
        data: [...transactions, ...projections],
        total: total + projections.length,
        page,
        limit,
      };
    }

    return { data: transactions, total, page, limit };
  }

  async create(userId: string, dto: CreateTransactionDto) {
    console.log("[create] dto:", JSON.stringify({ isRepeating: dto.isRepeating, endDate: dto.endDate }));
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    const isCategoryAccessible = category.isSystem || category.userId === userId;
    if (!isCategoryAccessible) {
      throw new ForbiddenException("Category is not accessible");
    }

    if (dto.householdMemberId) {
      const member = await this.prisma.householdMember.findUnique({
        where: { id: dto.householdMemberId },
      });

      if (!member) {
        throw new NotFoundException("Household member not found");
      }

      if (member.userId !== userId) {
        throw new ForbiddenException("Household member is not accessible");
      }
    }

    return this.prisma.transaction.create({
      data: {
        type: dto.type,
        amount: dto.amount,
        categoryId: dto.categoryId,
        description: dto.description,
        date: new Date(dto.date),
        isRepeating: dto.isRepeating ?? false,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        userId,
        householdMemberId: dto.householdMemberId ?? null,
      },
      include: {
        category: true,
        householdMember: true,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException("Transaction not found");
    }

    if (transaction.userId !== userId) {
      throw new ForbiddenException("You do not own this transaction");
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });

      if (!category) {
        throw new NotFoundException("Category not found");
      }

      const isCategoryAccessible =
        category.isSystem || category.userId === userId;
      if (!isCategoryAccessible) {
        throw new ForbiddenException("Category is not accessible");
      }
    }

    if (dto.householdMemberId) {
      const member = await this.prisma.householdMember.findUnique({
        where: { id: dto.householdMemberId },
      });

      if (!member) {
        throw new NotFoundException("Household member not found");
      }

      if (member.userId !== userId) {
        throw new ForbiddenException("Household member is not accessible");
      }
    }

    return this.prisma.transaction.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
        ...(dto.isRepeating !== undefined && { isRepeating: dto.isRepeating }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
        ...(dto.householdMemberId !== undefined && {
          householdMemberId: dto.householdMemberId,
        }),
      },
      include: {
        category: true,
        householdMember: true,
      },
    });
  }

  async delete(userId: string, id: string): Promise<{ message: string }> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException("Transaction not found");
    }

    if (transaction.userId !== userId) {
      throw new ForbiddenException("You do not own this transaction");
    }

    await this.prisma.transaction.delete({ where: { id } });

    return { message: "Transaction deleted successfully" };
  }

  async getDashboardSummary(userId: string): Promise<DashboardSummary> {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const monthEnd = new Date(
      Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    );

    const [expenses, incomes, recentTransactions, expensesGrouped] =
      await Promise.all([
        this.prisma.transaction.aggregate({
          where: {
            userId,
            type: TransactionType.EXPENSE,
            date: { gte: monthStart, lte: monthEnd },
          },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            userId,
            type: TransactionType.INCOME,
            date: { gte: monthStart, lte: monthEnd },
          },
          _sum: { amount: true },
        }),
        this.prisma.transaction.findMany({
          where: { userId },
          include: { category: true, householdMember: true },
          orderBy: { date: "desc" },
          take: 5,
        }),
        this.prisma.transaction.findMany({
          where: {
            userId,
            type: TransactionType.EXPENSE,
            date: { gte: monthStart, lte: monthEnd },
          },
          include: {
            category: {
              include: { parent: true },
            },
          },
        }),
      ]);

    const totalExpenses = toNumber(expenses._sum.amount ?? 0);
    const totalIncomes = toNumber(incomes._sum.amount ?? 0);
    const totalBalance = totalIncomes - totalExpenses;

    // Group by parent category
    const categoryMap = new Map<
      string,
      { categoryName: string; color: string | null; total: number }
    >();

    for (const tx of expensesGrouped) {
      const parentCategory = tx.category.parent ?? tx.category;
      const existing = categoryMap.get(parentCategory.id);
      const amount = toNumber(tx.amount);

      if (existing) {
        existing.total += amount;
      } else {
        categoryMap.set(parentCategory.id, {
          categoryName: parentCategory.name,
          color: parentCategory.color,
          total: amount,
        });
      }
    }

    const expensesByCategory: CategoryBreakdown[] = Array.from(
      categoryMap.entries(),
    ).map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.categoryName,
      color: data.color,
      total: Math.round(data.total * 100) / 100,
    }));

    return {
      totalBalance: Math.round(totalBalance * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      totalIncomes: Math.round(totalIncomes * 100) / 100,
      recentTransactions,
      expensesByCategory,
    };
  }

  private async fetchRepeatingSource(
    userId: string,
    beforeDate: Date,
    periodStart: Date,
    householdMemberId?: string,
  ) {
    return this.prisma.transaction.findMany({
      where: {
        userId,
        isRepeating: true,
        date: { lt: beforeDate },
        OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
        ...(householdMemberId ? { householdMemberId } : {}),
      },
      include: { category: { include: { parent: true } } },
    });
  }

  private projectIntoMonth(
    tx: Awaited<ReturnType<typeof this.fetchRepeatingSource>>[number],
    year: number,
    month: number,
  ) {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const day = Math.min(tx.date.getUTCDate(), daysInMonth);
    return { ...tx, date: new Date(Date.UTC(year, month - 1, day)), isProjected: true };
  }

  async getMonthlyMatrix(
    userId: string,
    year: number,
    month: number,
    householdMemberId?: string,
  ): Promise<MonthlyMatrixResponse> {
    if (!year || !month) {
      throw new BadRequestException("year and month are required");
    }

    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(
      Date.UTC(year, month - 1, daysInMonth, 23, 59, 59, 999),
    );

    const [regular, repeating] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          userId,
          date: { gte: monthStart, lte: monthEnd },
          ...(householdMemberId ? { householdMemberId } : {}),
        },
        include: { category: { include: { parent: true } } },
      }),
      this.fetchRepeatingSource(userId, monthStart, monthStart, householdMemberId),
    ]);

    const projections = repeating.map((tx) =>
      this.projectIntoMonth(tx, year, month),
    );

    return this.buildMatrixResponse(
      [...regular, ...projections],
      year,
      month,
      daysInMonth,
      "monthly",
    );
  }

  async getYearlyMatrix(
    userId: string,
    year: number,
    householdMemberId?: string,
  ): Promise<YearlyMatrixResponse> {
    if (!year) {
      throw new BadRequestException("year is required");
    }

    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const [regular, beforeYear] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          userId,
          date: { gte: yearStart, lte: yearEnd },
          ...(householdMemberId ? { householdMemberId } : {}),
        },
        include: { category: { include: { parent: true } } },
      }),
      this.fetchRepeatingSource(userId, yearStart, yearStart, householdMemberId),
    ]);

    // Project pre-year repeating txs into every applicable month of this year
    const projections: ReturnType<typeof this.projectIntoMonth>[] = [];
    for (const tx of beforeYear) {
      for (let m = 1; m <= 12; m++) {
        const mStart = new Date(Date.UTC(year, m - 1, 1));
        if (tx.endDate && tx.endDate < mStart) continue;
        projections.push(this.projectIntoMonth(tx, year, m));
      }
    }

    // Also project within-year repeating txs into subsequent months
    for (const tx of regular) {
      if (!tx.isRepeating) continue;
      const txMonth = tx.date.getUTCMonth() + 1;
      for (let m = txMonth + 1; m <= 12; m++) {
        const mStart = new Date(Date.UTC(year, m - 1, 1));
        if (tx.endDate && tx.endDate < mStart) continue;
        projections.push(this.projectIntoMonth(tx, year, m));
      }
    }

    const result = this.buildMatrixResponse(
      [...regular, ...projections],
      year,
      null,
      12,
      "yearly",
    );

    return {
      year: result.year,
      rows: result.rows,
      columnTotals: result.columnTotals,
      grandTotal: result.grandTotal,
    };
  }

  private buildMatrixResponse(
    transactions: Array<{
      id: string;
      type: TransactionType;
      amount: Decimal;
      date: Date;
      categoryId: string;
      isProjected?: boolean;
      category: {
        id: string;
        name: string;
        icon: string | null;
        color: string | null;
        parentId: string | null;
        parent: {
          id: string;
          name: string;
          icon: string | null;
          color: string | null;
        } | null;
      };
    }>,
    year: number,
    month: number | null,
    columnCount: number,
    mode: "monthly" | "yearly",
  ): MonthlyMatrixResponse {
    // Map: parentCategoryId -> { meta, children: Map<childCategoryId, dailyTotals> }
    const parentMap = new Map<
      string,
      {
        name: string;
        icon: string | null;
        color: string | null;
        type: TransactionType;
        dailyTotals: Map<number, number>;
        children: Map<
          string,
          {
            name: string;
            icon: string | null;
            color: string | null;
            dailyTotals: Map<number, number>;
          }
        >;
      }
    >();

    for (const tx of transactions) {
      const amount = toNumber(tx.amount);
      const columnKey =
        mode === "monthly"
          ? tx.date.getUTCDate()
          : tx.date.getUTCMonth() + 1;

      const parentCategory = tx.category.parent ?? tx.category;
      const isChild = tx.category.parentId !== null;

      if (!parentMap.has(parentCategory.id)) {
        parentMap.set(parentCategory.id, {
          name: parentCategory.name,
          icon: parentCategory.icon,
          color: parentCategory.color,
          type: tx.type,
          dailyTotals: new Map(),
          children: new Map(),
        });
      }

      const parentEntry = parentMap.get(parentCategory.id)!;

      // Add to parent totals
      const parentDayTotal = parentEntry.dailyTotals.get(columnKey) ?? 0;
      parentEntry.dailyTotals.set(columnKey, parentDayTotal + amount);

      // Add to child totals if this transaction belongs to a subcategory
      if (isChild) {
        if (!parentEntry.children.has(tx.category.id)) {
          parentEntry.children.set(tx.category.id, {
            name: tx.category.name,
            icon: tx.category.icon,
            color: tx.category.color,
            dailyTotals: new Map(),
          });
        }

        const childEntry = parentEntry.children.get(tx.category.id)!;
        const childDayTotal = childEntry.dailyTotals.get(columnKey) ?? 0;
        childEntry.dailyTotals.set(columnKey, childDayTotal + amount);
      }
    }

    const columnTotals: MatrixColumnTotals = { expense: {}, income: {} };
    let grandExpense = 0;
    let grandIncome = 0;

    const rows: MatrixRow[] = Array.from(parentMap.entries()).map(
      ([parentId, parentData]) => {
        // Build dailyTotals object for parent
        const dailyTotalsObj: Record<string, number> = {};
        let monthTotal = 0;

        for (let col = 1; col <= columnCount; col++) {
          const val = parentData.dailyTotals.get(col) ?? 0;
          dailyTotalsObj[String(col)] = Math.round(val * 100) / 100;
          monthTotal += val;

          if (parentData.type === TransactionType.EXPENSE) {
            columnTotals.expense[String(col)] =
              (columnTotals.expense[String(col)] ?? 0) + val;
            grandExpense += val;
          } else {
            columnTotals.income[String(col)] =
              (columnTotals.income[String(col)] ?? 0) + val;
            grandIncome += val;
          }
        }

        // Build children rows
        const children: MatrixChildRow[] = Array.from(
          parentData.children.entries(),
        ).map(([childId, childData]) => {
          const childDailyTotals: Record<string, number> = {};
          let childMonthTotal = 0;

          for (let col = 1; col <= columnCount; col++) {
            const val = childData.dailyTotals.get(col) ?? 0;
            childDailyTotals[String(col)] = Math.round(val * 100) / 100;
            childMonthTotal += val;
          }

          return {
            categoryId: childId,
            categoryName: childData.name,
            icon: childData.icon,
            color: childData.color,
            dailyTotals: childDailyTotals,
            monthTotal: Math.round(childMonthTotal * 100) / 100,
          };
        });

        return {
          categoryId: parentId,
          categoryName: parentData.name,
          icon: parentData.icon,
          color: parentData.color,
          type: parentData.type,
          isParent: true,
          dailyTotals: dailyTotalsObj,
          monthTotal: Math.round(monthTotal * 100) / 100,
          children,
        };
      },
    );

    // Round column totals
    for (const col of Object.keys(columnTotals.expense)) {
      columnTotals.expense[col] =
        Math.round(columnTotals.expense[col] * 100) / 100;
    }
    for (const col of Object.keys(columnTotals.income)) {
      columnTotals.income[col] =
        Math.round(columnTotals.income[col] * 100) / 100;
    }

    grandExpense = Math.round(grandExpense * 100) / 100;
    grandIncome = Math.round(grandIncome * 100) / 100;

    return {
      year,
      month: month ?? 0,
      daysInMonth: columnCount,
      rows,
      columnTotals,
      grandTotal: {
        expense: grandExpense,
        income: grandIncome,
        balance: Math.round((grandIncome - grandExpense) * 100) / 100,
      },
    };
  }
}
