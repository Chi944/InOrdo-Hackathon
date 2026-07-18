// Next.js treats source folders beginning with `_` as private. This encoded
// route segment exposes the guarded private fixture at `/__e2e__/core-demo`.
export const dynamic = "force-dynamic";

export { default } from "@/app/__e2e__/core-demo/page";
