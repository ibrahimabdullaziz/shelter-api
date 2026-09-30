import type { UploadApiErrorResponse, UploadApiResponse } from "cloudinary";
import ApiError from "../../common/utils/ApiError";
import { unitPhotoServiceDependencies } from "./dependencies/photos.dependencies";
export { unitPhotoServiceDependencies } from "./dependencies/photos.dependencies";

function uploadBuffer(buffer: Buffer) {
  return new Promise<{ secure_url: string; public_id: string }>(
    (resolve, reject) => {
      const stream =
        unitPhotoServiceDependencies.cloudinary.uploader.upload_stream(
          {
            folder: "shelter/units",
            resource_type: "image",
            use_filename: false,
            unique_filename: true,
            overwrite: false,
          },
          (
            error: UploadApiErrorResponse | undefined,
            result: UploadApiResponse | undefined,
          ) => {
            if (error) {
              return reject(new Error(`Cloudinary upload failed: ${error.message}`));
            }
            if (!result) {
              return reject(new Error("Cloudinary upload returned no result"));
            }
            resolve({
              secure_url: result.secure_url,
              public_id: result.public_id,
            });
          },
        );
      stream.end(buffer);
    },
  );
}

export async function uploadUnitPhotoService(
  unitId: string,
  ownerId: string,
  fileBuffer: Buffer,
) {
  const unit = await unitPhotoServiceDependencies.prisma.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    throw new ApiError(404, "This unit is not found");
  }

  if (unit.deletedAt) {
    throw new ApiError(404, "This unit is not found");
  }

  if (unit.ownerId !== ownerId) {
    throw new ApiError(403, "Not your unit");
  }

  const data = await uploadBuffer(fileBuffer);
  const url = data.secure_url;
  const publicId = data.public_id;

  try {
    return await unitPhotoServiceDependencies.prisma.unitPhoto.create({
      data: { url, publicId, unitId },
    });
  } catch (err) {
    await unitPhotoServiceDependencies.cloudinary.uploader.destroy(publicId);
    throw err;
  }
}

export async function deleteUnitPhotoService(photoId: string, ownerId: string) {
  const photo = await unitPhotoServiceDependencies.prisma.unitPhoto.findUnique({
    where: { id: photoId },
    include: { unit: true },
  });

  if (!photo) {
    throw new ApiError(404, "This photo is not found");
  }

  if (photo.unit.ownerId !== ownerId) {
    throw new ApiError(403, "Not your unit");
  }

  await unitPhotoServiceDependencies.cloudinary.uploader.destroy(
    photo.publicId,
  );
  await unitPhotoServiceDependencies.prisma.unitPhoto.delete({
    where: { id: photo.id },
  });
}

export const unitPhotoServices = {
  uploadUnitPhotoService,
  deleteUnitPhotoService,
};
