import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { auth } from "./auth"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"

const http = httpRouter()

// CORS headers for cross-origin requests (frontend on localhost, API on convex.site)
const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.SITE_URL ?? "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
}

// Add Convex Auth routes
auth.addHttpRoutes(http)

// Secure file serving endpoint
// Authenticates every request and logs access for audit compliance
// Note: Convex HTTP router uses pathPrefix for dynamic segments, not path parameters
http.route({
  pathPrefix: "/api/files/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url)
    const pathParts = url.pathname.split("/")
    const documentId = pathParts[pathParts.length - 1] as Id<"documents">

    // Get user agent for audit logging
    const userAgent = request.headers.get("user-agent") ?? undefined

    // Check authentication via JWT in Authorization header
    const identity = await ctx.auth.getUserIdentity()

    if (!identity) {
      // Log failed access attempt
      await ctx.runMutation(internal.fileAccess.logAccess, {
        documentId,
        action: "view",
        success: false,
        errorReason: "Not authenticated",
        userAgent,
      })

      return new Response("Unauthorized", {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain",
          "WWW-Authenticate": "Bearer",
        },
      })
    }

    // Extract user ID from identity subject
    const userId = identity.subject.split("|")[0]

    // Fetch document and verify ownership
    const document = await ctx.runQuery(internal.fileAccess.getDocumentForAccess, {
      documentId,
      userId,
    })

    if (!document) {
      // Log forbidden access attempt
      await ctx.runMutation(internal.fileAccess.logAccess, {
        documentId,
        action: "view",
        success: false,
        errorReason: "Document not found or access denied",
        userAgent,
        userId,
      })

      return new Response("Forbidden", {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      })
    }

    // Fetch the file blob from storage
    const blob = await ctx.storage.get(document.storageId)

    if (!blob) {
      await ctx.runMutation(internal.fileAccess.logAccess, {
        documentId,
        action: "view",
        success: false,
        errorReason: "File not found in storage",
        userAgent,
        userId,
      })

      return new Response("File not found", {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      })
    }

    // Log successful access
    await ctx.runMutation(internal.fileAccess.logAccess, {
      documentId,
      action: "view",
      success: true,
      userAgent,
      userId,
    })

    // Return file with security headers
    return new Response(blob, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": document.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(document.originalFilename)}"`,
        "Content-Length": document.sizeBytes.toString(),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store, max-age=0",
        // Prevent clickjacking
        "X-Frame-Options": "SAMEORIGIN",
      },
    })
  }),
})

// CORS preflight for secure file endpoint
http.route({
  pathPrefix: "/api/files/",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        "Access-Control-Max-Age": "86400",
      },
    })
  }),
})

export default http
