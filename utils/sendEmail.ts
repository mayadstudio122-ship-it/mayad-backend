
import nodemailer from "nodemailer";

interface SendArtistCredentialsEmailParams {
  toEmail: string;
  artistName: string;
  temporaryPassword: string;
  loginLink: string;
}

interface SendInvitationEmailParams {
  toEmail: string;
  artistName: string;
  inviteLink: string;
}

interface SendAdminOtpEmailParams {
  toEmail: string;
  adminName: string;
  otp: string;
}

const createTransporter = () => {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
  } = process.env;

  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP user and password environment variables are missing");
  }

  const host = (SMTP_HOST || "smtp.gmail.com").trim();
  const port = Number(SMTP_PORT || 587);

  // Use Nodemailer's built-in Gmail service configuration if host is gmail
  if (host.includes("gmail")) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: SMTP_USER.trim(),
        pass: SMTP_PASS.trim(),
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user: SMTP_USER.trim(),
      pass: SMTP_PASS.trim(),
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

// Escape user-provided values before inserting them into HTML.
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });

// 1. Send new artist account credentials
export const sendArtistCredentialsEmail = async ({
  toEmail,
  artistName,
  temporaryPassword,
  loginLink,
}: SendArtistCredentialsEmailParams) => {
  const transporter = createTransporter();

  const safeName = escapeHtml(artistName);
  const safeEmail = escapeHtml(toEmail);
  const safePassword = escapeHtml(temporaryPassword);
  const safeLoginLink = escapeHtml(loginLink);

  await transporter.sendMail({
    from:
      process.env.SMTP_FROM ||
      process.env.SMTP_USER,

    to: toEmail,

    subject: "MAYAD Artist Portal - Your Login Credentials",

    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; color: #222;">

        <h2 style="color: #111;">
          Welcome to MAYAD Artist Portal
        </h2>

        <p>Hello ${safeName},</p>

        <p>
          Your MAYAD Artist Portal account has been created
          by the administration.
        </p>

        <h3>Your Login Credentials</h3>

        <div style="background: #f4f4f4; padding: 18px; border-radius: 8px;">
          <p>
            <strong>Email:</strong> ${safeEmail}
          </p>

          <p>
            <strong>Temporary Password:</strong>
            ${safePassword}
          </p>
        </div>

        <p>
          Please log in using the credentials above.
          You will be required to change your temporary
          password during your first login.
        </p>

        <a
          href="${safeLoginLink}"
          style="
            display: inline-block;
            padding: 12px 24px;
            background: #111;
            color: #fff;
            text-decoration: none;
            border-radius: 6px;
            margin-top: 12px;
          "
        >
          Login to Artist Portal
        </a>

        <p>
          Your account will remain pending until it is
          approved by the MAYAD administration.
        </p>

        <p>
          For security reasons, do not share your
          temporary password with anyone.
        </p>

        <p>Regards,<br />MAYAD Team</p>

      </div>
    `,
  });

  return { sent: true };
};

// 2. Keep existing invitation email function
// This prevents errors in the existing artistController.ts
export const sendInvitationEmail = async ({
  toEmail,
  artistName,
  inviteLink,
}: SendInvitationEmailParams) => {
  const transporter = createTransporter();

  const safeName = escapeHtml(artistName);
  const safeInviteLink = escapeHtml(inviteLink);

  await transporter.sendMail({
    from:
      process.env.SMTP_FROM ||
      process.env.SMTP_USER,

    to: toEmail,

    subject: "MAYAD Artist Portal - Invitation",

    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px;">

        <h2>Welcome to MAYAD</h2>

        <p>Hello ${safeName},</p>

        <p>
          You have been invited to join the MAYAD Artist Portal.
        </p>

        <p>
          Click the button below to continue.
        </p>

        <a
          href="${safeInviteLink}"
          style="
            display: inline-block;
            padding: 12px 24px;
            background: #111;
            color: #fff;
            text-decoration: none;
            border-radius: 6px;
          "
        >
          Accept Invitation
        </a>

        <p>Regards,<br />MAYAD Team</p>

      </div>
    `,
  });

  return { sent: true };
};

// 3. Send Admin Login Verification OTP Email
export const sendAdminOtpEmail = async ({
  toEmail,
  adminName,
  otp,
}: SendAdminOtpEmailParams) => {
  const transporter = createTransporter();

  const safeName = escapeHtml(adminName);
  const safeOtp = escapeHtml(otp);

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: "MAYAD Executive Portal - Login Verification OTP",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; background: #050816; color: #f8fafc; border-radius: 12px; border: 1px solid rgba(245, 197, 24, 0.3);">
        <div style="text-align: center; padding-bottom: 16px; border-b: 1px solid rgba(255, 255, 255, 0.1);">
          <h2 style="color: #f5c518; margin: 0; font-size: 24px;">MAYAD Executive Portal</h2>
          <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Admin Security Authentication</p>
        </div>

        <div style="padding: 24px 0;">
          <p style="font-size: 16px;">Hello <strong>${safeName}</strong>,</p>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">
            You have initiated a login request for the MAYAD Executive Dashboard. Please use the following 6-digit One-Time Password (OTP) to complete your sign-in:
          </p>

          <div style="text-align: center; margin: 28px 0;">
            <div style="display: inline-block; background: #0b0e1b; border: 2px solid #f5c518; color: #f5c518; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 14px 28px; border-radius: 10px;">
              ${safeOtp}
            </div>
          </div>

          <p style="color: #94a3b8; font-size: 13px; text-align: center;">
            This OTP is valid for <strong>10 minutes</strong>. Do not share this code with anyone.
          </p>
        </div>

        <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 16px; font-size: 12px; color: #64748b; text-align: center;">
          If you did not request this login, please secure your credentials immediately.<br />
          &copy; MAYAD OTT Platform Governance.
        </div>
      </div>
    `,
  });

  return { sent: true };
};
