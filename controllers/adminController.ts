

import { Request, Response } from "express";

import bcrypt from "bcryptjs";

import jwt from "jsonwebtoken";

import mongoose from "mongoose";



import Admin from "../models/Admin";

import Artist from "../models/Artist";
const ArtistModel: any = Artist;
import { sendAdminOtpEmail } from "../utils/sendEmail";
import Inquiry from "../models/Inquiry";

// ============================================================
// CEO LOGIN (STEP 1: PASSWORD VERIFICATION & OTP DISPATCH)
// ============================================================

export const adminLogin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
      return;
    }

    const admin = await Admin.findOne({
      email: email.toLowerCase().trim(),
      role: "CEO",
      isActive: true,
    }).select("+password");

    if (!admin) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    // Generate 6-Digit Random Numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    admin.otp = otp;
    admin.otpExpiresAt = otpExpiresAt;
    await admin.save();

    // Print OTP in Backend Terminal for easy local testing
    console.log("\n==========================================");
    console.log(`🔑 [MAYAD DEV] ADMIN OTP FOR ${admin.email}: ${otp}`);
    console.log("==========================================\n");

    // Send OTP via Email
    let emailSent = false;
    try {
      await sendAdminOtpEmail({
        toEmail: admin.email,
        adminName: admin.name || "MAYAD CEO",
        otp,
      });
      emailSent = true;
    } catch (emailErr: any) {
      console.warn("⚠️ Warning: Could not send OTP via SMTP (SMTP variables missing or invalid in .env).");
      console.warn("Details:", emailErr?.message || emailErr);
    }

    res.status(200).json({
      success: true,
      step: "VERIFY_OTP",
      message: emailSent
        ? `OTP sent successfully to ${admin.email}. Please verify to log in.`
        : `OTP generated! (SMTP not configured — view OTP in backend terminal console).`,
      email: admin.email,
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// CEO LOGIN (STEP 2: VERIFY OTP & ISSUE TOKEN)
// ============================================================

export const adminVerifyOtp = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, otp } = req.body as {
      email?: string;
      otp?: string;
    };

    if (!email || !otp) {
      res.status(400).json({
        success: false,
        message: "Email and OTP code are required",
      });
      return;
    }

    const admin = await Admin.findOne({
      email: email.toLowerCase().trim(),
      role: "CEO",
      isActive: true,
    }).select("+otp +otpExpiresAt");

    if (!admin || !admin.otp || !admin.otpExpiresAt) {
      res.status(400).json({
        success: false,
        message: "No pending OTP login session found. Please enter your credentials again.",
      });
      return;
    }

    // Validate Expiry
    if (new Date(admin.otpExpiresAt).getTime() < Date.now()) {
      res.status(400).json({
        success: false,
        message: "OTP code has expired. Please click resend OTP.",
      });
      return;
    }

    // Validate Code Match
    if (admin.otp.trim() !== otp.trim()) {
      res.status(400).json({
        success: false,
        message: "Invalid OTP code. Please try again.",
      });
      return;
    }

    // Clear OTP fields upon successful verification
    admin.otp = undefined;
    admin.otpExpiresAt = undefined;
    await admin.save();

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("JWT_SECRET is missing");
    }

    const token = jwt.sign(
      {
        id: admin._id.toString(),
        role: "CEO",
      },
      jwtSecret,
      {
        expiresIn: "1d",
        issuer: "mayad-admin",
        audience: "mayad-admin-dashboard",
      }
    );

    res.cookie("mayad_admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.status(200).json({
      success: true,
      message: "CEO authentication successful",
      token,
      admin: {
        id: admin._id.toString(),
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Admin OTP verification error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// CEO LOGIN (RESEND OTP)
// ============================================================

export const adminResendOtp = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body as { email?: string };

    if (!email) {
      res.status(400).json({
        success: false,
        message: "Admin email is required",
      });
      return;
    }

    const admin = await Admin.findOne({
      email: email.toLowerCase().trim(),
      role: "CEO",
      isActive: true,
    });

    if (!admin) {
      res.status(404).json({
        success: false,
        message: "Admin account not found",
      });
      return;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    admin.otp = otp;
    admin.otpExpiresAt = otpExpiresAt;
    await admin.save();

    console.log("\n==========================================");
    console.log(`🔑 [MAYAD DEV RESEND] ADMIN OTP FOR ${admin.email}: ${otp}`);
    console.log("==========================================\n");

    let emailSent = false;
    try {
      await sendAdminOtpEmail({
        toEmail: admin.email,
        adminName: admin.name || "MAYAD CEO",
        otp,
      });
      emailSent = true;
    } catch (emailErr: any) {
      console.warn("⚠️ Warning: Could not send OTP via SMTP (SMTP variables missing or invalid in .env).");
    }

    res.status(200).json({
      success: true,
      message: emailSent
        ? `A new 6-digit OTP has been sent to ${admin.email}.`
        : `A new 6-digit OTP was generated (check backend console for code).`,
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resend OTP email",
    });
  }
};



// ============================================================

// GET CEO PROFILE

// ============================================================



export const getAdminProfile = async (

  req: Request,

  res: Response

): Promise<void> => {

  try {

    const adminId = res.locals.admin?.id;



    if (!adminId) {

      res.status(401).json({

        success: false,

        message: "Admin authentication required",

      });

      return;

    }



    const admin = await Admin.findOne({

      _id: adminId,

      role: "CEO",

      isActive: true,

    }).select("name email role isActive");



    if (!admin) {

      res.status(401).json({

        success: false,

        message: "Admin account not found or inactive",

      });

      return;

    }



    res.status(200).json({

      success: true,

      admin,

    });

  } catch (error) {

    console.error("Admin profile error:", error);



    res.status(500).json({

      success: false,

      message: "Unable to fetch admin profile",

    });

  }

};



// ============================================================

// CEO LOGOUT

// ============================================================



export const adminLogout = (

  req: Request,

  res: Response

): void => {

  res.clearCookie("mayad_admin_token", {

    httpOnly: true,

    secure: process.env.NODE_ENV === "production",

    sameSite: "lax",

    path: "/",

  });



  res.status(200).json({

    success: true,

    message: "Logged out successfully",

  });

};



// ============================================================

// DASHBOARD STATS & ANALYTICS

// GET /api/admin/stats

// ============================================================



export const getAdminStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const startDate = new Date();
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    startDate.setMonth(startDate.getMonth() - 5);

    const [
      registeredArtists,
      legacyArtists,
      pendingApprovals,
      rejectedArtists,
      approvedRegisteredCount,
    ] = await Promise.all([
      Artist.find()
        .select("fullName stageName category accountStatus isVerified createdAt profilePhoto")
        .sort({ createdAt: -1 })
        .lean(),
      PublicArtist.find()
        .select("legacyId slug name originalName role imageUrl bio createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      Artist.countDocuments({ accountStatus: "Pending Approval" }),
      Artist.countDocuments({ accountStatus: "Rejected" }),
      Artist.countDocuments({ accountStatus: "Approved" }),
    ]);

    const normalizeName = (value: unknown): string =>
      String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

    const legacyByName = new Map<string, any>();
    for (const artist of legacyArtists as any[]) {
      const name = normalizeName(artist.name || artist.originalName);
      if (name && !legacyByName.has(name)) legacyByName.set(name, artist);
    }

    const legacyNames = new Set(legacyByName.keys());
    const additionalRegistered = (registeredArtists as any[]).filter((artist) => {
      const name = normalizeName(artist.stageName || artist.fullName);
      return name && !legacyNames.has(name);
    });

    const totalArtists = legacyByName.size + additionalRegistered.length;
    const verifiedArtists = legacyByName.size + additionalRegistered.filter(
      (artist) => artist.isVerified === true
    ).length;
    const approvedArtists = legacyByName.size + additionalRegistered.filter(
      (artist) => artist.accountStatus === "Approved"
    ).length;

    // Build monthly trend from both collections, deduplicating registered
    // profiles against legacy profiles by normalized display name.
    const trendRecords = [
      ...(legacyArtists as any[]).map((artist) => ({
        name: artist.name || artist.originalName,
        createdAt: artist.createdAt,
      })),
      ...additionalRegistered.map((artist) => ({
        name: artist.stageName || artist.fullName,
        createdAt: artist.createdAt,
      })),
    ].filter((artist) => artist.createdAt && new Date(artist.createdAt) >= startDate);

    const artistTrend: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth();
      const count = trendRecords.filter((artist) => {
        const createdAt = new Date(artist.createdAt);
        return createdAt.getFullYear() === year && createdAt.getMonth() === month;
      }).length;
      artistTrend.push({
        month: date.toLocaleString("en-US", { month: "short" }),
        count,
      });
    }

    const statusBreakdown = [
      { status: "Pending Approval", count: pendingApprovals },
      { status: "Approved", count: approvedArtists },
      { status: "Rejected", count: rejectedArtists },
    ];

    const legacyActivity = (legacyArtists as any[]).map((artist) => ({
      id: artist._id.toString(),
      title: artist.name || artist.originalName || "Artist",
      subtitle: artist.role || "Artist",
      status: "Approved",
      isVerified: true,
      timestamp: artist.createdAt,
      type: "artist",
    }));

    const registeredActivity = additionalRegistered.map((artist) => ({
      id: artist._id.toString(),
      title: artist.stageName || artist.fullName || "Artist",
      subtitle: artist.category || "Artist",
      status: artist.accountStatus,
      isVerified: artist.isVerified,
      timestamp: artist.createdAt,
      type: "artist",
    }));

    const recentActivity = [...legacyActivity, ...registeredActivity]
      .sort((a: any, b: any) =>
        new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      )
      .slice(0, 10);

    const totalMovies = await (Movie as any).countDocuments();
    const totalInquiries = await (Inquiry as any).countDocuments();
    const pendingInquiriesCount = await (Inquiry as any).countDocuments({ status: "Pending" });

    res.status(200).json({
      success: true,
      stats: {
        totalArtists,
        verifiedArtists,
        pendingApprovals,
        approvedArtists,
        rejectedArtists,
        totalUsers: 0,
        totalMovies,
        castingApplications: {
          count: 0,
          connected: false,
          message: "Casting application model not connected",
        },
        activeProjects: {
          count: 0,
          connected: false,
          message: "Project model not connected",
        },
        newInquiries: {
          count: totalInquiries,
          pendingCount: pendingInquiriesCount,
          connected: true,
          message: "Real inquiries from public contact form",
        },
      },
      analytics: {
        artistTrend,
        statusBreakdown,
      },
      recentActivity,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load dashboard statistics",
    });
  }
};



