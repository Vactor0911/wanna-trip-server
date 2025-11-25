/**
 * 여행 계획 생성 관련 프롬프트 유틸리티
 */

/**
 * 여행 계획 챗봇 시스템 프롬프트
 */
export const getTravelChatSystemPrompt = () => `당신은 친절한 여행 계획 어시스턴트입니다. 사용자와 대화하며 다음 정보를 수집하세요:

필수 정보:
- 여행 목적지 (도시/지역)
- 여행 기간 (며칠)
- 대략적인 예산
- 여행 시작 날짜

선택 정보:
- 선호하는 활동 (관광, 맛집, 쇼핑, 자연, 액티비티 등)
- 동행자 정보 (혼자, 가족, 친구 등)
- 숙박 선호도
- 이동 수단 선호도

대화 규칙:
1. 한 번에 1-2개 질문만 자연스럽게 하세요
2. 친근하고 공감하는 톤으로 대화하세요
3. 사용자가 제공한 정보를 간단히 요약해서 확인하세요
4. 모든 필수 정보가 수집되면 "충분한 정보가 모였습니다!" 라고 말하고 READY_TO_GENERATE 플래그를 포함하세요
5. 정보가 부족하면 자연스럽게 추가 질문을 하세요
`;

/**
 * 대화 이력에서 여행 정보 추출 프롬프트
 */
export const getExtractInfoPrompt = (conversationHistory: string) => `
다음 대화에서 여행 계획에 필요한 정보를 추출하세요:

${conversationHistory}

다음 JSON 형식으로 추출된 정보를 반환하세요:
{
  "destination": "목적지",
  "duration": 일수,
  "budget": 예산 (숫자만),
  "startDate": "YYYY-MM-DD",
  "preferences": ["선호1", "선호2"],
  "travelStyle": "여행 스타일",
  "companions": "동행자 정보"
}

정보가 없는 항목은 null로 설정하세요.
`;

/**
 * 여행 계획 JSON 생성 프롬프트
 */
export const getTravelPlanGenerationPrompt = (userInfo: {
  destination: string;
  duration: number;
  budget?: number;
  startDate?: string;
  preferences?: string[];
  travelStyle?: string;
  companions?: string;
}) => `
다음 정보를 바탕으로 상세한 여행 계획을 JSON 형식으로 생성하세요:

목적지: ${userInfo.destination}
기간: ${userInfo.duration}일
예산: ${userInfo.budget ? `${userInfo.budget}원` : "미정"}
시작일: ${userInfo.startDate || "미정"}
선호사항: ${userInfo.preferences?.join(", ") || "없음"}
여행 스타일: ${userInfo.travelStyle || "일반"}
동행자: ${userInfo.companions || "미정"}

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
          "content": "<p>활동 설명 및 팁</p>",
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
2. 시간은 현실적으로 배분 (이동시간, 식사시간 고려)
3. 예산 내에서 활동 선정 (예산이 있는 경우)
4. 실제 존재하는 장소만 포함
5. content는 반드시 HTML 형식 (<p>, <strong> 등 사용)
6. category는 "여행>관광지", "음식점>한식" 같은 형식 사용
7. 시작 시간은 아침 8-9시, 마지막 활동은 저녁 9시 이전
8. 점심(12-13시)과 저녁(18-19시) 식사 시간 포함
9. location의 title은 실제 장소명 (예: "경복궁", "남산타워")
10. address는 상세 주소 (구/동까지)

각 활동의 content 작성 예시:
"<p><strong>경복궁</strong>에서 조선시대 역사를 느껴보세요.</p><p>광화문에서 시작해 근정전, 경회루를 둘러보는 코스를 추천합니다. 소요시간 약 2시간.</p>"
`;

/**
 * 여행 계획 검증 및 개선 프롬프트
 */
export const getValidationPrompt = (planJSON: string) => `
다음 여행 계획 JSON을 검증하고 문제가 있다면 수정하세요:

${planJSON}

검증 항목:
1. 시간 겹침이 없는지
2. 이동 시간이 충분한지
3. 식사 시간이 포함되었는지
4. 각 일차의 활동이 지리적으로 효율적인지
5. start_time < end_time 인지
6. order_index가 순차적인지

문제가 있다면 수정된 JSON을 반환하고, 없다면 원본 JSON을 그대로 반환하세요.
JSON만 출력하세요.
`;

/**
 * 장소 정보 보강 프롬프트 (네이버 API 연동 전 임시)
 */
export const getLocationEnrichmentPrompt = (locationName: string, city: string) => `
"${city}"의 "${locationName}"에 대한 다음 정보를 제공하세요:

{
  "address": "상세 주소",
  "category": "카테고리 (예: 여행>관광지)",
  "description": "간단한 설명 (50자 이내)"
}

JSON 형식으로만 답변하세요.
`;
