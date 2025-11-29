import { PoolConnection } from "mariadb";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import TransactionHandler from "../utils/transactionHandler";
import { dbPool } from "../config/db";

/**
 * 여행 계획 JSON 인터페이스
 */
interface LocationData {
  title: string;
  address?: string;
  category?: string;
  thumbnail_url?: string;
  latitude?: number;
  longitude?: number;
}

interface CardData {
  location?: LocationData;
  content: string;
  start_time: string;
  end_time: string;
  order_index: number;
}

interface BoardData {
  day_number: number;
  cards: CardData[];
}

interface TravelPlanJSON {
  boards: BoardData[];
}

/**
 * 네이버 API 검색 결과 인터페이스
 */
interface NaverLocalItem {
  title: string;
  link: string;
  category: string;
  description: string;
  telephone: string;
  address: string;
  roadAddress: string;
  mapx: string;
  mapy: string;
}

interface NaverImageItem {
  title: string;
  link: string;
  thumbnail: string;
  sizeheight: string;
  sizewidth: string;
}

class TravelPlanService {
  /**
   * 네이버 API로 장소 검색하여 상세 정보 가져오기
   * @param locationTitle 장소명
   * @param locationAddress 주소 (검색 정확도 향상용)
   * @returns 보강된 장소 정보
   */
  static async enrichLocationWithNaverAPI(
    locationTitle: string,
    locationAddress?: string
  ): Promise<Partial<LocationData>> {
    try {
      // 1. 네이버 지역 검색 API로 장소 정보 가져오기
      const searchQuery = locationAddress
        ? `${locationTitle} ${locationAddress.split(" ").slice(0, 2).join(" ")}`
        : locationTitle;

      const localResponse = await axios.get<{ items: NaverLocalItem[] }>(
        "https://openapi.naver.com/v1/search/local.json",
        {
          params: {
            query: searchQuery,
            display: 1,
            sort: "random",
          },
          headers: {
            "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID,
            "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET,
          },
        }
      );

      const localItem = localResponse.data.items[0];

      if (!localItem) {
        // 검색 결과가 없으면 좌표 없이 기본 정보만 반환
        return {
          title: locationTitle,
          address: locationAddress,
          // latitude, longitude는 undefined로 유지 (null 좌표 방지)
        };
      }

      // 좌표 변환 (네이버 API는 KATEC 좌표계 사용, WGS84로 변환 필요)
      // mapx, mapy는 경도/위도 * 10000000 형태
      const rawLongitude = parseFloat(localItem.mapx) / 10000000;
      const rawLatitude = parseFloat(localItem.mapy) / 10000000;

      // 유효한 좌표인지 검증 (한국 영역: 위도 33~43, 경도 124~132)
      const isValidCoordinate =
        !isNaN(rawLatitude) &&
        !isNaN(rawLongitude) &&
        rawLatitude >= 33 &&
        rawLatitude <= 43 &&
        rawLongitude >= 124 &&
        rawLongitude <= 132;

      const latitude = isValidCoordinate ? rawLatitude : undefined;
      const longitude = isValidCoordinate ? rawLongitude : undefined;

      // 2. 네이버 이미지 검색 API로 썸네일 가져오기
      let thumbnailUrl: string | undefined;

      try {
        const imageResponse = await axios.get<{ items: NaverImageItem[] }>(
          "https://openapi.naver.com/v1/search/image.json",
          {
            params: {
              query: locationTitle,
              display: 1,
              sort: "sim",
              filter: "medium",
            },
            headers: {
              "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID,
              "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET,
            },
          }
        );

        if (imageResponse.data.items.length > 0) {
          thumbnailUrl = imageResponse.data.items[0].thumbnail;
        }
      } catch (imageError) {}

      // HTML 태그 제거 (네이버 API 결과에 <b> 태그 포함될 수 있음)
      const cleanTitle = localItem.title.replace(/<[^>]*>/g, "");

      return {
        title: cleanTitle,
        address: localItem.roadAddress || localItem.address,
        category: localItem.category,
        latitude,
        longitude,
        thumbnail_url: thumbnailUrl,
      };
    } catch (error) {
      console.error(`[NaverAPI] 장소 정보 보강 실패: ${locationTitle}`, error);
      return {
        title: locationTitle,
        address: locationAddress,
        // 에러 시에도 좌표 없이 반환
      };
    }
  }

