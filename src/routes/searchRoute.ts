import express from 'express';
import { authenticateToken } from '../middleware/authenticate';
import { searchPlaceImages, searchPlaces } from '../controllers/searchController';
import { limiter } from '../utils';

const router = express.Router();

// 장소 검색 API
router.get('/places', limiter, authenticateToken, searchPlaces);

// 장소별 이미지 검색 API
router.get('/place-images', limiter, authenticateToken, searchPlaceImages);


export default router;