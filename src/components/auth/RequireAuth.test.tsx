import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const auth = vi.hoisted(() => ({ value: { session: null as unknown, loading: false, isAdmin: false } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.value }));

import { RequireAdmin, RequireAuth } from "./RequireAuth";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>login</p>} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<p>home</p>} />
          <Route element={<RequireAdmin />}>
            <Route path="/perfil/usuarios" element={<p>usuarios</p>} />
          </Route>
          <Route path="*" element={<p>404</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe("RequireAuth", () => {
  it("sin sesión, cualquier ruta (incluso inexistente) redirige a /login", () => {
    auth.value = { session: null, loading: false, isAdmin: false };
    for (const path of ["/", "/perfil/usuarios", "/no-existe"]) {
      const { unmount } = renderAt(path);
      expect(screen.getByText("login")).toBeInTheDocument();
      unmount();
    }
  });

  it("mientras carga la sesión no muestra contenido protegido", () => {
    auth.value = { session: null, loading: true, isAdmin: false };
    renderAt("/");
    expect(screen.queryByText("home")).not.toBeInTheDocument();
    expect(screen.queryByText("login")).not.toBeInTheDocument();
  });

  it("con sesión muestra la ruta", () => {
    auth.value = { session: {}, loading: false, isAdmin: false };
    renderAt("/");
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("un usuario no admin no entra a la gestión de usuarios", () => {
    auth.value = { session: {}, loading: false, isAdmin: false };
    renderAt("/perfil/usuarios");
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("un admin sí entra a la gestión de usuarios", () => {
    auth.value = { session: {}, loading: false, isAdmin: true };
    renderAt("/perfil/usuarios");
    expect(screen.getByText("usuarios")).toBeInTheDocument();
  });
});
