import { test as base } from "@playwright/test";
import { createIdentity, deleteIdentity, type Identity } from "./identities";

interface Team {
  admin: Identity;
  member: Identity;
  outsider: Identity;
}

/** Identidades nuevas por archivo de test (worker), borradas al terminar. */
export const test = base.extend<object, { team: Team }>({
  team: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const team = {
        admin: await createIdentity("admin", "admin"),
        member: await createIdentity("member", "user"),
        outsider: await createIdentity("outsider", "user"),
      };
      await use(team);
      for (const who of Object.values(team)) await deleteIdentity(who);
    },
    { scope: "worker" },
  ],
});

export { expect } from "@playwright/test";
