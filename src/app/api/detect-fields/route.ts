import { NextRequest } from 'next/server';

interface PageInput {
  pageNumber: number;
  imageBase64: string;
  width: number;
  height: number;
}

interface DetectedField {
  name: string;
  type: 'text' | 'checkbox';
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY is not configured' },
      { status: 503 },
    );
  }

  let body: { pages: PageInput[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.pages) || body.pages.length === 0) {
    return Response.json(
      { error: 'pages array is required and must not be empty' },
      { status: 400 },
    );
  }

  if (body.pages.length > 20) {
    return Response.json(
      { error: 'Maximum 20 pages allowed' },
      { status: 400 },
    );
  }

  for (const page of body.pages) {
    if (!page.imageBase64 || !page.width || !page.height || !page.pageNumber) {
      return Response.json(
        { error: 'Each page must have imageBase64, width, height, and pageNumber' },
        { status: 400 },
      );
    }
  }

  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

  const pageDimensionsText = body.pages
    .map((p) => `- Page ${p.pageNumber}: ${p.width}pt × ${p.height}pt`)
    .join('\n');

  const systemPrompt = `You are a form field detector for PDF documents. Your task is to identify all form fields (text input areas and checkboxes) visible in the PDF page images.

COORDINATE SYSTEM:
- PDF coordinate system: origin (0, 0) is at the BOTTOM-LEFT corner
- X axis: increases to the RIGHT
- Y axis: increases UPWARD
- All coordinates and dimensions are in PDF points (pt)

PAGE DIMENSIONS:
${pageDimensionsText}

RULES:
- Detect text input fields (underlined areas, boxes, or blank spaces meant for text entry)
- Detect checkboxes (small squares meant for check marks)
- For text fields: provide x, y (bottom-left corner of the field), width, and height
- For checkboxes: provide x, y (bottom-left corner) only — no width/height needed
- Field names should be descriptive snake_case identifiers inferred from nearby labels (e.g., "last_name", "date_of_birth", "agree_to_terms")
- If a label is in Japanese, use a romanized or English equivalent for the field name
- Coordinates must be within the page dimensions
- y coordinate is the BOTTOM edge of the field (remember: PDF y=0 is at the bottom)

RESPONSE FORMAT:
Return ONLY a JSON array of field objects. No explanation, no markdown fences, just the raw JSON array.

Each object:
{ "name": string, "type": "text" | "checkbox", "page": number, "x": number, "y": number, "width"?: number, "height"?: number }`;

  const contentBlocks: Array<
    | { type: 'image'; source: { type: 'base64'; media_type: 'image/png'; data: string } }
    | { type: 'text'; text: string }
  > = [];

  for (const page of body.pages) {
    contentBlocks.push({
      type: 'text',
      text: `Page ${page.pageNumber} (${page.width}pt × ${page.height}pt):`,
    });
    contentBlocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: page.imageBase64,
      },
    });
  }

  contentBlocks.push({
    type: 'text',
    text: 'Detect all form fields in the above PDF page images. Return ONLY the JSON array.',
  });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 16384,
        system: systemPrompt,
        messages: [{ role: 'user', content: contentBlocks }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      return Response.json(
        { error: `Claude API error: ${response.status}` },
        { status: 502 },
      );
    }

    const resultText = await response.text();
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(resultText);
    } catch {
      console.error('Failed to parse Claude API response as JSON:', resultText.slice(0, 500));
      return Response.json(
        { error: `Claude API returned non-JSON: ${resultText.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const textContent = (result.content as Array<{ type: string; text?: string }>)?.find(
      (c) => c.type === 'text',
    );
    if (!textContent?.text) {
      console.error('Claude API result structure:', JSON.stringify(result).slice(0, 500));
      return Response.json(
        { error: `No text in Claude response. Keys: ${Object.keys(result).join(', ')}. Stop reason: ${result.stop_reason ?? 'unknown'}` },
        { status: 502 },
      );
    }

    const rawText: string = textContent.text.trim();
    const stopReason = result.stop_reason as string | undefined;
    console.log('Claude stop_reason:', stopReason, 'response length:', rawText.length);

    // Extract JSON array from response - try multiple strategies
    let parsed: unknown;

    const tryParse = (text: string): boolean => {
      try {
        parsed = JSON.parse(text);
        return true;
      } catch {
        return false;
      }
    };

    // Direct parse
    if (!tryParse(rawText)) {
      // Strategy 1: Strip markdown code fences
      const fenceMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      if (fenceMatch) {
        tryParse(fenceMatch[1].trim());
      }

      // Strategy 2: Find the outermost JSON array brackets
      if (!parsed) {
        const firstBracket = rawText.indexOf('[');
        const lastBracket = rawText.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket > firstBracket) {
          tryParse(rawText.slice(firstBracket, lastBracket + 1));
        }
      }

      // Strategy 3: Truncated JSON - find the last complete object in the array
      if (!parsed) {
        const firstBracket = rawText.indexOf('[');
        if (firstBracket !== -1) {
          // Find the last complete "}" followed by a comma or nothing
          const arrayContent = rawText.slice(firstBracket);
          const lastCompleteObj = arrayContent.lastIndexOf('},');
          if (lastCompleteObj !== -1) {
            const truncated = arrayContent.slice(0, lastCompleteObj + 1) + ']';
            tryParse(truncated);
            if (parsed) {
              console.log('Recovered truncated JSON array, parsed items:', (parsed as unknown[]).length);
            }
          }
        }
      }

      if (!parsed) {
        console.error('Failed to parse Claude response as JSON:', rawText.slice(0, 500));
        return Response.json(
          { error: 'Failed to parse field detection response' },
          { status: 502 },
        );
      }
    }

    if (!Array.isArray(parsed)) {
      // If it's an object with a fields array, unwrap it
      if (parsed && typeof parsed === 'object' && 'fields' in parsed && Array.isArray((parsed as { fields: unknown }).fields)) {
        parsed = (parsed as { fields: unknown[] }).fields;
      } else {
        console.error('Expected array, got:', typeof parsed);
        return Response.json(
          { error: 'Expected an array of fields from Claude API' },
          { status: 502 },
        );
      }
    }

    // Build page dimensions lookup
    const pageDims = new Map<number, { width: number; height: number }>();
    for (const p of body.pages) {
      pageDims.set(p.pageNumber, { width: p.width, height: p.height });
    }

    // Validate and sanitize fields
    const parsedArray = parsed as unknown[];
    const fields: DetectedField[] = [];
    for (const raw of parsedArray) {
      if (!raw || typeof raw !== 'object') continue;
      const { name, type, page, x, y, width, height } = raw as Record<string, unknown>;

      if (typeof name !== 'string' || !name) continue;
      if (type !== 'text' && type !== 'checkbox') continue;
      if (typeof page !== 'number' || typeof x !== 'number' || typeof y !== 'number') continue;

      const dims = pageDims.get(page);
      if (!dims) continue;

      // Clamp coordinates to page bounds
      const clampedX = Math.max(0, Math.min(x, dims.width));
      const clampedY = Math.max(0, Math.min(y, dims.height));

      const field: DetectedField = {
        name,
        type,
        page,
        x: Math.round(clampedX),
        y: Math.round(clampedY),
      };

      if (type === 'text') {
        if (typeof width === 'number' && width > 0) {
          field.width = Math.round(Math.min(width, dims.width - clampedX));
        }
        if (typeof height === 'number' && height > 0) {
          field.height = Math.round(Math.min(height, dims.height - clampedY));
        }
      }

      fields.push(field);
    }

    return Response.json({ fields });
  } catch (error) {
    console.error('Field detection error:', error);
    return Response.json(
      { error: 'Field detection failed' },
      { status: 500 },
    );
  }
}
