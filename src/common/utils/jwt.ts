import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import config from "../../config/env";

type Role = string;

interface JwtPayload {
  id: string;
  role: Role;
  tokenType?: "access" | "refresh";
}

const accessTokenOptions = {
  algorithm: "HS256" as const,
  expiresIn: "15min" as const,
};

const refreshTokenOptions = {
  algorithm: "HS256" as const,
  expiresIn: "7d" as const,
};

export function signAccessToken(payload: JwtPayload): string {
  const token = jwt.sign(
    { ...payload, tokenType: "access" },
    config.jwtAccessSecret,
    {
      ...accessTokenOptions,
    },
  );
  return token;
}

export function signRefreshToken(payload: JwtPayload): string {
  const token = jwt.sign(
    { ...payload, tokenType: "refresh" },
    config.jwtRefreshSecret,
    {
      ...refreshTokenOptions,
      jwtid: crypto.randomUUID(),
    },
  );
  return token;
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.jwtAccessSecret, {
    algorithms: ["HS256"],
  });
  if (typeof decoded === "string" || decoded.tokenType !== "access") {
    throw new Error("Invalid access token type");
  }
  return decoded as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.jwtRefreshSecret, {
    algorithms: ["HS256"],
  });
  if (typeof decoded === "string" || decoded.tokenType !== "refresh") {
    throw new Error("Invalid refresh token type");
  }
  return decoded as JwtPayload;
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
