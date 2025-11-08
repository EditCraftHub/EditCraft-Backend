import multer from "multer";

// Memory storage
const storage = multer.memoryStorage();

// File filter: allow images and all video types
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype.startsWith("video/")
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only images and videos are allowed"), false);
  }
};

// Limits: max file size per file
const limits = {
  fileSize: 200 * 1024 * 1024, // 200MB
};

// Multer upload instance
const upload = multer({ storage, fileFilter, limits });

// ✅ Export different upload configurations
export const uploadSingle = upload.single('file'); // For single file
export const uploadMultiple = upload.array('files', 10); // For multiple files
export const uploadProfileFields = upload.fields([
  { name: 'profilePic', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
]); // For profile updates
export const uploadAny = upload.any(); // For any files

export default upload;