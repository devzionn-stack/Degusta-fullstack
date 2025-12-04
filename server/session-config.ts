import crypto from "crypto";

let sessionSecret: string | null = null;

export function getSessionSecret(): string {
  if (sessionSecret) return sessionSecret;
  
  const envSecret = process.env.SESSION_SECRET;
  if (envSecret) {
    sessionSecret = envSecret;
    return envSecret;
  }
  
  console.warn("WARNING: SESSION_SECRET is not set. Generating a random secret for this session only.");
  sessionSecret = crypto.randomBytes(32).toString("hex");
  return sessionSecret;
}
