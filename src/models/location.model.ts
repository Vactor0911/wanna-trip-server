import { Pool, PoolConnection } from "mariadb";
import { dbPool } from "../config/db";

class LocationModel {
  /**
   * 위치 정보 생성
   * @param cardUuid 카드 uuid
   * @param title 장소명
   * @param address 주소
   * @param latitude 위도
   * @param longitude 경도
   * @param category 카테고리
   * @param thumbnail_url 썸네일 URL
   * @param connection
   */
  static async create(
    cardUuid: string,
    title: string,
    address: string,
    latitude: number,
    longitude: number,
    category: string,
    thumbnail_url: string,
    connection: PoolConnection | Pool = dbPool
  ) {
    // 카드 조회
    const [card] = await connection.execute(
      `
        SELECT card_id
        FROM card
        WHERE card_uuid = ?
        LIMIT 1
      `,
      [cardUuid]
    );

    // 위치 정보 삽입
    await connection.execute(
      `
        INSERT INTO location
        (card_id, title, address, latitude, longitude, category, thumbnail_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        card.card_id,
        title,
        address,
        latitude,
        longitude,
        category,
        thumbnail_url,
      ]
    );
  }

  /**
   * 위치 id로 위치 정보 조회
   * @param locationId 위치 id
   * @param connection 데이터베이스 연결 객체
   * @returns 조회된 위치 정보
   */
  static async findById(locationId: string, connection: PoolConnection | Pool) {
    const locations = await connection.execute(
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
   * @param connection 데이터베이스 연결 객체
   * @returns 조회된 위치 정보
   */
  static async findByCardId(cardId: string, connection: PoolConnection | Pool) {
    const locations = await connection.execute(
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