  /**
   * 여행 계획의 모든 장소에 대해 네이버 API로 정보 보강
   * @param planJSON 여행 계획 JSON
   * @returns 보강된 여행 계획 JSON
   */
  static async enrichPlanWithNaverAPI(
    planJSON: TravelPlanJSON
  ): Promise<TravelPlanJSON> {
    const enrichedPlan = JSON.parse(JSON.stringify(planJSON)) as TravelPlanJSON;

    for (const board of enrichedPlan.boards) {
      for (const card of board.cards) {
        if (card.location?.title) {
          // API 호출 간 딜레이 (Rate Limit 방지)
          await new Promise((resolve) => setTimeout(resolve, 100));

          const enrichedLocation = await this.enrichLocationWithNaverAPI(
            card.location.title,
            card.location.address
          );

          // 기존 정보와 병합 (네이버 API 결과 우선)
          card.location = {
            ...card.location,
            ...enrichedLocation,
            // AI가 생성한 정보가 없을 경우에만 네이버 결과 사용
            title: enrichedLocation.title || card.location.title,
            address: enrichedLocation.address || card.location.address,
            category: enrichedLocation.category || card.location.category,
          };
        }
      }
    }

    return enrichedPlan;
  }
  /**
   * AI 생성 여행 계획 JSON을 DB에 저장
   * @param userId 사용자 ID
   * @param templateName 템플릿 이름
   * @param planJSON 여행 계획 JSON
   * @returns 생성된 template_uuid
   */
  static async saveTravelPlanToDB(
    userId: number,
    templateName: string,
    planJSON: TravelPlanJSON
  ): Promise<string> {
    return await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection: PoolConnection) => {
        // 1. Template 생성
        const templateUuid = uuidv4();

        await connection.execute(
          `INSERT INTO template (template_uuid, user_id, title, privacy)
         VALUES (?, ?, ?, 'private')`,
          [templateUuid, userId, templateName]
        );

        // template_id 조회
        const [templateRow]: any = await connection.query(
          `SELECT template_id FROM template WHERE template_uuid = ?`,
          [templateUuid]
        );
        const templateId = templateRow.template_id;

        // 2. 각 일차(Board) 생성
        for (const board of planJSON.boards) {
          const boardUuid = uuidv4();

          await connection.execute(
            `INSERT INTO board (board_uuid, template_id, day_number)
           VALUES (?, ?, ?)`,
            [boardUuid, templateId, board.day_number]
          );

          // board_id 조회
          const [boardRow]: any = await connection.query(
            `SELECT board_id FROM board WHERE board_uuid = ?`,
            [boardUuid]
          );
          const boardId = boardRow.board_id;

          // 3. 각 카드(Card) 생성
          for (const card of board.cards) {
            const cardUuid = uuidv4();

            await connection.execute(
              `INSERT INTO card (card_uuid, board_id, content, start_time, end_time, order_index, locked)
             VALUES (?, ?, ?, ?, ?, ?, 0)`,
              [
                cardUuid,
                boardId,
                card.content,
                card.start_time,
                card.end_time,
                card.order_index,
              ]
            );

            // 4. Location 정보 저장 (있는 경우)
            if (card.location) {
              // card_id 조회
              const [cardRow]: any = await connection.query(
                `SELECT card_id FROM card WHERE card_uuid = ?`,
                [cardUuid]
              );
              const cardId = cardRow.card_id;

              await connection.execute(
                `INSERT INTO location (card_id, title, address, latitude, longitude, category, thumbnail_url)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  cardId,
                  card.location.title,
                  card.location.address || null,
                  card.location.latitude || null,
                  card.location.longitude || null,
                  card.location.category || null,
                  card.location.thumbnail_url || null,
                ]
              );
            }
          }
        }

        return templateUuid;
      }
    );
  }

  /**
   * 여행 계획 JSON 유효성 검증
   * @param planJSON 검증할 JSON
   * @returns 검증 결과
   */
  static validatePlanJSON(planJSON: any): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!planJSON.boards || !Array.isArray(planJSON.boards)) {
      errors.push("boards 배열이 필요합니다");
      return { isValid: false, errors };
    }

    if (planJSON.boards.length === 0) {
      errors.push("최소 1일 이상의 일정이 필요합니다");
    }

    planJSON.boards.forEach((board: any, boardIndex: number) => {
      if (typeof board.day_number !== "number" || board.day_number < 1) {
        errors.push(`Board ${boardIndex + 1}: 유효한 day_number가 필요합니다`);
      }

      if (
        !board.cards ||
        !Array.isArray(board.cards) ||
        board.cards.length === 0
      ) {
        errors.push(`Board ${boardIndex + 1}: 최소 1개의 카드가 필요합니다`);
        return;
      }

      board.cards.forEach((card: any, cardIndex: number) => {
        if (!card.content) {
          errors.push(
            `Day ${board.day_number}, Card ${
              cardIndex + 1
            }: content가 필요합니다`
          );
        }

        const timeRegex = /^\d{2}:\d{2}:\d{2}$/;
        if (!card.start_time || !timeRegex.test(card.start_time)) {
          errors.push(
            `Day ${board.day_number}, Card ${
              cardIndex + 1
            }: 유효한 start_time이 필요합니다 (HH:MM:SS)`
          );
        }

        if (!card.end_time || !timeRegex.test(card.end_time)) {
          errors.push(
            `Day ${board.day_number}, Card ${
              cardIndex + 1
            }: 유효한 end_time이 필요합니다 (HH:MM:SS)`
          );
        }

        if (typeof card.order_index !== "number" || card.order_index < 1) {
          errors.push(
            `Day ${board.day_number}, Card ${
              cardIndex + 1
            }: 유효한 order_index가 필요합니다`
          );
        }
      });
    });

    return { isValid: errors.length === 0, errors };
  }
}

export default TravelPlanService;
