import { identity, json, sameOrigin } from "../_lib/security.js";
export async function onRequest(context) {
  try {
    if (!["GET", "HEAD"].includes(context.request.method))
      sameOrigin(context.request);
    context.data.user = await identity(context.request, context.env);
    return await context.next();
  } catch (e) {
    return json({ error: e.message }, e.status || 500);
  }
}
