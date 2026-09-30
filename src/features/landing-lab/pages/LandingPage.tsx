import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { LabDashboard } from "../admin/LabDashboard";
import { IN_APP_PREVIEWS } from "../previews";

const LandingPage = () => {
  const { slug = "" } = useParams();
  return (
    <div className="space-y-4">
      <Link to="/landings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Landings
      </Link>
      {/* key: al cambiar de landing se reinicia todo el estado del panel. */}
      <LabDashboard key={slug} landing={slug} renderPreview={IN_APP_PREVIEWS[slug]} />
    </div>
  );
};

export default LandingPage;
