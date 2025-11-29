import OpenAI from "openai";
import { Request, Response } from "express";
import TravelPlanService from "../services/travelPlan.service";

// 상수 정의
const MAX_HISTORY_LENGTH = 10; // 최대 대화 이력 개수
const MAX_CONVERSATIONS = 15; // 최대 대화 횟수 제한
const SUMMARY_THRESHOLD = 8; // 요약 시작 임계값

// 대화 요약 함수
const summarizeConversation = async (
  openai: OpenAI,
  history: Array<{ role: string; content: string }>
): Promise<string> => {
  const conversationText = history
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `다음 대화를 간결하게 요약하세요. 여행 계획에 필요한 정보(목적지, 기간, 예산, 날짜, 선호사항, 동행자)를 중심으로 요약하세요. 3-4문장으로 작성하세요.`,
      },
      { role: "user", content: conversationText },
    ],
    max_tokens: 200,
    temperature: 0.3,
  });

  return response.choices[0].message.content || "";
};

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

    // 대화 횟수 제한 체크
    if (history.length >= MAX_CONVERSATIONS * 2) {
      res.status(400).json({
        success: false,
        message:
          "대화 횟수가 너무 많습니다. '여행 계획 생성' 버튼을 눌러 계획을 생성하거나, 새로운 대화를 시작해주세요.",
        limitReached: true,
      });
      return;
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 대화 이력 최적화
    let optimizedHistory = history;
    let summaryContext = "";

    // 대화가 길어지면 이전 대화 요약
    if (history.length > SUMMARY_THRESHOLD * 2) {
      const oldHistory = history.slice(0, -6); // 오래된 대화
      const recentHistory = history.slice(-6); // 최근 3턴 (6개 메시지)

      summaryContext = await summarizeConversation(openai, oldHistory);
      optimizedHistory = recentHistory;
    } else if (history.length > MAX_HISTORY_LENGTH * 2) {
      // 요약 없이 최근 대화만 유지
      optimizedHistory = history.slice(-MAX_HISTORY_LENGTH * 2);
    }

    // 대화 이력 구성
    const systemPrompt = `당신은 친절한 한국 국내 여행 계획 어시스턴트입니다. 사용자와 대화하며 다음 정보를 수집하세요:

중요: 이 서비스는 한국 국내 여행만 지원합니다. 해외 여행을 원하는 경우 정중히 국내 여행만 가능하다고 안내하세요.

필수 정보:
- 여행 목적지 (한국 내 도시/지역: 예-서울, 부산, 제주도, 강릉, 전주 등)
- 여행 기간 (며칠)
- 대략적인 예산 (원 단위)
- 여행 시작 날짜

선택 정보:
- 선호하는 활동 (관광, 맛집, 쇼핑, 자연, 액티비티 등)
- 동행자 정보 (혼자, 가족, 친구 등)
- 숙박 선호도

대화 규칙:
1. 한 번에 1-2개 질문만 자연스럽게 하세요
2. 친근하고 공감하는 톤으로 대화하세요
3. 사용자가 제공한 정보를 간단히 요약해서 확인하세요
4. 모든 필수 정보가 수집되면 "충분한 정보가 모였습니다!" 라고 말하고 READY_TO_GENERATE 플래그를 포함하세요
5. 해외 목적지를 말하면 "죄송합니다. 현재는 한국 국내 여행만 지원하고 있어요. 국내에서 가고 싶은 곳이 있으신가요?"라고 안내하세요
${summaryContext ? `\n\n[이전 대화 요약]\n${summaryContext}` : ""}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...optimizedHistory,
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

    // 대화 횟수 경고
    const conversationCount = Math.floor(history.length / 2) + 1;
    const isNearLimit = conversationCount >= MAX_CONVERSATIONS - 2;

    res.status(200).json({
      success: true,
      message: assistantMessage.replace("READY_TO_GENERATE", "").trim(),
      canGenerate,
      conversationCount,
      isNearLimit,
      tokenUsage: response.usage,
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
      .map(
        (msg: { role: string; content: string }) =>
          `${msg.role}: ${msg.content}`
      )
      .join("\n");

    const extractResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `다음 대화에서 한국 국내 여행 계획에 필요한 정보를 추출하세요. JSON만 반환하세요:
{
  "destination": "목적지 (한국 내 도시/지역명, 예: 서울, 부산, 제주도, 강릉, 전주)",
  "duration": 일수(숫자),
  "budget": 예산(숫자, 없으면 null),
  "startDate": "YYYY-MM-DD 또는 null",
  "preferences": ["선호1", "선호2"],
  "companions": "동행자 정보"
}

주의: destination은 반드시 한국 내 지역명이어야 합니다.`,
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
다음 정보를 바탕으로 한국 국내 여행 계획을 JSON 형식으로 생성하세요:

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
            "title": "장소명 (실제 존재하는 한국 장소)",
            "address": "한국 주소 (시/도 구/군 동/읍/면 형식)",
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
1. 반드시 한국에 실제 존재하는 장소만 포함 (관광명소, 음식점, 카페 등)
2. address는 한국 주소 형식으로 작성 (예: "서울특별시 종로구 사직로 161", "부산광역시 해운대구 해운대해변로 264")
3. title은 장소의 실제 이름 (예: "경복궁", "해운대 해수욕장", "광장시장")
4. category는 "관광명소", "음식점", "카페", "쇼핑", "자연", "문화시설" 등 한국어로 작성
5. 각 일차마다 5-7개의 활동 포함
6. 시간은 현실적으로 배분 (이동시간 고려)
7. content는 HTML 형식
8. 시작 시간은 아침 9시, 마지막 활동은 저녁 9시 이전
9. 점심(12-13시)과 저녁(18-19시) 식사 시간 포함
10. 해당 지역의 유명한 맛집이나 특색 음식을 포함하세요
`;

    const planResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "한국 국내 여행 계획 전문가입니다. 한국의 실제 존재하는 장소와 정확한 한국 주소를 사용하여 JSON 형식으로만 응답합니다.",
        },
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

    // 4. 네이버 API로 장소 정보 보강 (썸네일, 좌표 등)
    const enrichedPlanJSON = await TravelPlanService.enrichPlanWithNaverAPI(
      planJSON
    );

    // 5. DB에 저장
    const templateUuid = await TravelPlanService.saveTravelPlanToDB(
      userId,
      templateName,
      enrichedPlanJSON
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
