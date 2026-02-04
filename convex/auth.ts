import GitHub from "@auth/core/providers/github"
import { convexAuth } from "@convex-dev/auth/server"
import { Id } from "./_generated/dataModel"

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    GitHub({
      profile(githubProfile) {
        return {
          id: githubProfile.id.toString(),
          name: githubProfile.name ?? githubProfile.login,
          email: githubProfile.email,
          image: githubProfile.avatar_url,
          githubId: githubProfile.id.toString(),
        }
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      // If this is an existing user returning, allow them if they're the owner
      if (args.existingUserId) {
        const existingUser = await ctx.db.get(args.existingUserId)
        if (existingUser?.isOwner) {
          return args.existingUserId
        }
        // Non-owner existing user - reject
        throw new Error("Access denied. This HSA Tracker is private and already has an owner.")
      }

      // Check if any owner already exists
      const existingOwner = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("isOwner"), true))
        .first()

      if (existingOwner) {
        // Owner already exists, reject new registration
        throw new Error("Access denied. This HSA Tracker is private and already has an owner.")
      }

      // First user becomes the owner
      // Convert null values to undefined (GitHub returns null for private emails)
      const userId = await ctx.db.insert("users", {
        name: args.profile.name ?? undefined,
        email: args.profile.email ?? undefined,
        image: args.profile.image ?? undefined,
        githubId: (args.profile as { githubId?: string }).githubId,
        isOwner: true,
      })

      // Migrate existing data to the new owner
      // We need to cast to string since Convex Auth callbacks use string IDs
      const userIdStr = userId as unknown as string

      // Migrate expenses
      const expenses = await ctx.db.query("expenses").collect()
      for (const expense of expenses) {
        await ctx.db.patch(expense._id as Id<"expenses">, { userId: userIdStr })
      }

      // Migrate documents
      const documents = await ctx.db.query("documents").collect()
      for (const document of documents) {
        await ctx.db.patch(document._id as Id<"documents">, { userId: userIdStr })
      }

      // Migrate reimbursements
      const reimbursements = await ctx.db.query("reimbursements").collect()
      for (const reimbursement of reimbursements) {
        await ctx.db.patch(reimbursement._id as Id<"reimbursements">, { userId: userIdStr })
      }

      return userId
    },
  },
})
