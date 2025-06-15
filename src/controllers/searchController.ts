import { Request, Response } from 'express';
import axios from 'axios';

// 장소 검색 API
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
    // Naver 장소 검색 API 호출
    const response = await axios.get('https://openapi.naver.com/v1/search/local.json', {
      params: { 
        query, 
        display, 
        start, 
        sort: 'random'
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
    console.error('Naver API 장소 검색 오류:', error);
    res.status(500).json({
      success: false,
      message: '장소 검색 중 오류가 발생했습니다'
    });
  }
};

// 장소별 이미지 검색 API
export const searchPlaceImages = async (req: Request, res: Response): Promise<void> => {
  const { query } = req.query;

  console.log('searchPlaceImages query:', query);
  
  if (!query) {
    res.status(400).json({
      success: false,
      message: '검색어가 필요합니다.'
    });
    return;
  }
  
  try {
    // 이미지 검색 - 특정 장소명으로 검색
    const response = await axios.get('https://openapi.naver.com/v1/search/image.json', {
      params: {
        query,
        display: 1,
        sort: 'sim',
        filter: 'medium'
      },
      headers: {
        'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET
      }
    });
    
    // 첫 번째 이미지만 반환하거나 여러 이미지 반환
    const images = response.data.items;
    
    res.status(200).json({
      success: true,
      images: images.length > 0 ? images : [],
      bestMatch: images.length > 0 ? {
        imageUrl: images[0].link,
        thumbnailUrl: images[0].thumbnail
      } : null
    });
  } catch (error) {
    console.error('Naver API 이미지 검색 오류:', error);
    res.status(500).json({
      success: false,
      message: '이미지 검색 중 오류가 발생했습니다'
    });
  }
};
