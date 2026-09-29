import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { RequireAdmin, RequireAuth } from "@/components/auth/RequireAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { FullScreenSpinner } from "@/components/FullScreenSpinner";
import { ProfileLayout } from "@/pages/profile/ProfileLayout";

import Login from "./pages/Login.tsx";

const Home = lazy(() => import("./pages/Home.tsx"));
const BoardsIndex = lazy(() => import("./features/todo/pages/BoardsIndex.tsx"));
const BoardPage = lazy(() => import("./features/todo/pages/BoardPage.tsx"));
const MyProfile = lazy(() => import("./pages/profile/MyProfile.tsx"));
const Users = lazy(() => import("./pages/profile/Users.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<FullScreenSpinner />}>
            <Routes>
              <Route path="/login" element={<Login />} />

              {/* Todo lo demás, incluida la 404, exige sesión. */}
              <Route element={<RequireAuth />}>
                <Route element={<AppLayout />}>
                  <Route index element={<Home />} />
                  <Route path="todos" element={<BoardsIndex />} />
                  {/* /todos/:boardId/t/:taskId abre el detalle sobre el tablero. */}
                  <Route path="todos/:boardId/*" element={<BoardPage />} />
                  <Route path="perfil" element={<ProfileLayout />}>
                    <Route index element={<MyProfile />} />
                    <Route element={<RequireAdmin />}>
                      <Route path="usuarios" element={<Users />} />
                    </Route>
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
