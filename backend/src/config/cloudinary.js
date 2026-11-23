const { v2: cloudinary } = require("cloudinary");

function configureCloudinary(env = process.env) {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    env;
  if (!CLOUDINARY_CLOUD_NAME) {
    throw new Error("CLOUDINARY_CLOUD_NAME must be configured.");
  }
  if (!CLOUDINARY_API_KEY) {
    throw new Error("CLOUDINARY_API_KEY must be configured.");
  }
  if (!CLOUDINARY_API_SECRET) {
    throw new Error("CLOUDINARY_API_SECRET must be configured.");
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

function uploadImage(buffer) {
  configureCloudinary();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "shrithi-couture/products",
        resource_type: "image",
        allowed_formats: ["jpg", "png", "webp"],
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      },
    );
    stream.on("error", reject);
    stream.end(buffer);
  });
}

module.exports = { configureCloudinary, uploadImage };
