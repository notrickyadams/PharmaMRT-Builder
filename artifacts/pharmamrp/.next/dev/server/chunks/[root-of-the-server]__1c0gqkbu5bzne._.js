module.exports = [
(()=>{"use strict";return[
"[project]/artifacts/pharmamrp/app/api/analyze/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST,
    "runtime",
    ()=>runtime
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$google$2b$genai$40$2$2e$28$2e$0$2f$node_modules$2f40$google$2f$genai$2f$dist$2f$node$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@google+genai@2.28.0/node_modules/@google/genai/dist/node/index.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js [app-route] (ecmascript) <export * as z .string>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$object$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js [app-route] (ecmascript) <export * as z .object>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$enum$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js [app-route] (ecmascript) <export * as z .enum>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$array$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js [app-route] (ecmascript) <export * as z .array>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$number$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js [app-route] (ecmascript) <export * as z .number>");
var __TURBOPACK__imported__module__$5b$project$5d2f$artifacts$2f$pharmamrp$2f$lib$2f$classification$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/artifacts/pharmamrp/lib/classification.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$artifacts$2f$pharmamrp$2f$lib$2f$config$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/artifacts/pharmamrp/lib/config.ts [app-route] (ecmascript)");
;
;
;
;
const runtime = "nodejs";
const nullableString = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().nullable();
const medicationSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$object$3e$__["z"].object({
    id: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().min(1),
    name: nullableString,
    genericName: nullableString,
    dose: nullableString,
    unit: nullableString,
    frequency: nullableString,
    route: nullableString,
    duration: nullableString,
    confidence: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$enum$3e$__["z"].enum([
        "high",
        "low"
    ]).nullable(),
    conditions: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$array$3e$__["z"].array(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string()).nullable(),
    startDate: nullableString,
    orderStatus: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$enum$3e$__["z"].enum([
        "active",
        "stopped",
        "modified",
        "unknown"
    ]),
    sourceText: nullableString
}).strict();
const labOrderSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$object$3e$__["z"].object({
    test: nullableString,
    date: nullableString,
    sourceText: nullableString
}).strict();
const AnalyzeRequestSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$object$3e$__["z"].object({
    medications: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$array$3e$__["z"].array(medicationSchema).max(200),
    labOrders: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$array$3e$__["z"].array(labOrderSchema).max(200),
    ward: nullableString,
    patientAge: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$number$3e$__["z"].number().int().nonnegative().nullable(),
    patientGender: nullableString
}).strict();
const modelResultSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$object$3e$__["z"].object({
    problems: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$array$3e$__["z"].array(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$object$3e$__["z"].object({
        medicationIndexes: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$array$3e$__["z"].array(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$number$3e$__["z"].number().int().nonnegative()).min(1),
        problemCode: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$enum$3e$__["z"].enum(__TURBOPACK__imported__module__$5b$project$5d2f$artifacts$2f$pharmamrp$2f$lib$2f$classification$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PROBLEM_CODES"].map(({ code })=>code)).nullable(),
        causeCode: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$enum$3e$__["z"].enum(__TURBOPACK__imported__module__$5b$project$5d2f$artifacts$2f$pharmamrp$2f$lib$2f$classification$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CAUSE_CODES"].map(({ code })=>code)).nullable(),
        explanation: nullableString,
        severity: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$enum$3e$__["z"].enum([
            "low",
            "moderate",
            "high"
        ]).nullable(),
        suggestedIntervention: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$enum$3e$__["z"].enum(__TURBOPACK__imported__module__$5b$project$5d2f$artifacts$2f$pharmamrp$2f$lib$2f$classification$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["INTERVENTION_CODES"].map(({ code })=>code)).nullable(),
        highlights: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$array$3e$__["z"].array(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string())
    }).strict())
}).strict();
const nullableText = {
    type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$google$2b$genai$40$2$2e$28$2e$0$2f$node_modules$2f40$google$2f$genai$2f$dist$2f$node$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Type"].STRING,
    nullable: true
};
const modelResponseSchema = {
    type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$google$2b$genai$40$2$2e$28$2e$0$2f$node_modules$2f40$google$2f$genai$2f$dist$2f$node$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Type"].OBJECT,
    properties: {
        problems: {
            type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$google$2b$genai$40$2$2e$28$2e$0$2f$node_modules$2f40$google$2f$genai$2f$dist$2f$node$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Type"].ARRAY,
            items: {
                type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$google$2b$genai$40$2$2e$28$2e$0$2f$node_modules$2f40$google$2f$genai$2f$dist$2f$node$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Type"].OBJECT,
                properties: {
                    medicationIndexes: {
                        type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$google$2b$genai$40$2$2e$28$2e$0$2f$node_modules$2f40$google$2f$genai$2f$dist$2f$node$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Type"].ARRAY,
                        items: {
                            type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$google$2b$genai$40$2$2e$28$2e$0$2f$node_modules$2f40$google$2f$genai$2f$dist$2f$node$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Type"].INTEGER
                        }
                    },
                    problemCode: {
                        type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$google$2b$genai$40$2$2e$28$2e$0$2f$node_modules$2f40$google$2f$genai$2f$dist$2f$node$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Type"].STRING,
                        enum: __TURBOPACK__imported__module__$5b$project$5d2f$artifacts$2f$pharmamrp$2f$lib$2f$classification$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PROBLEM_CODES"].map(({ code })=>code),
                        nullable: true
                    },
                    causeCode: {
                        type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$google$2b$genai$40$2$2e$28$2e$0$2f$node_modules$2f40$google$2f$genai$2f$dist$2f$node$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Type"].STRING,
                        enum: __TURBOPACK__imported__module__$5b$project$5d2f$artifacts$2f$pharmamrp$2f$lib$2f$classification$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CAUSE_CODES"].map(({ code })=>code),
                        nullable: true
                    },
                    explanation: nullableText,
                    severity: {
                        type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$google$2b$genai$40$2$2e$28$2e$0$2f$node_modules$2f40$google$2f$genai$2f$dist$2f$node$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Type"].STRING,
                        enum: [
                            "low",
                            "moderate",
                            "high"
                        ],
                        nullable: true
                    },
                    suggestedIntervention: {
                        type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$google$2b$genai$40$2$2e$28$2e$0$2f$node_modules$2f40$google$2f$genai$2f$dist$2f$node$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Type"].STRING,
                        enum: __TURBOPACK__imported__module__$5b$project$5d2f$artifacts$2f$pharmamrp$2f$lib$2f$classification$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["INTERVENTION_CODES"].map(({ code })=>code),
                        nullable: true
                    },
                    highlights: {
                        type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$google$2b$genai$40$2$2e$28$2e$0$2f$node_modules$2f40$google$2f$genai$2f$dist$2f$node$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Type"].ARRAY,
                        items: {
                            type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$google$2b$genai$40$2$2e$28$2e$0$2f$node_modules$2f40$google$2f$genai$2f$dist$2f$node$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Type"].STRING
                        }
                    }
                },
                required: [
                    "medicationIndexes",
                    "problemCode",
                    "causeCode",
                    "explanation",
                    "severity",
                    "suggestedIntervention",
                    "highlights"
                ]
            }
        }
    },
    required: [
        "problems"
    ]
};
function failure(error = "Analysis could not be completed. Please check the scanned details and try again.") {
    return Response.json({
        source: "failed",
        error
    }, {
        status: 200
    });
}
function toProblems(result, medications, labOrders) {
    return result.problems.map((suggestion)=>{
        if (suggestion.medicationIndexes.some((index)=>index < 0 || index >= medications.length)) {
            throw new Error("Invalid medication reference.");
        }
        const referencedMedications = suggestion.medicationIndexes.map((index)=>medications[index]);
        const citedText = [
            ...referencedMedications.map((medication)=>medication.sourceText),
            ...labOrders.map((order)=>order.sourceText)
        ].filter((text)=>Boolean(text));
        if (suggestion.highlights.some((highlight)=>!citedText.some((text)=>text.includes(highlight)))) {
            throw new Error("A source highlight did not match the supplied prescription text.");
        }
        return {
            id: crypto.randomUUID(),
            medicationIds: referencedMedications.map((medication)=>medication.id),
            problemCode: suggestion.problemCode,
            causeCode: suggestion.causeCode,
            explanation: suggestion.explanation,
            severity: suggestion.severity,
            suggestedIntervention: suggestion.suggestedIntervention,
            finalIntervention: null,
            acceptance: null,
            reviewStatus: "suggested",
            highlights: suggestion.highlights,
            notes: null
        };
    });
}
async function POST(request) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("Gemini is not configured.");
        }
        const body = AnalyzeRequestSchema.parse(await request.json());
        const ai = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$google$2b$genai$40$2$2e$28$2e$0$2f$node_modules$2f40$google$2f$genai$2f$dist$2f$node$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["GoogleGenAI"]({
            apiKey
        });
        const response = await ai.models.generateContent({
            model: __TURBOPACK__imported__module__$5b$project$5d2f$artifacts$2f$pharmamrp$2f$lib$2f$config$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["GEMINI_ANALYZE_MODEL"],
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: [
                                "Analyze the confirmed medication orders and lab orders below for clear medication-related problems. Return only the requested structured fields.",
                                "Suggest a problem only when the supplied medication, lab, ward, age, or gender information gives a clear reason. If there is no clear issue, return an empty problems array.",
                                "Never invent drug interactions, infer facts not provided, or use unsupported external clinical assumptions. Treat this as decision support: the pharmacist makes the final decision.",
                                "Use only these broad PCNE codes: " + __TURBOPACK__imported__module__$5b$project$5d2f$artifacts$2f$pharmamrp$2f$lib$2f$classification$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PROBLEM_CODES"].map(({ code, label })=>`${code}=${label}`).join(", ") + "; causes: " + __TURBOPACK__imported__module__$5b$project$5d2f$artifacts$2f$pharmamrp$2f$lib$2f$classification$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CAUSE_CODES"].map(({ code, label })=>`${code}=${label}`).join(", ") + "; interventions: " + __TURBOPACK__imported__module__$5b$project$5d2f$artifacts$2f$pharmamrp$2f$lib$2f$classification$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["INTERVENTION_CODES"].map(({ code, label })=>`${code}=${label}`).join(", ") + ".",
                                "For medicationIndexes use zero-based indexes into the medications array. Link every problem to one or more relevant medications. Each highlight must be an exact contiguous quote from the supplied medication or lab sourceText. If a code, explanation, or severity is uncertain, return null for that field. Do not include patient names or file numbers.",
                                JSON.stringify({
                                    medications: body.medications,
                                    labOrders: body.labOrders,
                                    ward: body.ward,
                                    patientAge: body.patientAge,
                                    patientGender: body.patientGender
                                })
                            ].join(" ")
                        }
                    ]
                }
            ],
            config: {
                responseMimeType: "application/json",
                responseSchema: modelResponseSchema
            }
        });
        if (!response.text) {
            throw new Error("Gemini returned no structured result.");
        }
        const parsed = modelResultSchema.parse(JSON.parse(response.text));
        const problems = toProblems(parsed, body.medications, body.labOrders);
        return Response.json({
            problems,
            source: "ai"
        });
    } catch  {
        return failure();
    }
}
}),
"[project]/artifacts/pharmamrp/lib/classification.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ACCEPTANCE_CODES",
    ()=>ACCEPTANCE_CODES,
    "CAUSE_CODES",
    ()=>CAUSE_CODES,
    "INTERVENTION_CODES",
    ()=>INTERVENTION_CODES,
    "PROBLEM_CODES",
    ()=>PROBLEM_CODES
]);
const PROBLEM_CODES = [
    {
        code: "P1",
        label: "Treatment effectiveness"
    },
    {
        code: "P2",
        label: "Treatment safety"
    },
    {
        code: "P3",
        label: "Other"
    }
];
const CAUSE_CODES = [
    {
        code: "C1",
        label: "Drug selection"
    },
    {
        code: "C2",
        label: "Drug form"
    },
    {
        code: "C3",
        label: "Dose selection"
    },
    {
        code: "C4",
        label: "Treatment duration"
    },
    {
        code: "C5",
        label: "Drug use process"
    },
    {
        code: "C6",
        label: "Logistics"
    },
    {
        code: "C7",
        label: "Patient"
    },
    {
        code: "C8",
        label: "Patient transfer related"
    },
    {
        code: "C9",
        label: "Other"
    }
];
const INTERVENTION_CODES = [
    {
        code: "I0",
        label: "No intervention"
    },
    {
        code: "I1",
        label: "Prescriber"
    },
    {
        code: "I2",
        label: "Patient"
    },
    {
        code: "I3",
        label: "Drug"
    },
    {
        code: "I4",
        label: "Other"
    }
];
const ACCEPTANCE_CODES = [
    {
        code: "A1",
        label: "Intervention accepted"
    },
    {
        code: "A2",
        label: "Intervention not accepted"
    },
    {
        code: "A3",
        label: "Other"
    }
];
}),
"[project]/artifacts/pharmamrp/lib/config.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GEMINI_ANALYZE_MODEL",
    ()=>GEMINI_ANALYZE_MODEL,
    "GEMINI_SCAN_MODEL",
    ()=>GEMINI_SCAN_MODEL
]);
const GEMINI_SCAN_MODEL = "gemini-3.8-flash";
const GEMINI_ANALYZE_MODEL = "gemini-3.1-pro-preview";
}),
]})(),
"[externals]/buffer [external] (buffer, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("buffer", () => require("buffer"));

