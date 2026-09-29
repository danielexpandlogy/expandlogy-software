export const todoKeys = {
  boards: ["todo", "boards"] as const,
  board: (boardId: string) => ["todo", "board", boardId] as const,
  comments: (taskId: string) => ["todo", "comments", taskId] as const,
  signedUrls: (paths: string[]) => ["todo", "signed-urls", ...paths] as const,
};
