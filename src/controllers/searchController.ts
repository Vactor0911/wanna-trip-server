import { Request, Response } from 'express';
import axios from 'axios';

// 장소 검색
export const searchPlaces = async (req: Request, res: Response): Promise<void> => {
  const { query, display = 15, start = 1 } = req.query;
  
  if (!query) {
    res.status(400).json({
      success: false,
      message: '검색어가 필요합니다.'
    });
    return;
  }
  
  try {
    // Naver 검색 API 호출
    const response = await axios.get('https://openapi.naver.com/v1/search/local.json', {
      params: { 
        query, 
        display, 
        start, 
        sort: 'sim' 
      },
      headers: {
        'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET
      }
    });

    
    res.status(200).json({
      success: true,
      items: response.data.items
    });
  } catch (error) {
    console.error('Naver API 검색 오류:', error);
    res.status(500).json({
      success: false,
      message: '검색 중 오류가 발생했습니다'
    });
  }
};
