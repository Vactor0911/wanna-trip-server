import express from 'express';
import { authenticateToken } from '../middleware/authenticate';
import { searchPlaces } from '../controllers/searchController';
import { limiter } from '../utils';

const router = express.Router();

// 장소 검색 API
router.get('/places', limiter, authenticateToken, searchPlaces);


export default router;