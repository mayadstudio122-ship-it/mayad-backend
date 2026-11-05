import { Request, Response } from "express";
import mongoose from "mongoose";
import TalentApplication from "../models/TalentApplication";
import cloudinary from "../utils/cloudinary";

// Helper to upload buffer to Cloudinary with fallback
const uploadToCloudinary = async (
  fileBuffer: Buffer,
  folder: string,
  resourceType: "image" | "raw" | "video" = "image"
): Promise<string> => {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || "").trim().replace(/^["']|["']$/g, "");
  const apiKey = (process.env.CLOUDINARY_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || "").trim().replace(/^["']|["']$/g, "");

  if (cloudName && apiKey && apiSecret) {
    try {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });

      const uploadResult: any = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `mayad/talent/${folder}`,
            resource_type: resourceType,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(fileBuffer);
      });

      if (uploadResult && uploadResult.secure_url) {
        return uploadResult.secure_url;
      }
    } catch (err: any) {
      console.warn("Cloudinary upload failed, using Data URL fallback:", err?.message || err);
    }
  }

  // Fallback to Data URL
  const mime = resourceType === "raw" ? "application/pdf" : "image/jpeg";
  const base64 = fileBuffer.toString("base64");
  return `data:${mime};base64,${base64}`;
};

// ============================================================
// 1. PUBLIC SUBMIT TALENT APPLICATION
// POST /api/talent/register
// ============================================================
export const submitTalentApplication = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      fullName,
      age,
      gender,
      profilePhoto,
      email,
      preferredLanguage,
      experienceLevel,
      interestedRoles,
      yearsOfExperience,
      previousProjects,
      projectVideoUrls,
      introductoryVideoUrl,
      aboutYourself,
      synopsisPdfUrl,
      whatsAppNumber,
      callingNumber,
      fullAddress,
      city,
      state,
      country,
      socialLink1,
      socialLink2,
    } = req.body;

    // Required fields check
    if (!fullName || !fullName.trim()) {
      res.status(400).json({ success: false, message: "Full Name is required" });
      return;
    }

    const numericAge = parseInt(age, 10);
    if (isNaN(numericAge) || numericAge < 1) {
      res.status(400).json({ success: false, message: "Valid age is required" });
      return;
    }

    if (!email || !email.trim()) {
      res.status(400).json({ success: false, message: "Email address is required" });
      return;
    }

    if (!whatsAppNumber || !whatsAppNumber.trim()) {
      res.status(400).json({ success: false, message: "WhatsApp number is required" });
      return;
    }

    if (!callingNumber || !callingNumber.trim()) {
      res.status(400).json({ success: false, message: "Calling number is required" });
      return;
    }

    if (!fullAddress || !fullAddress.trim() || !city || !city.trim() || !state || !state.trim()) {
      res.status(400).json({ success: false, message: "Complete address (address, city, state) is required" });
      return;
    }

    let rolesArray: string[] = [];
    if (Array.isArray(interestedRoles)) {
      rolesArray = interestedRoles.map((r: string) => r.trim()).filter(Boolean);
    } else if (typeof interestedRoles === "string") {
      rolesArray = interestedRoles.split(",").map((r: string) => r.trim()).filter(Boolean);
    }

    if (rolesArray.length === 0) {
      res.status(400).json({ success: false, message: "Select at least one interested role" });
      return;
    }

    let photoUrl = profilePhoto || "";
    let pdfUrl = synopsisPdfUrl || "";

    // Handle files attached via multer if present
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files) {
      if (files["profilePhoto"] && files["profilePhoto"][0]) {
        photoUrl = await uploadToCloudinary(files["profilePhoto"][0].buffer, "photos", "image");
      }
      if (files["synopsisPdf"] && files["synopsisPdf"][0]) {
        pdfUrl = await uploadToCloudinary(files["synopsisPdf"][0].buffer, "synopsis", "raw");
      }
    }

    if (!photoUrl) {
      res.status(400).json({ success: false, message: "Profile photo is required" });
      return;
    }

    // Process project video URLs
    let videoUrls: string[] = [];
    if (Array.isArray(projectVideoUrls)) {
      videoUrls = projectVideoUrls.map((u: string) => u.trim()).filter(Boolean);
    } else if (typeof projectVideoUrls === "string" && projectVideoUrls.trim()) {
      videoUrls = projectVideoUrls.split(",").map((u: string) => u.trim()).filter(Boolean);
    }

    const application = await TalentApplication.create({
      fullName: fullName.trim(),
      age: numericAge,
      gender: gender ? gender.trim() : "Prefer not to say",
      profilePhoto: photoUrl,
      email: email.trim().toLowerCase(),
      preferredLanguage: preferredLanguage || "Both",
      experienceLevel: experienceLevel || "Newcomer",
      interestedRoles: rolesArray,
      yearsOfExperience: yearsOfExperience ? yearsOfExperience.trim() : "0",
      previousProjects: previousProjects ? previousProjects.trim() : "",
      projectVideoUrls: videoUrls,
      introductoryVideoUrl: introductoryVideoUrl ? introductoryVideoUrl.trim() : "",
      aboutYourself: aboutYourself ? aboutYourself.trim() : "",
      synopsisPdfUrl: pdfUrl,
      whatsAppNumber: whatsAppNumber.trim(),
      callingNumber: callingNumber.trim(),
      fullAddress: fullAddress.trim(),
      city: city.trim(),
      state: state.trim(),
      country: (country && country.trim()) ? country.trim() : "India",
      socialLink1: socialLink1 ? socialLink1.trim() : "",
      socialLink2: socialLink2 ? socialLink2.trim() : "",
      status: "Pending",
    });

    res.status(201).json({
      success: true,
      message: "Your MAYAD talent registration application has been submitted successfully!",
      application,
    });
  } catch (error: any) {
    console.error("Submit Talent Application Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to submit registration application",
    });
  }
};

