import { expect } from "chai";
import { afterEach, describe, it } from "mocha";
import sinon from "sinon";
import ApiError from "../../src/common/utils/ApiError";
import {
  authServiceDependencies,
  forgotPasswordService,
  loginService,
  refreshService,
  registerService,
  resetPasswordService,
  verifyEmailService,
} from "../../src/modules/auth/auth.service";

const user = {
  id: "user-1",
  email: "user@example.com",
  password: "stored-password",
  firstName: "Ada",
  lastName: "Lovelace",
  role: "GUEST",
  isVerified: false,
};

const publicUser = {
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  isVerified: user.isVerified,
};

function restore() {
  sinon.restore();
}

describe("auth service", () => {
  afterEach(restore);

  it("registers a user, creates an OTP, and sends mail without issuing tokens", async () => {
    const createUser = sinon
      .stub(authServiceDependencies, "createUser")
      .resolves(user as never);
    const generateOtp = sinon
      .stub(authServiceDependencies, "generateOtp")
      .resolves("123456");
    const sendMail = sinon.stub(authServiceDependencies, "sendMail");
    const data = {
      email: user.email,
      password: "password123",
      firstName: "Ada",
      lastName: "Lovelace",
    };

    const result = await registerService(data);

    expect(createUser.calledWith(data)).to.equal(true);
    expect(generateOtp.calledWith(user.email, "VERIFY_EMAIL")).to.equal(true);
    expect(
      sendMail.calledWithMatch({
        to: user.email,
        subject: "Verify your email",
        html: sinon.match("123456"),
      }),
    ).to.equal(true);
    expect(result).to.equal(true);
  });
  it("returns the generic registration outcome for an existing email", async () => {
    const duplicateEmailError = new ApiError(
      409,
      "An account with this email already exists",
    );    sinon
      .stub(authServiceDependencies, "createUser")
      .rejects(duplicateEmailError);
    const generateOtp = sinon.stub(authServiceDependencies, "generateOtp");
    const sendMail = sinon.stub(authServiceDependencies, "sendMail");

    const result = await registerService({
      email: user.email,
      password: "password123",
      firstName: "Ada",
      lastName: "Lovelace",
    });

    expect(result).to.equal(false);
    expect(generateOtp.notCalled).to.equal(true);
    expect(sendMail.notCalled).to.equal(true);
  });
  it("throws when user creation returns no user", async () => {
    sinon.stub(authServiceDependencies, "createUser").resolves(null as never);

    try {
      await registerService({
        email: user.email,
        password: "password123",
        firstName: "Ada",
        lastName: "Lovelace",
      });
      expect.fail("registerService should reject");
    } catch (error) {
      expect(error).to.have.property("statusCode", 500);
      expect(error).to.have.property(
        "message",
        "Server Error While Creation Operation",
      );
    }
  });

  it("rejects login for an unknown user", async () => {
    const findByEmail = sinon
      .stub(authServiceDependencies, "findByEmail")
      .resolves(null);

    try {
      await loginService(user.email, "password123");
      expect.fail("loginService should reject");
    } catch (error) {
      expect(findByEmail.calledWith(user.email)).to.equal(true);
      expect(error).to.have.property("statusCode", 401);
      expect(error).to.have.property("message", "Invalid credentials");
    }
  });

  it("rejects login for a wrong password", async () => {
    sinon.stub(authServiceDependencies, "findByEmail").resolves(user as never);
    const compare = sinon
      .stub(authServiceDependencies.bcrypt, "compare")
      .resolves(false);

    try {
      await loginService(user.email, "wrong-password");
      expect.fail("loginService should reject");
    } catch (error) {
      expect(compare.calledWith("wrong-password", user.password)).to.equal(
        true,
      );
      expect(error).to.have.property("statusCode", 401);
      expect(error).to.have.property("message", "Invalid credentials");
    }
  });

  it("logs in with a valid password and returns both tokens", async () => {
    sinon.stub(authServiceDependencies, "findByEmail").resolves(user as never);
    sinon.stub(authServiceDependencies.bcrypt, "compare").resolves(true);
    sinon
      .stub(authServiceDependencies, "signAccessToken")
      .returns("access-token");
    sinon
      .stub(authServiceDependencies, "signRefreshToken")
      .returns("refresh-token");
    sinon.stub(authServiceDependencies, "createRefreshSession").resolves();

    const result = await loginService(user.email, "password123");

    expect(result).to.deep.equal({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: publicUser,
    });
  });

  it("rejects an invalid refresh token", async () => {
    sinon
      .stub(authServiceDependencies, "verifyRefreshToken")
      .resolves(null as never);

    try {
      await refreshService("invalid-refresh-token");
      expect.fail("refreshService should reject");
    } catch (error) {
      expect(error).to.have.property("statusCode", 403);
    }
  });

  it("refreshes a valid token", async () => {
    sinon
      .stub(authServiceDependencies, "verifyRefreshToken")
      .resolves({ id: user.id, role: user.role });
    sinon.stub(authServiceDependencies, "findById").resolves(user as never);
    sinon
      .stub(authServiceDependencies, "signRefreshToken")
      .returns("rotated-refresh-token");
    sinon.stub(authServiceDependencies, "rotateRefreshSession").resolves(true);
    const signAccessToken = sinon
      .stub(authServiceDependencies, "signAccessToken")
      .returns("new-access-token");

    const result = await refreshService("refresh-token");

    expect(
      signAccessToken.calledWith({ id: user.id, role: user.role }),
    ).to.equal(true);
    expect(result).to.deep.equal({
      accessToken: "new-access-token",
      refreshToken: "rotated-refresh-token",
    });
  });

  it("verifies the OTP and marks the email verified", async () => {
    const verifyOtp = sinon
      .stub(authServiceDependencies, "verifyOtp")
      .resolves(true);
    const update = sinon
      .stub(authServiceDependencies.prisma.user, "update")
      .resolves({ ...user, isVerified: true } as never);

    const result = await verifyEmailService(user.email, "123456");

    expect(verifyOtp.calledWith(user.email, "123456", "VERIFY_EMAIL")).to.equal(
      true,
    );
    expect(
      update.calledWith({
        where: { email: user.email },
        data: { isVerified: true },
      }),
    ).to.equal(true);
    expect(result).to.have.property("isVerified", true);
  });

  it("forwards email verification OTP errors", async () => {
    const error = new Error("expired OTP");
    sinon.stub(authServiceDependencies, "verifyOtp").rejects(error);

    try {
      await verifyEmailService(user.email, "expired");
      expect.fail("verifyEmailService should reject");
    } catch (actual) {
      expect(actual).to.equal(error);
    }
  });

  it("does not reveal whether a password-reset email exists", async () => {
    sinon.stub(authServiceDependencies.prisma.user, "findFirst").resolves(null);

    const result = await forgotPasswordService(user.email);

    expect(result).to.equal(undefined);
  });

  it("creates a reset OTP and sends reset mail", async () => {
    sinon
      .stub(authServiceDependencies.prisma.user, "findFirst")
      .resolves(user as never);
    const generateOtp = sinon
      .stub(authServiceDependencies, "generateOtp")
      .resolves("654321");
    const sendMail = sinon.stub(authServiceDependencies, "sendMail");

    const result = await forgotPasswordService(user.email);

    expect(generateOtp.calledWith(user.email, "RESET_PASSWORD")).to.equal(true);
    expect(
      sendMail.calledWithMatch({
        to: user.email,
        subject: "Reset Password",
        html: sinon.match("654321"),
      }),
    ).to.equal(true);
    expect(result).to.equal(undefined);
  });

  it("resets a password after verifying the reset OTP", async () => {
    sinon.stub(authServiceDependencies, "verifyOtp").resolves(true);
    const hash = sinon
      .stub(authServiceDependencies.bcrypt, "hash")
      .resolves("hashed-password");
    const update = sinon
      .stub(authServiceDependencies.prisma.user, "update")
      .resolves({ ...user, password: "hashed-password" } as never);
    sinon.stub(authServiceDependencies, "revokeAllRefreshSessions").resolves();

    const result = await resetPasswordService(
      user.email,
      "123456",
      "new-password",
    );

    expect(hash.calledWith("new-password", 10)).to.equal(true);
    expect(
      update.calledWith({
        where: { email: user.email },
        data: { password: "hashed-password" },
      }),
    ).to.equal(true);
    expect(result).to.deep.equal(publicUser);
  });

  it("forwards reset-password OTP errors", async () => {
    const error = new Error("invalid reset OTP");
    sinon.stub(authServiceDependencies, "verifyOtp").rejects(error);

    try {
      await resetPasswordService(user.email, "invalid", "new-password");
      expect.fail("resetPasswordService should reject");
    } catch (actual) {
      expect(actual).to.equal(error);
    }
  });
});
