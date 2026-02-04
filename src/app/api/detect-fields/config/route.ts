export async function GET() {
  return Response.json({
    available: !!process.env.ANTHROPIC_API_KEY,
  });
}
