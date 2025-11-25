import OpenAI from "openai";
import { Request, Response } from "express";
import TravelPlanService from "../services/travelPlan.service";

// 여행 계획 챗봇 대화
export const travelPlanChatbot = async (req: Request, res: Response) => {
  try {
    const { message, history, templateName } = req.body;

    if (!message?.trim()) {
      res
        .status(400)
        .json({ success: false, message: "메시지를 입력해주세요." });
      return;
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 대화 이력 구성
    const messages = [
      {
        role: "system",
        content: `당신은 친절한 여행 계획 어시스턴트입니다. 사용자와 대화하며 다음 정보를 수집하세요:

필수 정보:
- 여행 목적지 (도시/지역)
- 여행 기간 (며칠)
- 대략적인 예산
- 여행 시작 날짜

선택 정보:
- 선호하는 활동 (관광, 맛집, 쇼핑, 자연, 액티비티 등)
- 동행자 정보 (혼자, 가족, 친구 등)
- 숙박 선호도

대화 규칙:
1. 한 번에 1-2개 질문만 자연스럽게 하세요
2. 친근하고 공감하는 톤으로 대화하세요
3. 사용자가 제공한 정보를 간단히 요약해서 확인하세요
4. 모든 필수 정보가 수집되면 "충분한 정보가 모였습니다!" 라고 말하고 READY_TO_GENERATE 플래그를 포함하세요`,
      },
      ...history,
      { role: "user", content: message },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages as any,
      max_tokens: 500,
      temperature: 0.7,
    });

    const assistantMessage = response.choices[0].message.content || "";
    const canGenerate = assistantMessage.includes("READY_TO_GENERATE");

    res.status(200).json({
      success: true,
      message: assistantMessage.replace("READY_TO_GENERATE", "").trim(),
      canGenerate,
    });
  } catch (err: any) {
    console.error("여행 계획 챗봇 오류:", err);
    res.status(err?.statusCode || 500).json({
      success: false,
      message: "챗봇 API 호출에 실패했습니다.",
      error: err?.response?.data ?? err.message,
    });
  }
};

// 여행 계획 최종 생성
export const generateTravelPlan = async (req: Request, res: Response) => {
  try {
    const userId = req?.user?.userId!;
    const { templateName, conversationHistory } = req.body;

    if (!templateName || !conversationHistory) {
      res.status(400).json({
        success: false,
        message: "필수 정보가 누락되었습니다.",
      });
      return;
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1. 대화 이력에서 여행 정보 추출
    const conversationText = conversationHistory
      .map((msg: { role: string; content: string }) => `${msg.role}: ${msg.content}`)
      .join("\n");

    const extractResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `다음 대화에서 여행 계획에 필요한 정보를 추출하세요. JSON만 반환하세요:
{
  "destination": "목적지",
  "duration": 일수(숫자),
  "budget": 예산(숫자, 없으면 null),
  "startDate": "YYYY-MM-DD 또는 null",
  "preferences": ["선호1", "선호2"],
  "companions": "동행자 정보"
}`,
        },
        { role: "user", content: conversationText },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    let extractedInfo;
    try {
      let infoText = extractResponse.choices[0].message.content || "{}";
      // 마크다운 코드블록 제거
      if (infoText.startsWith("```")) {
        infoText = infoText.replace(/```json?\n?/g, "").replace(/```/g, "");
      }
      extractedInfo = JSON.parse(infoText.trim());
    } catch (parseError) {
      console.error("정보 추출 파싱 오류:", parseError);
      extractedInfo = {
        destination: "서울",
        duration: 2,
        preferences: [],
      };
    }

    // 2. 여행 계획 JSON 생성
    const planPrompt = `
다음 정보를 바탕으로 상세한 여행 계획을 JSON 형식으로 생성하세요:

목적지: ${extractedInfo.destination}
기간: ${extractedInfo.duration}일
예산: ${extractedInfo.budget ? `${extractedInfo.budget}원` : "미정"}
시작일: ${extractedInfo.startDate || "미정"}
선호사항: ${extractedInfo.preferences?.join(", ") || "없음"}
동행자: ${extractedInfo.companions || "미정"}

출력 형식 (JSON만 출력, 다른 텍스트 없이):
{
  "boards": [
    {
      "day_number": 1,
      "cards": [
        {
          "location": {
            "title": "장소명",
            "address": "주소",
            "category": "카테고리"
          },
          "content": "<p>활동 설명</p>",
          "start_time": "09:00:00",
          "end_time": "11:00:00",
          "order_index": 1
        }
      ]
    }
  ]
}

중요 규칙:
1. 각 일차마다 5-7개의 활동 포함
2. 시간은 현실적으로 배분 (이동시간 고려)
3. 실제 존재하는 장소만 포함
4. content는 HTML 형식
5. 시작 시간은 아침 9시, 마지막 활동은 저녁 9시 이전
6. 점심(12-13시)과 저녁(18-19시) 식사 시간 포함
`;

    const planResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "여행 계획 전문가입니다. JSON 형식으로만 응답합니다." },
        { role: "user", content: planPrompt },
      ],
      max_tokens: 4000,
      temperature: 0.7,
    });

    let planJSON;
    try {
      let planText = planResponse.choices[0].message.content || "{}";
      // 마크다운 코드블록 제거
      if (planText.startsWith("```")) {
        planText = planText.replace(/```json?\n?/g, "").replace(/```/g, "");
      }
      planJSON = JSON.parse(planText.trim());
    } catch (parseError) {
      console.error("여행 계획 파싱 오류:", parseError);
      res.status(500).json({
        success: false,
        message: "여행 계획 생성에 실패했습니다. 다시 시도해주세요.",
      });
      return;
    }

    // 3. JSON 유효성 검증
    const validation = TravelPlanService.validatePlanJSON(planJSON);

    if (!validation.isValid) {
      console.error("JSON 검증 실패:", validation.errors);
      res.status(500).json({
        success: false,
        message: "생성된 여행 계획이 유효하지 않습니다.",
        errors: validation.errors,
      });
      return;
    }

    // 4. DB에 저장
    const templateUuid = await TravelPlanService.saveTravelPlanToDB(
      userId,
      templateName,
      planJSON
    );

    res.status(201).json({
      success: true,
      message: "여행 계획이 성공적으로 생성되었습니다.",
      templateUuid,
      planSummary: {
        destination: extractedInfo.destination,
        duration: extractedInfo.duration,
        totalActivities: planJSON.boards.reduce(
          (sum: number, board: any) => sum + board.cards.length,
          0
        ),
      },
    });
  } catch (err: any) {
    console.error("여행 계획 생성 오류:", err);
    res.status(500).json({
      success: false,
      message: "여행 계획 생성에 실패했습니다.",
      error: err.message,
    });
  }
};

