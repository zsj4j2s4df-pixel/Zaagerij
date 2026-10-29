import { json } from "../_lib/security.js";
export function onRequestGet({ data, env }) {
  return json({
    user: { email: data.user.email, role: data.user.role },
    storage: {
      database: true,
      attachments: !!env.FILES,
      ai: !!env.OPENAI_API_KEY,
    },
  });
}
