const VIBELIVE_API = "https://proto2.makedo.com:8883/v04/authorizeUser.jsp";

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Add contextAuthToken and forward to VibeLive
    const payload = {
      ...body,
      contextAuthToken: env.CONTEXT_AUTH_TOKEN,
    };

    try {
      const response = await fetch(VIBELIVE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      return Response.json(data, {
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    } catch (e) {
      return Response.json(
        { error: "Failed to reach VibeLive API" },
        { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }
  },
};