// GET ALL ARTISTS WITH SEARCH, FILTER & PAGINATION

// GET /api/admin/artists

// ============================================================



export const getAdminArtists = async (

  req: Request,

  res: Response

): Promise<void> => {

  try {

    const page = Math.max(

      1,

      parseInt(req.query.page as string, 10) || 1

    );



    const limit = Math.min(

      100,

      Math.max(

        1,

        parseInt(req.query.limit as string, 10) || 10

      )

    );



    const search = (

      (req.query.search as string) || ""

    ).trim();



    const status = (

      (req.query.status as string) || ""

    ).trim();



    const filter: Record<string, any> = {};



    const allowedStatuses = [

      "Pending Approval",

      "Approved",

      "Rejected",

    ];



    if (status && status !== "All") {

      if (!allowedStatuses.includes(status)) {

        res.status(400).json({

          success: false,

          message: "Invalid artist status filter",

        });

        return;

      }



      filter.accountStatus = status;

    }



    if (search) {

      const escapedSearch = search.replace(

        /[.*+?^${}()|[**\]\\**]/g,

        "\\$&"

      );



      const searchRegex = new RegExp(

        escapedSearch,

        "i"

      );



      filter.$or = [

        { fullName: searchRegex },

        { stageName: searchRegex },

        { email: searchRegex },

        { phone: searchRegex },

        { category: searchRegex },

        { location: searchRegex },

      ];

    }



    const [artists, total] = await Promise.all([

      Artist.find(filter)

        .select(

          "-password -resetPasswordTokenHash -resetPasswordExpiresAt"

        )

        .sort({ createdAt: -1 })

        .skip((page - 1) * limit)

        .limit(limit)

        .lean(),



      Artist.countDocuments(filter),

    ]);



    res.status(200).json({

      success: true,



      artists: artists.map((artist) => ({

        ...artist,

        id: artist._id.toString(),

      })),



      pagination: {

        total,

        page,

        limit,

        pages: Math.ceil(total / limit),

      },

    });

  } catch (error) {

    console.error("Admin artists error:", error);



    res.status(500).json({

      success: false,

      message: "Failed to fetch artists",

    });

  }

};



