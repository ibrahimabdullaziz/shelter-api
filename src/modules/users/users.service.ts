import bcrypt from "bcryptjs";
import { Prisma, User } from "@prisma/client";
import ApiError from "../../common/utils/ApiError";
import prisma from "../../db/prisma";

export const createUser = async (data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) => {
  const hashedPassword = await bcrypt.hash(data.password, 10);

  try {
    return await prisma.user.create({
      data: { ...data, password: hashedPassword },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ApiError(409, "An account with this email already exists");
    }

    throw error;
  }
};

export const findByEmail = (email: string): Promise<User | null> => {
  const user = prisma.user.findFirst({ where: { email: email } });
  return user;
};

export const findById = (id: string): Promise<User | null> => {
  const user = prisma.user.findUnique({ where: { id: id } });
  return user;
};