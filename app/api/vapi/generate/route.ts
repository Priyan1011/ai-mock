// import { generateText } from "ai";
// import { google } from "@ai-sdk/google";

// import { db } from "@/firebase/admin";
// import { getRandomInterviewCover } from "@/lib/utils";

// export async function POST(request: Request) {
//   const { type, role, level, techstack, amount, userid } = await request.json();

//   try {
//     const { text: questions } = await generateText({
//       model: google("gemini-2.0-flash-001"),
//       prompt: `Prepare questions for a job interview.
//         The job role is ${role}.
//         The job experience level is ${level}.
//         The tech stack used in the job is: ${techstack}.
//         The focus between behavioural and technical questions should lean towards: ${type}.
//         The amount of questions required is: ${amount}.
//         Please return only the questions, without any additional text.
//         The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
//         Return the questions formatted like this:
//         ["Question 1", "Question 2", "Question 3"]
        
//         Thank you! <3
//     `,
//     });

//     const interview = {
//       role: role,
//       type: type,
//       level: level,
//       techstack: techstack.split(","),
//       questions: JSON.parse(questions),
//       userId: userid,
//       finalized: true,
//       coverImage: getRandomInterviewCover(),
//       createdAt: new Date().toISOString(),
//     };

//     await db.collection("interviews").add(interview);

//     return Response.json({ success: true }, { status: 200 });
//   } catch (error) {
//     console.error("Error:", error);
//     return Response.json({ success: false, error: error }, { status: 500 });
//   }
// }

// export async function GET() {
//   return Response.json({ success: true, data: "Thank you!" }, { status: 200 });
// }
import { db } from '@/firebase/admin';
import { getRandomInterviewCover } from '@/lib/utils';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

// Initialize the provider explicitly
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  // Force the v1beta endpoint if that's where your 2.5 models are located
  baseURL: 'https://generativelanguage.googleapis.com/v1beta', 
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { type, role, level, techStack, amount, userId } = body;

    // ✅ Validate required fields
    if (!type || !role || !level || !amount || !userId) {
      return Response.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // ✅ Ensure techStack is always an array
    const safeTechStack = Array.isArray(techStack)
      ? techStack
      : typeof techStack === "string"
      ? [techStack]
      : [];

    // ✅ Generate questions using FREE Gemini model
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt: `Prepare questions for a job interview.
The job role is ${role}.
The job experience level is ${level}.
The tech stack used in the job is: ${safeTechStack.join(", ")}.
The focus between behavioural and technical questions should lean towards: ${type}.
The amount of questions required is: ${amount}.
Please return only the questions, without any additional text.
The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters.
Return the questions formatted like this:
["Question 1", "Question 2", "Question 3"]`,
    });

    // ✅ Safe JSON parsing (Gemini sometimes returns extra text)
    let parsedQuestions: string[] = [];

    try {
      parsedQuestions = JSON.parse(text);
    } catch {
      parsedQuestions = text
        .replace(/```json|```/g, "")
        .trim()
        .split("\n")
        .map((q) => q.replace(/^[-•\d.]+\s*/, "").trim())
        .filter(Boolean);
    }

    // ✅ Firestore interview document
    const interview = {
      role,
      type,
      level,
      techStack: safeTechStack, // 🔥 correct field name for UI
      questions: parsedQuestions,
      userId,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };

    const docRef = await db.collection("interviews").add(interview);

    // ✅ Return interview ID (useful for redirect later)
    return Response.json(
      { success: true, interviewId: docRef.id },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error generating interview:", error);

    return Response.json(
      { success: false, error: "Failed to generate interview" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({ success: true, data: "API is working" }, { status: 200 });
}