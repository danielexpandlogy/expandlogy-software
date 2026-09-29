import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommentItem } from "./CommentItem";

const author = { id: "u1", full_name: "Ana Torres", email: "ana@x.com", role: "user" as const };

describe("CommentItem", () => {
  it("no ofrece ninguna forma de responder un comentario", () => {
    render(<CommentItem author={author} body="Hola" createdAt={new Date().toISOString()} canEdit canDelete />);
    expect(screen.queryByRole("button", { name: /responder|reply/i })).toBeNull();
    expect(screen.queryByText(/responder/i)).toBeNull();
  });

  it("muestra 'Usuario eliminado' si el autor ya no existe", () => {
    render(<CommentItem author={null} deletedAuthor body="Viejo" createdAt={new Date().toISOString()} />);
    expect(screen.getByText("Usuario eliminado")).toBeInTheDocument();
  });

  it("marca los comentarios editados y respeta los saltos de línea como texto", () => {
    const { container } = render(
      <CommentItem author={author} body={"línea 1\n<b>línea 2</b>"} createdAt={new Date().toISOString()} edited />,
    );
    expect(screen.getByText("(editado)")).toBeInTheDocument();
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<b>línea 2</b>");
  });
});
