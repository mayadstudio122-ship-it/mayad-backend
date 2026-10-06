import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAdmin extends Document {
  name: string;
  email: string;
  password: string;
  role: "CEO";
  isActive: boolean;
  otp?: string;
  otpExpiresAt?: Date;
  pendingEmail?: string;
  emailOtp?: string;
  emailOtpExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const adminSchema = new Schema<IAdmin>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      default: "MAYAD CEO",
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["CEO"],
      default: "CEO",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    otp: {
      type: String,
      select: false,
    },

    otpExpiresAt: {
      type: Date,
      select: false,
    },

    pendingEmail: {
      type: String,
      lowercase: true,
      trim: true,
      select: false,
    },

    emailOtp: {
      type: String,
      select: false,
    },

    emailOtpExpiresAt: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

const Admin: Model<IAdmin> =
  mongoose.models.Admin ||
  mongoose.model<IAdmin>("Admin", adminSchema);

export default Admin;