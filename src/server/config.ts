import { adminPasscode } from "./admin-auth";
import { readAdminSettings } from "./admin-settings";
export function configuration() {
  return {
    adminConfigured: Boolean(adminPasscode()),
    localPreview:
      process.env.LOCAL_PREVIEW === "1" &&
      !process.env.ADMIN_PASSCODE &&
      !readAdminSettings(),
    mediaStorage:
      process.env.MEDIA_STORAGE === "cloudinary" ? "cloudinary" : "local",
  };
}
