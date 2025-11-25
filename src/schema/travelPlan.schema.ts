import Joi from "joi";

/**
 * Location 스키마
 */
const locationSchema = Joi.object({
  title: Joi.string().required().max(255).messages({
    "string.empty": "장소명은 필수입니다",
    "string.max": "장소명은 255자를 초과할 수 없습니다",
  }),
  address: Joi.string().allow("", null).max(255),
  category: Joi.string().allow("", null).max(255),
  thumbnail_url: Joi.string().uri().allow("", null).max(512),
});

/**
 * Card 스키마
 */
const cardSchema = Joi.object({
  location: locationSchema.optional(),
  content: Joi.string().required().messages({
    "string.empty": "카드 내용은 필수입니다",
  }),
  start_time: Joi.string()
    .pattern(/^\d{2}:\d{2}:\d{2}$/)
    .required()
    .messages({
      "string.pattern.base": "시작 시간은 HH:MM:SS 형식이어야 합니다",
      "string.empty": "시작 시간은 필수입니다",
    }),
  end_time: Joi.string()
    .pattern(/^\d{2}:\d{2}:\d{2}$/)
    .required()
    .messages({
      "string.pattern.base": "종료 시간은 HH:MM:SS 형식이어야 합니다",
      "string.empty": "종료 시간은 필수입니다",
    }),
  order_index: Joi.number().integer().min(1).required().messages({
    "number.base": "정렬 순서는 숫자여야 합니다",
    "number.min": "정렬 순서는 1 이상이어야 합니다",
    "number.empty": "정렬 순서는 필수입니다",
  }),
});

/**
 * Board 스키마
 */
const boardSchema = Joi.object({
  day_number: Joi.number().integer().min(1).required().messages({
    "number.base": "일차는 숫자여야 합니다",
    "number.min": "일차는 1 이상이어야 합니다",
    "number.empty": "일차는 필수입니다",
  }),
  cards: Joi.array().items(cardSchema).min(1).required().messages({
    "array.min": "각 일차는 최소 1개의 카드가 필요합니다",
    "array.base": "카드는 배열이어야 합니다",
  }),
});

/**
 * 전체 여행 계획 스키마
 */
export const travelPlanSchema = Joi.object({
  boards: Joi.array().items(boardSchema).min(1).required().messages({
    "array.min": "최소 1일 이상의 일정이 필요합니다",
    "array.base": "보드는 배열이어야 합니다",
    "any.required": "보드는 필수입니다",
  }),
});

/**
 * 여행 계획 생성 요청 스키마
 */
export const generateTravelPlanRequestSchema = Joi.object({
  templateName: Joi.string().required().max(100).messages({
    "string.empty": "템플릿 이름은 필수입니다",
    "string.max": "템플릿 이름은 100자를 초과할 수 없습니다",
  }),
  conversationHistory: Joi.array()
    .items(
      Joi.object({
        role: Joi.string().valid("user", "assistant").required(),
        content: Joi.string().required(),
      })
    )
    .min(1)
    .required()
    .messages({
      "array.min": "대화 이력이 필요합니다",
    }),
});

/**
 * 여행 계획 JSON 검증
 */
export const validateTravelPlan = (planData: any) => {
  return travelPlanSchema.validate(planData, {
    abortEarly: false,
    stripUnknown: true,
  });
};

/**
 * 생성 요청 검증
 */
export const validateGenerateRequest = (requestData: any) => {
  return generateTravelPlanRequestSchema.validate(requestData, {
    abortEarly: false,
  });
};
