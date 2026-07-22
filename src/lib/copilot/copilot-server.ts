import { createServerFn } from "@tanstack/react-start";

/**
 * Server-side Gemini API call for the Financial Copilot.
 * Keeps the API key on the server — never exposed to the browser.
 */
export const callCopilotGemini = createServerFn({ method: "POST" })
  .inputValidator((input: { userMessage: string; systemPrompt: string }) => {
    if (!input?.userMessage) throw new Error("userMessage required");
    if (!input?.systemPrompt) throw new Error("systemPrompt required");
    return input;
  })
  .handler(async ({ data }) => {
    const apiKey =
      process.env.Glorious_Finance ||
      process.env.LOVABLE_API_KEY ||
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return { content: "", tokensUsed: 0, error: "no_key" as const };
    }

    const isDirectGemini =
      apiKey.startsWith("AQ.") || apiKey.startsWith("AIzaSy");

    try {
      let content = "";
      let tokensUsed = 0;

      if (isDirectGemini) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                { role: "user", parts: [{ text: data.userMessage }] },
              ],
              systemInstruction: {
                parts: [{ text: data.systemPrompt }],
              },
            }),
          }
        );

        if (response.ok) {
          const json = (await response.json()) as any;
          content =
            json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          tokensUsed = json.usageMetadata?.totalTokenCount ?? 400;
        } else {
          const errText = await response.text();
          console.error(
            "[CopilotServer] Gemini API error:",
            response.status,
            errText
          );
          return {
            content: "",
            tokensUsed: 0,
            error: `gemini_${response.status}` as string,
          };
        }
      } else {
        // Lovable AI gateway fallback
        const res = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: data.systemPrompt },
                { role: "user", content: data.userMessage },
              ],
            }),
          }
        );

        if (!res.ok) {
          return {
            content: "",
            tokensUsed: 0,
            error: `gateway_${res.status}` as string,
          };
        }

        const json = (await res.json()) as any;
        content = json.choices?.[0]?.message?.content ?? "";
        tokensUsed = json.usage?.total_tokens ?? 400;
      }

      return { content, tokensUsed };
    } catch (error) {
      console.error("[CopilotServer] Gemini call error:", error);
      return {
        content: "",
        tokensUsed: 0,
        error:
          error instanceof Error ? error.message : "unknown_error",
      };
    }
  });
