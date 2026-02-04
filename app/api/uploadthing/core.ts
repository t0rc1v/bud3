import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { auth } from "@clerk/nextjs/server";

const f = createUploadthing();

// Authentication helper
const authenticateUser = async () => {
  const { userId } = await auth();
  if (!userId) throw new UploadThingError("Unauthorized");
  return { userId };
};

// FileRouter with 4 resource type routes
export const ourFileRouter = {
  // Notes/PDF files
  notesUploader: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 1 },
    text: { maxFileSize: "4MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const { userId } = await authenticateUser();
      return { userId, type: "notes" as const };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Notes upload complete for userId:", metadata.userId);
      console.log("File URL:", file.ufsUrl);
      return {
        uploadedBy: metadata.userId,
        type: metadata.type,
        fileUrl: file.ufsUrl,
        fileKey: file.key,
      };
    }),

  // Video files
  videoUploader: f({
    video: { maxFileSize: "128MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const { userId } = await authenticateUser();
      return { userId, type: "video" as const };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Video upload complete for userId:", metadata.userId);
      console.log("File URL:", file.ufsUrl);
      return {
        uploadedBy: metadata.userId,
        type: metadata.type,
        fileUrl: file.ufsUrl,
        fileKey: file.key,
      };
    }),

  // Audio files
  audioUploader: f({
    audio: { maxFileSize: "64MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const { userId } = await authenticateUser();
      return { userId, type: "audio" as const };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Audio upload complete for userId:", metadata.userId);
      console.log("File URL:", file.ufsUrl);
      return {
        uploadedBy: metadata.userId,
        type: metadata.type,
        fileUrl: file.ufsUrl,
        fileKey: file.key,
      };
    }),

  // Image files
  imageUploader: f({
    image: { maxFileSize: "16MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const { userId } = await authenticateUser();
      return { userId, type: "image" as const };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Image upload complete for userId:", metadata.userId);
      console.log("File URL:", file.ufsUrl);
      return {
        uploadedBy: metadata.userId,
        type: metadata.type,
        fileUrl: file.ufsUrl,
        fileKey: file.key,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
