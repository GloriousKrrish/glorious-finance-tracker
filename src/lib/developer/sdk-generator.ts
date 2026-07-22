export type SdkLanguage = "typescript" | "python" | "curl";

export class SdkGenerator {
  public static generateCodeSnippet(
    language: SdkLanguage,
    path: string,
    method: string = "GET",
    apiKey: string = "gf_live_your_api_key"
  ): string {
    const baseUrl = "https://glorious-finance-tracker-main.vercel.app";

    switch (language) {
      case "typescript":
        return `import { GloriousClient } from "@gloriousfinance/sdk";

const client = new GloriousClient({
  apiKey: "${apiKey}",
  workspaceId: "personal"
});

async function run() {
  const response = await client.request("${method}", "${path}");
  console.log(response.data);
}

run();`;

      case "python":
        return `import requests

url = "${baseUrl}${path}"
headers = {
    "Authorization": "Bearer ${apiKey}",
    "X-Workspace-ID": "personal"
}

response = requests.get(url, headers=headers)
data = response.json()
print(data)`;

      case "curl":
        return `curl -X ${method} "${baseUrl}${path}" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "X-Workspace-ID: personal" \\
  -H "Content-Type: application/json"`;

      default:
        return "";
    }
  }
}
