/**
 * 여행 계획 생성 관련 프롬프트 유틸리티
 * 
 * 주의: 이 서비스는 한국 국내 여행만 지원합니다.
 * 네이버 지도 API가 국내 장소만 지원하기 때문입니다.
 */

// 지원하는 한국 주요 여행지 목록 (참고용)
export const SUPPORTED_DESTINATIONS = [
  "서울", "부산", "제주도", "강릉", "전주", "경주", "여수", "속초",
  "인천", "대구", "대전", "광주", "울산", "수원", "춘천", "안동",
  "통영", "거제", "목포", "포항", "순천", "담양", "보성", "남해"
];

/**
 * 여행 계획 챗봇 시스템 프롬프트
 */
export const getTravelChatSystemPrompt = (summaryContext?: string) => `당신은 친절한 한국 국내 여행 계획 어시스턴트입니다. 사용자와 대화하며 다음 정보를 수집하세요:

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
- 이동 수단 선호도

대화 규칙:
1. 한 번에 1-2개 질문만 자연스럽게 하세요
2. 친근하고 공감하는 톤으로 대화하세요
3. 사용자가 제공한 정보를 간단히 요약해서 확인하세요
4. 모든 필수 정보가 수집되면 "충분한 정보가 모였습니다!" 라고 말하고 READY_TO_GENERATE 플래그를 포함하세요
5. 정보가 부족하면 자연스럽게 추가 질문을 하세요
6. 해외 목적지를 말하면 "죄송합니다. 현재는 한국 국내 여행만 지원하고 있어요. 국내에서 가고 싶은 곳이 있으신가요?"라고 안내하세요
${summaryContext ? `\n\n[이전 대화 요약]\n${summaryContext}` : ""}
`;

/**
 * 대화 이력에서 여행 정보 추출 프롬프트
 */
export const getExtractInfoPrompt = (conversationHistory: string) => `
다음 대화에서 한국 국내 여행 계획에 필요한 정보를 추출하세요:

${conversationHistory}

다음 JSON 형식으로 추출된 정보를 반환하세요:
{
  "destination": "목적지 (한국 내 도시/지역명, 예: 서울, 부산, 제주도, 강릉, 전주)",
  "duration": 일수,
  "budget": 예산 (숫자만, 원 단위),
  "startDate": "YYYY-MM-DD",
  "preferences": ["선호1", "선호2"],
  "travelStyle": "여행 스타일",
  "companions": "동행자 정보"
}

주의: destination은 반드시 한국 내 지역명이어야 합니다.
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
다음 정보를 바탕으로 한국 국내 여행 계획을 JSON 형식으로 생성하세요:

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
            "title": "장소명 (실제 존재하는 한국 장소)",
            "address": "한국 주소 (시/도 구/군 동/읍/면 형식)",
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
1. 반드시 한국에 실제 존재하는 장소만 포함 (관광명소, 음식점, 카페 등)
2. address는 한국 주소 형식으로 작성 (예: "서울특별시 종로구 사직로 161", "부산광역시 해운대구 해운대해변로 264")
3. title은 장소의 실제 이름 (예: "경복궁", "해운대 해수욕장", "광장시장")
4. category는 "관광명소", "음식점", "카페", "쇼핑", "자연", "문화시설" 등 한국어로 작성
5. 각 일차마다 5-7개의 활동 포함
6. 시간은 현실적으로 배분 (이동시간, 식사시간 고려)
7. 예산 내에서 활동 선정 (예산이 있는 경우)
8. content는 반드시 HTML 형식 (<p>, <strong> 등 사용)
9. 시작 시간은 아침 8-9시, 마지막 활동은 저녁 9시 이전
10. 점심(12-13시)과 저녁(18-19시) 식사 시간 포함
11. 해당 지역의 유명한 맛집이나 특색 음식을 포함하세요

각 활동의 content 작성 예시:
"<p><strong>경복궁</strong>에서 조선시대 역사를 느껴보세요.</p><p>광화문에서 시작해 근정전, 경회루를 둘러보는 코스를 추천합니다. 소요시간 약 2시간.</p>"
`;

/**
 * 여행 계획 검증 및 개선 프롬프트
 */
export const getValidationPrompt = (planJSON: string) => `
다음 한국 국내 여행 계획 JSON을 검증하고 문제가 있다면 수정하세요:

${planJSON}

검증 항목:
1. 시간 겹침이 없는지
2. 이동 시간이 충분한지
3. 식사 시간이 포함되었는지
4. 각 일차의 활동이 지리적으로 효율적인지
5. start_time < end_time 인지
6. order_index가 순차적인지
7. 모든 장소가 한국 내 실제 존재하는 장소인지
8. 주소가 한국 주소 형식(시/도 구/군 동/읍/면)인지

문제가 있다면 수정된 JSON을 반환하고, 없다면 원본 JSON을 그대로 반환하세요.
JSON만 출력하세요.
`;

/**
 * 장소 정보 보강 프롬프트 (네이버 API 연동용)
 * 네이버 지도 API는 한국 국내 장소만 지원합니다.
 */
export const getLocationEnrichmentPrompt = (locationName: string, city: string) => `
한국 "${city}" 지역의 "${locationName}"에 대한 다음 정보를 제공하세요:

{
  "address": "상세 한국 주소 (시/도 구/군 동/읍/면 번지 형식)",
  "category": "카테고리 (예: 관광명소, 음식점, 카페, 쇼핑)",
  "description": "간단한 설명 (50자 이내)"
}

주의: 반드시 한국 국내 실제 존재하는 장소 정보만 제공하세요.
JSON 형식으로만 답변하세요.
`;
