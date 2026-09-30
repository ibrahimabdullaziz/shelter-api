import ApiError from "../../common/utils/ApiError";
import { RegisterDto } from "./auth.validation";
import { authServiceDependencies } from "./dependencies/auth.dependencies";

export { authServiceDependencies } from "./dependencies/auth.dependencies";

const toPublicUser = (user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isVerified: boolean;
}) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  isVerified: user.isVerified,
});

const refreshTokenExpiresAt = () =>
  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

async function issueTokens(user: { id: string; role: string }) {
  const accessToken = authServiceDependencies.signAccessToken({
    id: user.id,
    role: user.role,
  });
  const refreshToken = authServiceDependencies.signRefreshToken({
    id: user.id,
    role: user.role,
  });

  await authServiceDependencies.createRefreshSession(
    user.id,
    refreshToken,
    refreshTokenExpiresAt(),
  );

  return { accessToken, refreshToken };
}

export async function registerService(data: RegisterDto): Promise<boolean> {
  let user;

  try {
    user = await authServiceDependencies.createUser(data);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 409) {
      return false;
    }

    throw error;
  }

  if (!user) {
    throw new ApiError(500, "Server Error While Creation Operation");
  }

  const otp = await authServiceDependencies.generateOtp(
    user.email,
    "VERIFY_EMAIL",
  );

  const html = `
 <div style="font-family: sans-serif; max-width: 400px; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
  <h2 style="color: #333;">Shelter</h2>
  <p style="color: #555;">Your email verification code is:</p>
  <h1 style="color: #4F46E5; letter-spacing: 5px;">${otp}</h1>
  <p style="color: #999; font-size: 12px;">This code expires in 10 minutes.</p>
 </div>
  `;

  await authServiceDependencies.sendMail({
    to: user.email,
    subject: "Verify your email",
    html,
  });

  return true;
}
export async function loginService(email: string, password: string) {
  const user = await authServiceDependencies.findByEmail(email);

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  const rowPassword = await authServiceDependencies.bcrypt.compare(
    password,
    user.password,
  );

  if (!rowPassword) {
    throw new ApiError(401, "Invalid credentials");
  }

  const { accessToken, refreshToken } = await issueTokens(user);

  return { accessToken, refreshToken, user: toPublicUser(user) };
}

export async function refreshService(refreshToken: string) {
  let refreshedToken;
  try {
    refreshedToken =
      await authServiceDependencies.verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(403, "Unauthorized refresh token");
  }

  if (!refreshedToken) {
    throw new ApiError(403, "Unauthorized refresh token");
  }

  const user = await authServiceDependencies.findById(refreshedToken.id);
  if (!user) {
    throw new ApiError(403, "Unauthorized refresh token");
  }

  const nextRefreshToken = authServiceDependencies.signRefreshToken({
    id: user.id,
    role: user.role,
  });
  const rotated = await authServiceDependencies.rotateRefreshSession(
    user.id,
    refreshToken,
    nextRefreshToken,
    refreshTokenExpiresAt(),
  );

  if (!rotated) {
    throw new ApiError(403, "Unauthorized refresh token");
  }

  return {
    accessToken: authServiceDependencies.signAccessToken({
      id: user.id,
      role: user.role,
    }),
    refreshToken: nextRefreshToken,
  };
}

export async function logoutService(refreshToken: string) {
  await authServiceDependencies.revokeRefreshToken(refreshToken);
}

export async function verifyEmailService(email: string, code: string) {
  await authServiceDependencies.verifyOtp(email, code, "VERIFY_EMAIL");

  const user = await authServiceDependencies.prisma.user.update({
    where: { email: email },
    data: { isVerified: true },
  });

  if (!user) {
    throw new ApiError(500, "Failed to verify user email");
  }

  return toPublicUser(user);
}

export async function forgotPasswordService(email: string) {
  const user = await authServiceDependencies.prisma.user.findFirst({
    where: { email: email },
  });

  if (!user) {
    return;
  }

  const otpCode = await authServiceDependencies.generateOtp(
    email,
    "RESET_PASSWORD",
  );

  const html = `
 <div style="font-family: sans-serif; max-width: 400px; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
  <h2 style="color: #333;">Shelter</h2>
  <p style="color: #555;">Your email verification code is:</p>
  <h1 style="color: #4F46E5; letter-spacing: 5px;">${otpCode}</h1>
  <p style="color: #999; font-size: 12px;">This code expires in 10 minutes.</p>
 </div>
  `;

  await authServiceDependencies.sendMail({
    to: user.email,
    subject: "Reset Password",
    html: html,
  });
}

export async function resetPasswordService(
  email: string,
  code: string,
  newPassword: string,
) {
  await authServiceDependencies.verifyOtp(email, code, "RESET_PASSWORD");

  const hashedPassword = await authServiceDependencies.bcrypt.hash(
    newPassword,
    10,
  );

  const updatedUser = await authServiceDependencies.prisma.user.update({
    where: { email },
    data: { password: hashedPassword },
  });

  if (!updatedUser) {
    throw new ApiError(500, "Failed on updated user password!");
  }

  await authServiceDependencies.revokeAllRefreshSessions(updatedUser.id);

  return toPublicUser(updatedUser);
}

export const authServices = {
  registerService,
  loginService,
  refreshService,
  logoutService,
  verifyEmailService,
  forgotPasswordService,
  resetPasswordService,
};