// ============================================================

// GET SINGLE ARTIST DETAIL

// GET /api/admin/artists/:id

// ============================================================



export const getAdminArtistDetail = async (

  req: Request,

  res: Response

): Promise<void> => {

  try {

    const { id } = req.params;



    if (!mongoose.Types.ObjectId.isValid(id)) {

      res.status(400).json({

        success: false,

        message: "Invalid artist ID",

      });

      return;

    }



    const artist = await Artist.findById(id)

      .select(

        "-password -resetPasswordTokenHash -resetPasswordExpiresAt"

      )

      .lean();



    if (!artist) {

      res.status(404).json({

        success: false,

        message: "Artist not found",

      });

      return;

    }



    res.status(200).json({

      success: true,

      artist: {

        ...artist,

        id: artist._id.toString(),

      },

    });

  } catch (error) {

    console.error("Artist detail error:", error);



    res.status(500).json({

      success: false,

      message: "Failed to fetch artist details",

    });

  }

};



// ============================================================

// UPDATE ARTIST STATUS / VERIFICATION

// PUT /api/admin/artists/:id/status

// ============================================================



export const updateAdminArtistStatus = async (

  req: Request,

  res: Response

): Promise<void> => {

  try {

    const { id } = req.params;



    const { accountStatus, isVerified } = req.body as {

      accountStatus?: string;

      isVerified?: boolean;

    };



    if (!mongoose.Types.ObjectId.isValid(id)) {

      res.status(400).json({

        success: false,

        message: "Invalid artist ID",

      });

      return;

    }



    const allowedStatuses = [

      "Pending Approval",

      "Approved",

      "Rejected",

    ];



    if (

      accountStatus !== undefined &&

      !allowedStatuses.includes(accountStatus)

    ) {

      res.status(400).json({

        success: false,

        message: "Invalid account status",

      });

      return;

    }



    if (

      isVerified !== undefined &&

      typeof isVerified !== "boolean"

    ) {

      res.status(400).json({

        success: false,

        message: "isVerified must be a boolean",

      });

      return;

    }



    const update: {

      accountStatus?: string;

      isVerified?: boolean;

    } = {};



    if (accountStatus !== undefined) {

      update.accountStatus = accountStatus;

    }



    if (isVerified !== undefined) {

      update.isVerified = isVerified;

    }



    if (Object.keys(update).length === 0) {

      res.status(400).json({

        success: false,

        message: "No valid fields provided",

      });

      return;

    }



    const artist = await Artist.findByIdAndUpdate(

      id,

      { $set: update },

      {

        new: true,

        runValidators: true,

      }

    ).select(

      "-password -resetPasswordTokenHash -resetPasswordExpiresAt"

    );



    if (!artist) {

      res.status(404).json({

        success: false,

        message: "Artist not found",

      });

      return;

    }



    res.status(200).json({

      success: true,

      message: "Artist status updated successfully",

      artist: {

        ...artist.toObject(),

        id: artist._id.toString(),

      },

    });

  } catch (error) {

    console.error("Update artist status error:", error);



    res.status(500).json({

      success: false,

      message: "Failed to update artist status",

    });

  }

};

