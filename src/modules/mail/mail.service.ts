import nodemailer from "nodemailer";
import config from "../../config/env";
import logger from "../../config/logger";

const transporter = nodemailer.createTransport({
  host: config.mailHost,
  port: config.mailPort,
  secure: config.mailSecure,
  auth: {
    user: config.mailUser,
    pass: config.mailPassword,
  },
});

export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    const info = await transporter.sendMail({
      from: config.mailFrom,
      to,
      subject,
      html,
    });

    logger.info({ messageId: info.messageId }, "Email delivered");
  } catch (error) {
    const mailError = error as {
      name?: string;
      message?: string;
      responseCode?: number;
    };

    logger.error(
      {
        mailProvider: "nodemailer",
        errorName: mailError.name || "UnknownError",
        errorMessage: mailError.message || "Unknown error",
        responseCode: mailError.responseCode,
      },
      "Email delivery failed",
    );
    throw error;
  }
}