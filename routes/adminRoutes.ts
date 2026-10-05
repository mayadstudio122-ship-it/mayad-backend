
import { Router } from "express";

import {
  adminLogin,
  getAdminProfile,
  updateAdminProfile,
  updateAdminPassword,
  adminLogout,
  getAdminStats,
  getAdminArtists,
  getAdminArtistDetail,
  updateAdminArtistStatus,
  deleteAdminArtist,
  adminCreateArtist,
  adminUpdateArtist,
  getAdminPublicArtists,
  adminDeletePublicArtist,
} from "../controllers/adminController";

import { adminAuth } from "../middleware/adminAuthMiddleware";
import {
  adminGetInquiries,
  adminUpdateInquiryStatus,
  adminDeleteInquiry,
} from "../controllers/inquiryController";
import {
  adminGetTalentApplications,
  adminGetTalentApplicationDetail,
  adminUpdateTalentApplicationStatus,
  adminDeleteTalentApplication,
} from "../controllers/talentController";

const router = Router();

// ============================================================
// CEO AUTHENTICATION & PROFILE
// ============================================================

// CEO login
router.post("/login", adminLogin);

// Protected CEO profile
router.get("/me", adminAuth, getAdminProfile);
router.put("/profile", adminAuth, updateAdminProfile);
router.put("/change-password", adminAuth, updateAdminPassword);

// CEO logout
router.post("/logout", adminLogout);

// ============================================================
// PROTECTED ADMIN DASHBOARD
// ============================================================

// Dashboard stats, analytics and recent activity
router.get("/stats", adminAuth, getAdminStats);

// ============================================================
// PUBLIC ARTIST MANAGEMENT (FOR ADD ARTIST TAB)
// ============================================================
router.get("/public-artists", adminAuth, getAdminPublicArtists);
router.post("/public-artists", adminAuth, adminCreateArtist);
router.put("/public-artists/:id", adminAuth, adminUpdateArtist);
router.delete("/public-artists/:id", adminAuth, adminDeletePublicArtist);

// ============================================================
// REGISTERED ARTIST ACCOUNTS MANAGEMENT (FOR ARTIST ACCOUNTS TAB)
// ============================================================

// Create artist directly by admin
router.post("/artists", adminAuth, adminCreateArtist);

// Update artist details by admin
router.put("/artists/:id", adminAuth, adminUpdateArtist);

// Get artists with pagination, search and status filter
router.get("/artists", adminAuth, getAdminArtists);

// Get a single artist
router.get("/artists/:id", adminAuth, getAdminArtistDetail);

// Approve, reject or verify an artist
router.put(
  "/artists/:id/status",
  adminAuth,
  updateAdminArtistStatus
);

// Delete an artist account
router.delete(
  "/artists/:id",
  adminAuth,
  deleteAdminArtist
);

// ============================================================
// INQUIRIES & CONTACT MANAGEMENT
// ============================================================
router.get("/inquiries", adminAuth, adminGetInquiries);
router.patch("/inquiries/:id/status", adminAuth, adminUpdateInquiryStatus);
router.delete("/inquiries/:id", adminAuth, adminDeleteInquiry);

// ============================================================
// TALENT APPLICATIONS / REGISTRATIONS MANAGEMENT
// ============================================================
router.get("/talent-applications", adminAuth, adminGetTalentApplications);
router.get("/talent-applications/:id", adminAuth, adminGetTalentApplicationDetail);
router.put("/talent-applications/:id/status", adminAuth, adminUpdateTalentApplicationStatus);
router.delete("/talent-applications/:id", adminAuth, adminDeleteTalentApplication);

export default router;
