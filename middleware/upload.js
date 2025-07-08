const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, uniqueSuffix + extension);
  }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file ảnh (JPEG, PNG, GIF, WebP)'), false);
  }
};

// Configure upload middleware
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5 // Maximum 5 files per upload
  }
});

// Multiple files upload middleware
const uploadMultiple = upload.array('images', 5); // max 5 images

// Error handling middleware
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      req.uploadError = 'File quá lớn. Kích thước tối đa là 5MB.';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      req.uploadError = 'Quá nhiều file. Tối đa 5 file.';
    } else {
      req.uploadError = 'Lỗi upload file: ' + err.message;
    }
  } else if (err) {
    req.uploadError = err.message;
  }
  next();
};

module.exports = {
  uploadMultiple,
  handleUploadErrors
}; 