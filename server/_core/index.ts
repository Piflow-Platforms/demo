import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";
import * as db from "../db";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ENV } from "./env";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Dev-only login bypass (no OAuth server needed)
  if (process.env.NODE_ENV === "development") {
    app.get("/api/dev-login", (req, res) => {
      const openId = ENV.ownerOpenId || "dev-owner";
      const name = "Dev Admin";
      const finish = async () => {
        try {
          await db.upsertUser({ openId, name, email: "dev@local", loginMethod: "dev", lastSignedIn: new Date(), role: "admin" });
        } catch {
          // DB not available — session will still work with JWT-only fallback
        }
        const token = await sdk.createSessionToken(openId, { name, expiresInMs: ONE_YEAR_MS });
        res.cookie(COOKIE_NAME, token, { httpOnly: true, path: "/", sameSite: "lax", secure: false, maxAge: ONE_YEAR_MS });
        res.redirect(302, "/");
      };
      finish().catch(err => { console.error("[dev-login] error:", err); res.status(500).send("dev login failed"); });
    });
  }

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
