import { NextRequest, NextResponse } from "next/server";
import { generateAiBrief } from "@/lib/analytics";
import { AiBriefRequest } from "@/lib/types";
import OpenAI from "openai";

async function generateOpenAiBrief(body: AiBriefRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: "You are a concise institutional investment analyst. Return strict JSON with keys summary, catalysts, risks, actionPlan."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Create a cross-market investment brief for ${body.symbol} in ${body.market}. Stance: ${body.stance}. Keep it tactical and execution-aware.`
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "investment_brief",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            summary: { type: "string" },
            catalysts: {
              type: "array",
              items: { type: "string" }
            },
            risks: {
              type: "array",
              items: { type: "string" }
            },
            actionPlan: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["summary", "catalysts", "risks", "actionPlan"]
        }
      }
    }
  });

  const content = completion.output_text;
  if (!content) {
    return null;
  }

  return JSON.parse(content);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as AiBriefRequest;
  const brief = (await generateOpenAiBrief(body).catch(() => null)) ?? generateAiBrief(body);
  if (!brief) {
    return NextResponse.json({ error: "instrument not found" }, { status: 404 });
  }
  return NextResponse.json(brief);
}