module.exports = mod;
}),
"[externals]/child_process [external] (child_process, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("child_process", () => require("child_process"));

module.exports = mod;
}),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[externals]/events [external] (events, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("events", () => require("events"));

module.exports = mod;
}),
"[externals]/fs [external] (fs, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("fs", () => require("fs"));

module.exports = mod;
}),
"[externals]/fs/promises [external] (fs/promises, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("fs/promises", () => require("fs/promises"));

module.exports = mod;
}),
"[externals]/http [external] (http, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("http", () => require("http"));

module.exports = mod;
}),
"[externals]/https [external] (https, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("https", () => require("https"));

module.exports = mod;
}),
"[externals]/net [external] (net, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("net", () => require("net"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/runtime-reacts.external.js [external] (next/dist/server/runtime-reacts.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/runtime-reacts.external.js", () => require("next/dist/server/runtime-reacts.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/node:stream [external] (node:stream, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:stream", () => require("node:stream"));

module.exports = mod;
}),
"[externals]/node:stream/promises [external] (node:stream/promises, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:stream/promises", () => require("node:stream/promises"));

module.exports = mod;
}),
"[externals]/os [external] (os, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("os", () => require("os"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
"[externals]/process [external] (process, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("process", () => require("process"));

module.exports = mod;
}),
"[externals]/querystring [external] (querystring, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("querystring", () => require("querystring"));

module.exports = mod;
}),
"[externals]/stream [external] (stream, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("stream", () => require("stream"));

module.exports = mod;
}),
"[externals]/tls [external] (tls, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("tls", () => require("tls"));

module.exports = mod;
}),
"[externals]/url [external] (url, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("url", () => require("url"));

module.exports = mod;
}),
"[externals]/util [external] (util, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("util", () => require("util"));

module.exports = mod;
}),
"[externals]/zlib [external] (zlib, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("zlib", () => require("zlib"));

module.exports = mod;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1c0gqkbu5bzne._.js.map