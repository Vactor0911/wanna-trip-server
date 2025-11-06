import { dbPool } from "../config/db";

class LocationModel {
  /**
   * 위치 id로 위치 정보 조회
   * @param locationId 위치 id
   * @returns 조회된 위치 정보
   */
  static async findById(locationId: string) {
    const locations = await dbPool.execute(
      `
        SELECT * FROM location
        WHERE location_id = ?
        LIMIT 1
      `,
      [locationId]
    );
    return locations && locations.length > 0 ? locations[0] : null;
  }

  /**
   * 카드 id로 위치 정보 조회
   * @param cardId 카드 id
   * @returns 조회된 위치 정보
   */
  static async findByCardId(cardId: string) {
    const locations = await dbPool.execute(
      `
        SELECT * FROM location
        WHERE card_id = ?
        LIMIT 1
      `,
      [cardId]
    );
    return locations && locations.length > 0 ? locations[0] : null;
  }
}

export default LocationModel;
