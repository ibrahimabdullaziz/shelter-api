import { Request, Response } from "express";
import asyncHandler from "../../common/utils/asyncHandler";
import { authServices } from "./auth.service";
import { usersRegisteredTotal } from "../../config/metrics";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, firstName, lastName } = req.body;

  const created = await authServices.registerService({
    email,
    password,
    firstName,
    lastName,
  });

  if (created) {
    usersRegisteredTotal.inc();
  }

  req.log?.info({ registrationCreated: created }, "Registration processed");

  return res.status(202).json({
    status: 202,
    message: "If the address can be registered, check your email for next steps.",
  });
});
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const data = await authServices.loginService(email, password);

  req.log?.info(
    { userId: data.user.id, userRole: data.user.role },
    "User logged in",
  );

  return res
    .status(200)
    .json({ status: 200, message: "User logged successfully", data });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body;

  const tokens = await authServices.refreshService(token);

  return res.status(200).json({
    status: 200,
    message: "Token refreshed successfully",
    ...tokens,
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authServices.logoutService(req.body.token);

  return res.status(200).json({
    status: 200,
    message: "Logged out successfully",
  });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  return res
    .status(200)
    .json({ status: 200, message: "User retrieved successfully", data: user });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { email, code } = req.body;

  const verifiedEmail = await authServices.verifyEmailService(email, code);

  return res.status(200).json({
    status: 200,
    message: "Email verified successfully",
    data: verifiedEmail,
  });
});

export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;

    const verifiedEmail = await authServices.forgotPasswordService(email);

    return res.status(200).json({
      status: 200,
      message: "Password changed successfully",
      data: verifiedEmail,
    });
  },
);

export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, code, password } = req.body;

    const verifiedEmail = await authServices.resetPasswordService(
      email,
      code,
      password,
    );

    return res.status(200).json({
      status: 200,
      message: "Password changed successfully",
      data: verifiedEmail,
    });
  },
);
