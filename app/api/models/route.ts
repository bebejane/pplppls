/** Scratch route (untracked): Next route handlers must export named methods. */
export async function GET() {
	return Response.json({ models: 'ok' });
}
