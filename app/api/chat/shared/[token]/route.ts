import { getChatByShareToken } from "@/lib/actions/ai";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!UUID_REGEX.test(token)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const data = await getChatByShareToken(token);
  if (!data) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(data);
}
