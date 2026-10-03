export function stripeCheckoutMode(secretKey?: string | null): "off" | "test" | "live" {
  const key = (secretKey ?? "").trim();
  if (!key) return "off";
  if (key.startsWith("sk_test") || key.startsWith("rk_test")) return "test";
  return "live";
}
