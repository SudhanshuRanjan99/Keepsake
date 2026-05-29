import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { deleteKeepsakeContentForAuthUser } from "@/lib/account-deletion";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined.");
}

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },

  user: {
    deleteUser: {
      enabled: true,

      beforeDelete: async (user) => {
        await deleteKeepsakeContentForAuthUser(user.id);
      },
    },
  },
});