// ============================================================
// DELETE ARTIST ACCOUNT (ADMIN ONLY)
// DELETE /api/admin/artists/:id
// ============================================================
export const deleteAdminArtist = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = (Array.isArray(rawId) ? rawId[0] : rawId) as string;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid artist ID",
      });
      return;
    }

    const artist = await ArtistModel.findByIdAndDelete(id);

    if (!artist) {
      res.status(404).json({
        success: false,
        message: "Artist account not found",
      });
      return;
    }

    try {
      await PublicArtist.deleteMany({ artistId: id });
    } catch (e) {
      // ignore optional cleanup
    }

    res.status(200).json({
      success: true,
      message: "Artist account removed successfully",
    });
  } catch (error: any) {
    console.error("Delete artist error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to remove artist account",
    });
  }
};

// ============================================================
// PUBLIC ARTIST MANAGEMENT (FOR ADD ARTIST TAB & PUBLIC DIRECTORY)
// ============================================================

export const getAdminPublicArtists = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const legacyArtists = await PublicArtist.find().sort({ createdAt: -1 }).lean();

    const formatted = legacyArtists.map((artist: any) => ({
      id: artist._id.toString(),
      legacyId: artist.legacyId || artist._id.toString(),
      fullName: artist.name || artist.originalName || "Artist",
      stageName: artist.originalName || artist.name || "Artist",
      category: artist.role || "Actor",
      secondaryCategory: artist.secondaryCategory || "",
      email: artist.email || "",
      phone: artist.phone || "",
      location: artist.birthPlace || "Rajasthan",
      experience: artist.experience || "5+ Years",
      bio: artist.bio || "",
      profilePhoto: artist.imageUrl || "/Default.jpg",
      imageUrl: artist.imageUrl || "/Default.jpg",
      showreel: artist.showreel || "",
      imdb: artist.imdb || "",
      instagram: artist.instagram || "",
      languages: artist.languages || [],
      highlights: artist.highlights || [],
      tag: artist.tag || "STAR",
      isVerified: true,
      accountStatus: "Approved",
      createdAt: artist.createdAt,
    }));

    res.status(200).json({
      success: true,
      count: formatted.length,
      artists: formatted,
    });
  } catch (error: any) {
    console.error("Get public artists error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch public artists",
    });
  }
};

