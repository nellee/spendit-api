import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { SignupDto } from "./dto/signup.dto";
import { SigninDto } from "./dto/signin.dto";
import { randomBytes, createHash } from "crypto";
import * as bcrypt from "bcrypt";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async signup(payload: SignupDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });
    if (existingUser) {
      throw new ConflictException("Email is already registered");
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: payload.email,
        name: payload.name,
        passwordHash: passwordHash,
      },
    });

    const accessToken = this.createAccessToken(user.id, user.email, user.role);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        currency: user.currency,
      },
      accessToken,
      refreshToken,
    };
  }

  async signin(payload: SigninDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(
      payload.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const accessToken = this.createAccessToken(user.id, user.email, user.role);
    const refreshTokenValue = await this.createRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        currency: user.currency,
      },
      accessToken,
      refreshToken: refreshTokenValue,
    };
  }

  async refresh(refreshTokenValue: string) {
    if (!refreshTokenValue) {
      throw new UnauthorizedException("Refresh token missing");
    }

    const tokenHash = this.hashToken(refreshTokenValue);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token invalid or expired");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: storedToken.userId },
    });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

    const accessToken = this.createAccessToken(user.id, user.email, user.role);
    const newRefreshToken = await this.createRefreshToken(user.id);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async signout(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { message: "Signed out successfully" };
  }

  private createAccessToken(userId: string, email: string, role: string) {
    return this.jwtService.sign({ sub: userId, email, role });
  }

  private async createRefreshToken(userId: string) {
    const token = randomBytes(64).toString("hex");
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return token;
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}
