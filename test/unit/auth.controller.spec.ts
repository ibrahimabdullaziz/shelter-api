import { expect } from "chai";
import { afterEach, describe, it } from "mocha";
import sinon from "sinon";
import type { NextFunction, Request, Response } from "express";
import { authServices } from "../../src/modules/auth/auth.service";
import {
  forgotPassword,
  getMe,
  login,
  refresh,
  register,
  resetPassword,
  verifyEmail,
} from "../../src/modules/auth/auth.controller";

type FakeRequest = Partial<Request> & { body: Record<string, unknown> };

function createResponse() {
  const status = sinon.stub();
  const response = {
    status,
    json: sinon.stub(),
  } as unknown as Response;

  status.returns(response);
  return response;
}

function createRequest(body: Record<string, unknown> = {}): FakeRequest {
  return { body };
}

function flushController() {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

describe("auth controller", () => {
  afterEach(() => sinon.restore());

  it("returns the same accepted response for registration", async () => {
    const service = sinon
      .stub(authServices, "registerService")
      .resolves(true);
    const response = createResponse();

    register(
      createRequest({
        email: "user@example.com",
        password: "password123",
        firstName: "Ada",
        lastName: "Lovelace",
      }) as Request,
      response,
      sinon.stub() as unknown as NextFunction,
    );
    await flushController();

    expect(
      service.calledWith({
        email: "user@example.com",
        password: "password123",
        firstName: "Ada",
        lastName: "Lovelace",
      }),
    ).to.equal(true);
    expect((response.status as sinon.SinonStub).calledWith(202)).to.equal(true);
    expect(
      (response.json as sinon.SinonStub).calledWith({
        status: 202,
        message: "If the address can be registered, check your email for next steps.",
      }),
    ).to.equal(true);
  });
  it("logs in and returns the service data", async () => {
    const data = {
      user: { id: "user-1" },
      accessToken: "access",
      refreshToken: "refresh",
    };
    const service = sinon
      .stub(authServices, "loginService")
      .resolves(data as never);
    const response = createResponse();

    login(
      createRequest({
        email: "user@example.com",
        password: "password123",
      }) as Request,
      response,
      sinon.stub() as unknown as NextFunction,
    );
    await flushController();

    expect(service.calledWith("user@example.com", "password123")).to.equal(
      true,
    );
    expect((response.status as sinon.SinonStub).calledWith(200)).to.equal(true);
    expect(
      (response.json as sinon.SinonStub).calledWith({
        status: 200,
        message: "User logged successfully",
        data,
      }),
    ).to.equal(true);
  });

  it("refreshes a token", async () => {
    const service = sinon.stub(authServices, "refreshService").resolves({
      accessToken: "new-access-token",
      refreshToken: "rotated-refresh-token",
    });
    const response = createResponse();

    refresh(
      createRequest({ token: "refresh-token" }) as Request,
      response,
      sinon.stub() as unknown as NextFunction,
    );
    await flushController();

    expect(service.calledWith("refresh-token")).to.equal(true);
    expect((response.status as sinon.SinonStub).calledWith(200)).to.equal(true);
    expect(
      (response.json as sinon.SinonStub).calledWith({
        status: 200,
        message: "Token refreshed successfully",
        accessToken: "new-access-token",
        refreshToken: "rotated-refresh-token",
      }),
    ).to.equal(true);
  });

  it("returns the authenticated user", async () => {
    const response = createResponse();
    const user = { id: "user-1", role: "GUEST" };
    const request = createRequest() as unknown as Request & {
      user: typeof user;
    };
    request.user = user;

    getMe(request, response, sinon.stub() as unknown as NextFunction);
    await flushController();

    expect((response.status as sinon.SinonStub).calledWith(200)).to.equal(true);
    expect(
      (response.json as sinon.SinonStub).calledWith({
        status: 200,
        message: "User retrieved successfully",
        data: user,
      }),
    ).to.equal(true);
  });

  it("verifies an email", async () => {
    const data = { id: "user-1", isVerified: true };
    const service = sinon
      .stub(authServices, "verifyEmailService")
      .resolves(data as never);
    const response = createResponse();

    verifyEmail(
      createRequest({ email: "user@example.com", code: "123456" }) as Request,
      response,
      sinon.stub() as unknown as NextFunction,
    );
    await flushController();

    expect(service.calledWith("user@example.com", "123456")).to.equal(true);
    expect((response.status as sinon.SinonStub).calledWith(200)).to.equal(true);
    expect(
      (response.json as sinon.SinonStub).calledWith({
        status: 200,
        message: "Email verified successfully",
        data,
      }),
    ).to.equal(true);
  });

  it("requests a password reset", async () => {
    const service = sinon
      .stub(authServices, "forgotPasswordService")
      .resolves(undefined);
    const response = createResponse();

    forgotPassword(
      createRequest({ email: "user@example.com" }) as Request,
      response,
      sinon.stub() as unknown as NextFunction,
    );
    await flushController();

    expect(service.calledWith("user@example.com")).to.equal(true);
    expect((response.status as sinon.SinonStub).calledWith(200)).to.equal(true);
    expect(
      (response.json as sinon.SinonStub).calledWith({
        status: 200,
        message: "Password changed successfully",
        data: undefined,
      }),
    ).to.equal(true);
  });

  it("resets a password", async () => {
    const data = { id: "user-1" };
    const service = sinon
      .stub(authServices, "resetPasswordService")
      .resolves(data as never);
    const response = createResponse();

    resetPassword(
      createRequest({
        email: "user@example.com",
        code: "123456",
        password: "password123",
      }) as Request,
      response,
      sinon.stub() as unknown as NextFunction,
    );
    await flushController();

    expect(
      service.calledWith("user@example.com", "123456", "password123"),
    ).to.equal(true);
    expect((response.status as sinon.SinonStub).calledWith(200)).to.equal(true);
    expect(
      (response.json as sinon.SinonStub).calledWith({
        status: 200,
        message: "Password changed successfully",
        data,
      }),
    ).to.equal(true);
  });

  for (const testCase of [
    ["register", register, "registerService", { email: "user@example.com" }],
    ["login", login, "loginService", { email: "user@example.com" }],
    ["refresh", refresh, "refreshService", { token: "refresh-token" }],
    [
      "verify email",
      verifyEmail,
      "verifyEmailService",
      { email: "user@example.com" },
    ],
    [
      "forgot password",
      forgotPassword,
      "forgotPasswordService",
      { email: "user@example.com" },
    ],
    [
      "reset password",
      resetPassword,
      "resetPasswordService",
      { email: "user@example.com" },
    ],
  ] as const) {
    it(`forwards ${testCase[0]} service errors to next`, async () => {
      const error = new Error(`${testCase[0]} failed`);
      const next = sinon.stub();
      sinon.stub(authServices, testCase[2]).rejects(error);

      testCase[1](
        createRequest(testCase[3]) as Request,
        createResponse(),
        next,
      );
      await flushController();

      expect(next.calledOnceWithExactly(error)).to.equal(true);
    });
  }
});