export const adminCreateArtist = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      fullName,
      stageName,
      email,
      phone,
      category,
      secondaryCategory,
      experience,
      location,
      languages,
      bio,
      profilePhoto,
      showreel,
      imdb,
      instagram,
    } = req.body;

    if (!fullName || !fullName.trim()) {
      res.status(400).json({
        success: false,
        message: "Artist full name is required",
      });
      return;
    }

    const cleanName = fullName.trim();
    const cleanStageName = stageName ? stageName.trim() : cleanName;
    const slug = cleanStageName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + `-${Date.now().toString().slice(-4)}`;
    const legacyId = `pa_${Date.now()}`;

    const newPublicArtist = await PublicArtist.create({
      legacyId,
      slug,
      name: cleanName,
      originalName: cleanStageName,
      role: category || "Actor",
      secondaryCategory: secondaryCategory || "",
      email: email ? email.trim().toLowerCase() : "",
      phone: phone ? phone.trim() : "",
      experience: experience || "5+ Years",
      birthPlace: location || "Rajasthan",
      imageUrl: profilePhoto || "/Default.jpg",
      bio: bio || "",
      highlights: [category, secondaryCategory].filter(Boolean),
      showreel: showreel || "",
      imdb: imdb || "",
      instagram: instagram || "",
      languages: Array.isArray(languages) ? languages : (typeof languages === "string" ? languages.split(",").map((l: string) => l.trim()) : ["Rajasthani", "Hindi"]),
    });

    const artistData = {
      id: newPublicArtist._id.toString(),
      fullName: newPublicArtist.name,
      stageName: newPublicArtist.originalName,
      category: newPublicArtist.role,
      secondaryCategory: newPublicArtist.secondaryCategory,
      email: newPublicArtist.email,
      phone: newPublicArtist.phone,
      location: newPublicArtist.birthPlace,
      experience: newPublicArtist.experience,
      bio: newPublicArtist.bio,
      profilePhoto: newPublicArtist.imageUrl,
      imageUrl: newPublicArtist.imageUrl,
      showreel: newPublicArtist.showreel,
      imdb: newPublicArtist.imdb,
      instagram: newPublicArtist.instagram,
      languages: newPublicArtist.languages,
      isVerified: true,
      accountStatus: "Approved",
      createdAt: newPublicArtist.createdAt,
    };

    res.status(201).json({
      success: true,
      message: "Artist added successfully and published to /artists directory",
      artist: artistData,
    });
  } catch (error: any) {
    console.error("Create public artist error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to add artist",
    });
  }
};