// ============================================================
// 2. ADMIN GET ALL TALENT APPLICATIONS
// GET /api/admin/talent-applications
// ============================================================
export const adminGetTalentApplications = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(10000, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const search = ((req.query.search as string) || "").trim();
    const roleFilter = ((req.query.role as string) || "").trim();
    const expFilter = ((req.query.experienceLevel as string) || "").trim();
    const statusFilter = ((req.query.status as string) || "").trim();

    const query: Record<string, any> = {};

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      query.$or = [
        { fullName: regex },
        { email: regex },
        { city: regex },
        { state: regex },
        { whatsAppNumber: regex },
        { callingNumber: regex },
      ];
    }

    if (roleFilter && roleFilter !== "All") {
      query.interestedRoles = roleFilter;
    }

    if (expFilter && expFilter !== "All") {
      query.experienceLevel = expFilter;
    }

    if (statusFilter && statusFilter !== "All") {
      query.status = statusFilter;
    }

    const [applications, total, totalAll, pendingCount, underReviewCount, shortlistedCount, approvedCount, rejectedCount] = await Promise.all([
      TalentApplication.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      TalentApplication.countDocuments(query),
      TalentApplication.countDocuments(),
      TalentApplication.countDocuments({ status: "Pending" }),
      TalentApplication.countDocuments({ status: "Under Review" }),
      TalentApplication.countDocuments({ status: "Shortlisted" }),
      TalentApplication.countDocuments({ status: "Approved" }),
      TalentApplication.countDocuments({ status: "Rejected" }),
    ]);

    const formatted = applications.map((app: any) => ({
      ...app,
      id: app._id.toString(),
    }));

    res.status(200).json({
      success: true,
      count: formatted.length,
      applications: formatted,
      stats: {
        total: totalAll,
        pending: pendingCount,
        underReview: underReviewCount,
        shortlisted: shortlistedCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: any) {
    console.error("Admin Get Talent Applications Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch talent applications",
    });
  }
};

// ============================================================
// 3. ADMIN GET SINGLE TALENT APPLICATION DETAIL
// GET /api/admin/talent-applications/:id
// ============================================================
export const adminGetTalentApplicationDetail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = (Array.isArray(rawId) ? rawId[0] : rawId) as string;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid application ID" });
      return;
    }

    const application = await TalentApplication.findById(id);
    if (!application) {
      res.status(404).json({ success: false, message: "Talent application not found" });
      return;
    }

    res.status(200).json({
      success: true,
      application: {
        ...application.toObject(),
        id: application._id.toString(),
      },
    });
  } catch (error: any) {
    console.error("Admin Get Talent Application Detail Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch application details",
    });
  }
};

// ============================================================
// 4. ADMIN UPDATE TALENT APPLICATION STATUS
// PUT /api/admin/talent-applications/:id/status
// ============================================================
export const adminUpdateTalentApplicationStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = (Array.isArray(rawId) ? rawId[0] : rawId) as string;
    const { status } = req.body;

    const allowedStatuses = ["Pending", "Under Review", "Shortlisted", "Approved", "Rejected"];
    if (!status || !allowedStatuses.includes(status)) {
      res.status(400).json({ success: false, message: "Invalid status value" });
      return;
    }

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid application ID" });
      return;
    }

    const application = await TalentApplication.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!application) {
      res.status(404).json({ success: false, message: "Talent application not found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Application status updated to ${status}`,
      application: {
        ...application.toObject(),
        id: application._id.toString(),
      },
    });
  } catch (error: any) {
    console.error("Admin Update Talent Application Status Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to update application status",
    });
  }
};

// ============================================================
// 5. ADMIN DELETE TALENT APPLICATION
// DELETE /api/admin/talent-applications/:id
// ============================================================
export const adminDeleteTalentApplication = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = (Array.isArray(rawId) ? rawId[0] : rawId) as string;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid application ID" });
      return;
    }

    const deleted = await TalentApplication.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ success: false, message: "Talent application not found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Talent application deleted successfully",
    });
  } catch (error: any) {
    console.error("Admin Delete Talent Application Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to delete application",
    });
  }
};
