-- --------------------------------------------------------
-- 호스트:                          127.0.0.1
-- 서버 버전:                        11.4.4-MariaDB - mariadb.org binary distribution
-- 서버 OS:                        Win64
-- HeidiSQL 버전:                  12.8.0.6908
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- wanna-trip-db 데이터베이스 구조 내보내기
CREATE DATABASE IF NOT EXISTS `wanna-trip-db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */;
USE `wanna-trip-db`;

-- 테이블 wanna-trip-db.board 구조 내보내기
CREATE TABLE IF NOT EXISTS `board` (
  `board_id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'PK: 보드 일련번호',
  `template_id` int(11) NOT NULL COMMENT '템플릿 ID (외래키)',
  `day_number` int(11) NOT NULL COMMENT '여행 일차',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT '생성일시',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT '수정일시',
  PRIMARY KEY (`board_id`) USING BTREE,
  KEY `FK_board_template` (`template_id`) USING BTREE,
  KEY `IDX_template_day` (`template_id`,`day_number`) USING BTREE,
  CONSTRAINT `FK_board_template` FOREIGN KEY (`template_id`) REFERENCES `template` (`template_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='여행 일차별 보드 테이블';

-- 테이블 데이터 wanna-trip-db.board:~1 rows (대략적) 내보내기
INSERT INTO `board` (`board_id`, `template_id`, `day_number`, `created_at`, `updated_at`) VALUES
	(9, 10, 1, '2025-05-20 05:23:25', '2025-05-20 05:23:25');

-- 테이블 wanna-trip-db.card 구조 내보내기
CREATE TABLE IF NOT EXISTS `card` (
  `card_id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'PK: 카드 일련번호',
  `board_id` int(11) NOT NULL COMMENT '보드 ID (외래키)',
  `title` varchar(100) NOT NULL COMMENT '일정 제목',
  `content` text DEFAULT NULL COMMENT '일정 세부 내용',
  `location` varchar(255) DEFAULT NULL COMMENT '장소 정보',
  `start_time` time DEFAULT NULL COMMENT '시작 시간',
  `end_time` time DEFAULT NULL COMMENT '종료 시간',
  `order_index` int(11) NOT NULL DEFAULT 0 COMMENT '카드 정렬 순서',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT '생성일시',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT '수정일시',
  PRIMARY KEY (`card_id`) USING BTREE,
  KEY `FK_card_board` (`board_id`) USING BTREE,
  KEY `IDX_board_order` (`board_id`,`order_index`) USING BTREE,
  KEY `IDX_board_time` (`board_id`,`start_time`) USING BTREE,
  CONSTRAINT `FK_card_board` FOREIGN KEY (`board_id`) REFERENCES `board` (`board_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='여행 세부 일정 카드 테이블';

-- 테이블 데이터 wanna-trip-db.card:~0 rows (대략적) 내보내기

-- 테이블 wanna-trip-db.email_verification 구조 내보내기
CREATE TABLE IF NOT EXISTS `email_verification` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'PK: 이메일 인증 일련번호',
  `email` varchar(255) NOT NULL COMMENT '이메일: 복합 UNIQUE(email, verification_code)',
  `verification_code` varchar(10) NOT NULL COMMENT '인증 코드: 복합 UNIQUE(email, verification_code)',
  `expires_at` datetime NOT NULL COMMENT '인증 코드 만료 시각',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT '생성 시각',
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_email_verification_email_code` (`email`,`verification_code`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='이메일 인증 테이블';

-- 테이블 데이터 wanna-trip-db.email_verification:~1 rows (대략적) 내보내기
INSERT INTO `email_verification` (`id`, `email`, `verification_code`, `expires_at`, `created_at`) VALUES
	(32, 'dlcks2001@naver.com', '813390', '2025-05-24 14:36:15', '2025-05-24 14:31:15');

-- 테이블 wanna-trip-db.location 구조 내보내기
CREATE TABLE IF NOT EXISTS `location` (
  `location_id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'PK: 위치 일련번호',
  `location_uuid` varchar(36) NOT NULL DEFAULT uuid() COMMENT 'UUID(고정 공개 ID)',
  `card_id` int(11) NOT NULL COMMENT '카드 ID (외래키)',
  `place_name` varchar(255) NOT NULL COMMENT '장소명',
  `address` varchar(255) DEFAULT NULL COMMENT '상세 주소',
  `city` varchar(100) DEFAULT NULL COMMENT '도시명',
  `latitude` decimal(10,8) NOT NULL COMMENT '위도',
  `longitude` decimal(11,8) NOT NULL COMMENT '경도',
  `category` varchar(255) DEFAULT NULL COMMENT '장소 카테고리',
  `thumbnail_url` varchar(512) DEFAULT NULL COMMENT '장소 썸네일 URL',
  `visit_count` int(11) NOT NULL DEFAULT 0 COMMENT '방문 횟수',
  `last_visit_date` date DEFAULT NULL COMMENT '마지막 방문 날짜',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT '생성일시',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT '수정일시',
  PRIMARY KEY (`location_id`) USING BTREE,
  UNIQUE KEY `UK_location_uuid` (`location_uuid`) USING BTREE,
  KEY `FK_location_card` (`card_id`) USING BTREE,
  KEY `IDX_location_category` (`category`) USING BTREE,
  KEY `IDX_location_coords` (`latitude`,`longitude`),
  CONSTRAINT `FK_location_card` FOREIGN KEY (`card_id`) REFERENCES `card` (`card_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='여행 장소 위치 정보 테이블';

-- 테이블 데이터 wanna-trip-db.location:~0 rows (대략적) 내보내기

-- 테이블 wanna-trip-db.template 구조 내보내기
CREATE TABLE IF NOT EXISTS `template` (
  `template_id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'PK: 템플릿 일련번호',
  `template_uuid` varchar(36) NOT NULL DEFAULT uuid() COMMENT 'UUID(고정 공개 ID)',
  `user_id` int(11) NOT NULL COMMENT '사용자 ID (외래키)',
  `title` varchar(100) NOT NULL COMMENT '템플릿 이름',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT '생성일시',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT '수정일시',
  PRIMARY KEY (`template_id`) USING BTREE,
  UNIQUE KEY `UK_template_uuid` (`template_uuid`) USING BTREE,
  KEY `FK_template_user` (`user_id`) USING BTREE,
  CONSTRAINT `FK_template_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='여행 템플릿 테이블';

-- 테이블 데이터 wanna-trip-db.template:~1 rows (대략적) 내보내기
INSERT INTO `template` (`template_id`, `template_uuid`, `user_id`, `title`, `created_at`, `updated_at`) VALUES
	(10, '99a1a639-353a-11f0-9e3c-38a746032467', 1, '목원대학교 탐방', '2025-05-20 05:23:25', '2025-05-20 05:23:25');

-- 테이블 wanna-trip-db.user 구조 내보내기
CREATE TABLE IF NOT EXISTS `user` (
  `user_id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'PK: 사용자 일련번호',
  `user_uuid` varchar(36) NOT NULL DEFAULT uuid() COMMENT 'UUID(고정 공개 ID)',
  `email` varchar(255) NOT NULL COMMENT '이메일',
  `password` varchar(255) DEFAULT NULL COMMENT '비밀번호',
  `name` varchar(100) NOT NULL COMMENT '이름',
  `permission` enum('user','admin','superadmin') NOT NULL DEFAULT 'user' COMMENT '권한',
  `state` enum('active','inactive') NOT NULL DEFAULT 'active' COMMENT '계정 상태',
  `login_type` enum('kakao','google','normal') NOT NULL DEFAULT 'normal' COMMENT '로그인 방식',
  `refresh_token` varchar(512) DEFAULT NULL COMMENT 'JWT Refresh 토',
  `provider_id` varchar(255) DEFAULT NULL COMMENT '소셜 로그인 제공자 고유 ID',
  `terms` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT '{\r\n "privacy": true,\r\n "location": true\r\n}' COMMENT '이용약관 동의 정보 (예: 필수: privacy, 선택: location)' CHECK (json_valid(`terms`)),
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `UK_user_uuid` (`user_uuid`)
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자 테이블';

-- 테이블 데이터 wanna-trip-db.user:~5 rows (대략적) 내보내기
INSERT INTO `user` (`user_id`, `user_uuid`, `email`, `password`, `name`, `permission`, `state`, `login_type`, `refresh_token`, `provider_id`, `terms`) VALUES
	(1, '18bf748f-233d-11f0-9c1e-38a746032467', 'dlcks', '$2b$10$18f.Kf25YpnXjiahZdE.R.78cF6U/.HngqJJPGTK7nJ67bBQwT/vy', '찬', 'user', 'active', 'normal', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsIm5hbWUiOiLssKwiLCJwZXJtaXNzaW9uIjoidXNlciIsImxvZ2luX3R5cGUiOiJub3JtYWwiLCJpYXQiOjE3NDkyOTYyMjQsImV4cCI6MTc0OTkwMTAyNH0._UGqopgYs55ayIqLjy1jNp-S_8ioo9IABGhnYKfajqg', NULL, '{\r\n "privacy": true,\r\n "location": true\r\n}'),
	(4, '2791196d-23e4-11f0-9c1e-38a746032467', 'test', '$2b$10$FTZXROfxRhhlBPMBi6R9JOQAc8jzIBvM6gr52/F8rh5jBWSwaEyVi', 'testID', 'user', 'active', 'normal', NULL, NULL, '{\r\n "privacy": true,\r\n "location": true\r\n}'),
	(6, '7b24c061-24b8-11f0-9e7c-38a746032467', 'sonjin54@naver.com', '$2b$10$0blCJnDZIVcPT/vcRH8UaOrfLJOlgHacTzvrxohbpJbqe9F2FqNAe', '선진', 'user', 'active', 'normal', NULL, NULL, '{\r\n "privacy": true,\r\n "location": true\r\n}'),
	(30, 'b603b6a5-2fbd-11f0-9e3c-38a746032467', 'leechan753@gmail.com', NULL, '히츠 (히츠)', 'user', 'active', 'google', NULL, NULL, '{"privacy": true, "location": false}'),
	(36, '8031e65f-3c3a-11f0-9ecd-38a746032467', 'dlcks2001@naver.com', NULL, '이찬', 'user', 'active', 'kakao', NULL, '3808415379', '{\r\n "privacy": true,\r\n "location": true\r\n}');

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