export const adminUpdateArtist = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = (Array.isArray(rawId) ? rawId[0] : rawId) as string;

    if (!id) {
      res.status(400).json({
        success: false,
        message: "Invalid artist ID",
      });
      return;
    }

    const {
      fullName,
      stageName,
      email,
      phone,
      category,
      secondaryCategory,
      experience,
      location,
      languages,
      bio,
      profilePhoto,
      showreel,
      imdb,
      instagram,
    } = req.body;

    let publicArtist: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      publicArtist = await PublicArtist.findById(id);
    }
    if (!publicArtist) {
      publicArtist = await PublicArtist.findOne({ legacyId: id });
    }

    if (!publicArtist) {
      res.status(404).json({
        success: false,
        message: "Public artist not found",
      });
      return;
    }

    if (fullName !== undefined) publicArtist.name = fullName.trim();
    if (stageName !== undefined) publicArtist.originalName = stageName.trim();
    if (category !== undefined) publicArtist.role = category;
    if (secondaryCategory !== undefined) publicArtist.secondaryCategory = secondaryCategory;
    if (email !== undefined) publicArtist.email = email.trim().toLowerCase();
    if (phone !== undefined) publicArtist.phone = phone.trim();
    if (experience !== undefined) publicArtist.experience = experience;
    if (location !== undefined) publicArtist.birthPlace = location;
    if (bio !== undefined) publicArtist.bio = bio;
    if (profilePhoto !== undefined) publicArtist.imageUrl = profilePhoto;
    if (showreel !== undefined) publicArtist.showreel = showreel;
    if (imdb !== undefined) publicArtist.imdb = imdb;
    if (instagram !== undefined) publicArtist.instagram = instagram;
    if (languages !== undefined) {
      publicArtist.languages = Array.isArray(languages)
        ? languages
        : typeof languages === "string"
        ? languages.split(",").map((l: string) => l.trim())
        : publicArtist.languages;
    }

    await publicArtist.save();

    res.status(200).json({
      success: true,
      message: "Artist details updated successfully",
      artist: {
        id: publicArtist._id.toString(),
        fullName: publicArtist.name,
        stageName: publicArtist.originalName,
        category: publicArtist.role,
        secondaryCategory: publicArtist.secondaryCategory,
        email: publicArtist.email,
        phone: publicArtist.phone,
        location: publicArtist.birthPlace,
        experience: publicArtist.experience,
        bio: publicArtist.bio,
        profilePhoto: publicArtist.imageUrl,
        imageUrl: publicArtist.imageUrl,
        showreel: publicArtist.showreel,
        imdb: publicArtist.imdb,
        instagram: publicArtist.instagram,
        languages: publicArtist.languages,
        isVerified: true,
        accountStatus: "Approved",
        createdAt: publicArtist.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Update artist error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to update artist details",
    });
  }
};

export const adminDeletePublicArtist = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = (Array.isArray(rawId) ? rawId[0] : rawId) as string;

    if (!id) {
      res.status(400).json({
        success: false,
        message: "Invalid artist ID",
      });
      return;
    }

    let deleted: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      deleted = await PublicArtist.findByIdAndDelete(id);
    }
    if (!deleted) {
      deleted = await PublicArtist.findOneAndDelete({ legacyId: id });
    }

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: "Public artist not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Public artist deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete public artist error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to delete public artist",
    });
  }
};