import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import axios from 'axios';

dotenv.config();

const STORAGE_ZONE = 'editcraft';
const STORAGE_URL = 'https://storage.bunnycdn.com';

/**
 * Upload file to BunnyCDN
 * @param {string} directoryPath - folder in storage zone
 * @param {object} file - file object (from multer)
 * @returns {object} - { success, url?, status?, error? }
 */
export const uploadFile = async (directoryPath, file) => {
  try {
    if (!file) return { success: false, error: "No file provided" };

    const fileStream = fs.createReadStream(file.path);
    const fileExt = path.extname(file.originalname).slice(1);
    const fileName = encodeURIComponent(`${file.filename}.${fileExt}`);
    const folderPath = encodeURIComponent(directoryPath);

    const uri = `${STORAGE_URL}/${STORAGE_ZONE}/${folderPath}/${fileName}`;
    const contentType = mime.lookup(fileExt) || "application/octet-stream";

    const resp = await axios.put(uri, fileStream, {
      headers: {
        AccessKey: process.env.BUNNY_ACCESS_KEY,
        "Content-Type": contentType,
      },
      maxBodyLength: Infinity, // Important for big files
    });

    // Optional: remove local file after upload
    fs.unlink(file.path, err => {
      if (err) console.error("Error deleting local file:", err.message);
    });

    return {
      success: true,
      status: resp.status,
      url: uri
    };
  } catch (error) {
    console.error("Error uploading file:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Delete file from BunnyCDN
 * @param {string} directoryPath - folder in storage zone
 * @param {string} fileName - filename with extension
 * @returns {object} - { success, status?, error? }
 */
export const deleteFile = async (directoryPath, fileName) => {
  try {
    const folderPath = encodeURIComponent(directoryPath);
    const encodedFileName = encodeURIComponent(fileName);
    const uri = `${STORAGE_URL}/${STORAGE_ZONE}/${folderPath}/${encodedFileName}`;

    const resp = await axios.delete(uri, {
      headers: {
        AccessKey: process.env.BUNNY_ACCESS_KEY
      }
    });

    return {
      success: resp.status === 200 || resp.status === 204,
      status: resp.status
    };
  } catch (error) {
    console.error("Error deleting file:", error.message);
    return { success: false, error: error.message };
  }
};
