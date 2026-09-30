import bcrypt from "bcryptjs";
import request from "supertest";
import prisma from "../../../src/db/prisma";

type HttpClient = Pick<ReturnType<typeof request>, "post">;

type RegisteredUser = {
  id: string;
  email: string;
  password: string;
};

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

export async function createTestAdmin(): Promise<RegisteredUser> {
  const email = uniqueEmail("e2e-admin");
  const password = "admin-password-123";

  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, 10),
      firstName: "E2E",
      lastName: "Admin",
      role: "ADMIN",
    },
  });

  return { id: user.id, email, password };
}

export async function registerTestUser(
  client: HttpClient,
  prefix: string,
): Promise<RegisteredUser> {
  const email = uniqueEmail(`e2e-${prefix}`);
  const password = "user-password-123";

  const response = await client.post("/api/auth/register").send({
    email,
    password,
    firstName: "E2E",
    lastName: prefix,
  });

  if (response.status !== 202) {
    throw new Error(`Registration failed with status ${response.status}`);
  }

  return {
    id: (await prisma.user.findUniqueOrThrow({ where: { email } })).id,
    email,
    password,
  };
}

export async function promoteUserToHost(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { role: "HOST" },
  });
}

export async function loginTestUser(client: HttpClient, user: RegisteredUser) {
  const response = await client.post("/api/auth/login").send({
    email: user.email,
    password: user.password,
  });

  if (response.status !== 200) {
    throw new Error(`Login failed with status ${response.status}`);
  }

  return {
    accessToken: response.body.data.accessToken as string,
    user: response.body.data.user,
  };
}

export type { RegisteredUser };
