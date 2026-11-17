import { setupConvexAuth } from "@convex-dev/auth/server"
import { setupGithub } from "@convex-dev/auth/methods/github/server"
import { components, internal } from "./_generated/api"
import { parseAuthRedirectOrigins } from "./lib/authRedirectOrigins"

const auth = setupConvexAuth({ component: components.auth })
export const { signOut, refreshSession, isAuthenticated } = auth

export const { startSignInWithGithub, completeSignInWithGithub } = setupGithub(auth, {
  component: components.authGithub,
  allowedRedirectOrigins: parseAuthRedirectOrigins(process.env.AUTH_ALLOWED_REDIRECT_ORIGINS),
}).attachUserCallbacks({
  createUser: internal.githubOwner.createUser,
  onSignIn: internal.githubOwner.onSignIn,
})
