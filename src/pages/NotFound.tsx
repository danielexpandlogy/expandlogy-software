import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => (
  <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
    <p className="text-sm font-medium text-primary">404</p>
    <h2 className="text-2xl font-semibold tracking-tight">Página no encontrada</h2>
    <p className="text-muted-foreground">La página que buscas no existe o fue movida.</p>
    <Button asChild variant="outline">
      <Link to="/">Volver al inicio</Link>
    </Button>
  </div>
);

export default NotFound;
