import { EduardoPreview } from "@/features/landing-eduardo/EduardoPreview";
import type { RenderPreview } from "./admin/VariantsGallery";

/**
 * Landings cuyo código vive en esta app: el panel dibuja sus variantes con sus
 * propios componentes. Las demás (repos y dominios propios) se ven en un iframe
 * de la landing publicada.
 */
export const IN_APP_PREVIEWS: Record<string, RenderPreview> = {
  eduardo: (variable, option) => <EduardoPreview variableKey={variable.key} value={option.value} />,
};
